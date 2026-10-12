import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { inr, toPaise, toRupees, ymd, fmtDate, PAYMENT_MODES } from '../../lib/format';
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from '../../components/ui';
import { DiscountApproval, UsableApprovals, needsApproval } from '../../components/DiscountApproval';

const INVALIDATE = ['member', 'members', 'dashboard', 'payments'];

function PaymentFields({ value, onChange, max }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Amount received (₹)" hint={max != null ? `Due: ${inr(max)}` : undefined}>
        <Input type="number" min="0" step="0.01" value={value.amount} onChange={(e) => onChange({ ...value, amount: e.target.value })} />
      </Field>
      <Field label="Mode">
        <Select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value })}>
          {PAYMENT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reference / UTR">
        <Input value={value.reference} onChange={(e) => onChange({ ...value, reference: e.target.value })} />
      </Field>
    </div>
  );
}

/** New membership or renewal, with optional first payment. */
export function MembershipModal({ open, onClose, member, isFirst }) {
  const { data: plans } = useQuery({ queryKey: ['plans', 'active', member.branchId?._id], queryFn: () => get('/plans', { active: true, branchId: member.branchId?._id || member.branchId }), enabled: open });
  const { data: gym } = useQuery({ queryKey: ['settings'], queryFn: () => get('/settings'), enabled: open });
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [discount, setDiscount] = useState('');
  const [waive, setWaive] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [family, setFamily] = useState([]);
  const [famQ, setFamQ] = useState('');
  const { data: famFound } = useQuery({ queryKey: ['family-search', famQ], queryFn: () => get('/members', { search: famQ, limit: 5 }), enabled: famQ.length >= 2 });
  const [pay, setPay] = useState({ amount: '', mode: 'upi', reference: '' });
  const [needApproval, setNeedApproval] = useState(false);
  const [approvalId, setApprovalId] = useState('');

  const plan = plans?.find((p) => p._id === planId);
  const calc = useMemo(() => {
    if (!plan) return null;
    const joining = isFirst && !waive ? plan.joiningFee || 0 : 0;
    const disc = toPaise(discount);
    const taxable = Math.max(0, plan.price + joining - disc);
    const taxPercent = plan.taxPercent ?? gym?.taxPercent ?? 0;
    const tax = Math.round((taxable * taxPercent) / 100);
    return { joining, disc, taxable, taxPercent, tax, total: taxable + tax };
  }, [plan, isFirst, waive, discount, gym]);

  const save = useAction((body) => post('/subscriptions', body), {
    success: 'Membership added',
    invalidate: [...INVALIDATE, 'approvals'],
    onSuccess: () => {
      onClose();
      setPlanId('');
      setDiscount('');
      setPay({ amount: '', mode: 'upi', reference: '' });
      setNeedApproval(false);
      setApprovalId('');
    },
    onError: (err) => needsApproval(err) && setNeedApproval(true),
  });
  const body = (extra = {}) => ({
    memberId: member._id,
    planId,
    startDate: startDate || undefined,
    discount: toPaise(discount),
    waiveJoiningFee: waive,
    couponCode: couponCode.trim() || undefined,
    familyMemberIds: plan?.maxMembers > 1 ? family.map((x) => x._id) : [],
    payment: Number(pay.amount) > 0 ? { amount: toPaise(pay.amount), mode: pay.mode, reference: pay.reference || undefined } : undefined,
    approvalId: approvalId || undefined,
    ...extra,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isFirst ? 'Add membership' : 'Renew / add membership'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!plan} loading={save.isPending} onClick={() => save.mutate(body())}>
            Save membership
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <UsableApprovals
          kind="subscription"
          memberId={open ? member._id : null}
          selectedId={approvalId}
          onUse={(a) => {
            setPlanId(a.itemKey.split(':')[1]);
            setDiscount(String(toRupees(a.approvedDiscount)));
            setApprovalId(a._id);
            setNeedApproval(false);
          }}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {plans?.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => (setPlanId(p._id), setNeedApproval(false))}
              className={`rounded-xl p-3 text-left ring-1 transition ${planId === p._id ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200 hover:ring-brand-300'}`}
            >
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-sm text-slate-500">
                {p.durationValue} {p.durationUnit}
                {p.durationValue > 1 ? 's' : ''} · {inr(p.price)}
                {isFirst && p.joiningFee ? ` + ${inr(p.joiningFee)} joining` : ''}
              </p>
            </button>
          ))}
          {plans && !plans.length && <p className="text-sm text-slate-500">No active plans. Create plans first.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date" hint={isFirst ? 'Default: today' : 'Default: the day after the current membership ends'}>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Discount (₹)">
            <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => (setDiscount(e.target.value), setNeedApproval(false))} />
          </Field>
          <Field label="Coupon code" hint="Applied when saving; total on the invoice">
            <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />
          </Field>
        </div>
        {plan?.maxMembers > 1 && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-sm font-medium text-emerald-900">
              {plan.name} covers {plan.maxMembers} members. Add up to {plan.maxMembers - 1} more:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {family.map((x) => (
                <span key={x._id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-sm ring-1 ring-emerald-200">
                  {x.name} #{x.memberCode}
                  <button className="text-slate-400" onClick={() => setFamily(family.filter((y) => y._id !== x._id))} aria-label="Remove">
                    ×
                  </button>
                </span>
              ))}
            </div>
            {family.length < plan.maxMembers - 1 && (
              <>
                <Input className="mt-2" value={famQ} onChange={(e) => setFamQ(e.target.value)} placeholder="Search member to add (register them first)" />
                {famQ.length >= 2 && (
                  <ul className="mt-1 rounded-lg bg-white ring-1 ring-slate-200">
                    {famFound?.items
                      ?.filter((x) => x._id !== member._id && !family.some((y) => y._id === x._id))
                      .map((x) => (
                        <li key={x._id}>
                          <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => (setFamily([...family, x]), setFamQ(''))}>
                            {x.name} <span className="text-slate-400">#{x.memberCode}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        {isFirst && plan?.joiningFee > 0 && <Toggle checked={waive} onChange={setWaive} label="Waive joining fee" />}
        {calc && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <Row label="Plan price" value={inr(plan.price)} />
            {calc.joining > 0 && <Row label="Joining fee" value={inr(calc.joining)} />}
            {calc.disc > 0 && <Row label="Discount" value={`- ${inr(calc.disc)}`} />}
            {calc.tax > 0 && <Row label={`GST ${calc.taxPercent}%`} value={inr(calc.tax)} />}
            <Row label={<b>Total</b>} value={<b>{inr(calc.total)}</b>} />
            {member.companyId?.discountPercent > 0 && <p className="text-xs text-emerald-700">+ {member.companyId.discountPercent}% {member.companyId.name} discount applied on save</p>}
            <button type="button" className="mt-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setPay({ ...pay, amount: String(toRupees(calc.total)) })}>
              Received full amount
            </button>
          </div>
        )}
        {needApproval && plan && (
          <DiscountApproval
            request={{ kind: 'subscription', memberId: member._id, planId, waiveJoiningFee: waive, discount: toPaise(discount) }}
            completing={save.isPending}
            onComplete={(a) => save.mutate(body({ discount: a.approvedDiscount, approvalId: a._id }))}
          />
        )}
        <PaymentFields value={pay} onChange={setPay} />
        <p className="text-xs text-slate-500">Leave the amount empty to record the membership with the full amount as due.</p>
      </div>
    </Modal>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between py-0.5">
    <span className="text-slate-600">{label}</span>
    <span>{value}</span>
  </div>
);

export function PaymentModal({ open, onClose, subscription }) {
  const [pay, setPay] = useState({ amount: '', mode: 'upi', reference: '' });
  const save = useAction((body) => post('/payments', body), { success: 'Payment recorded', invalidate: INVALIDATE, onSuccess: onClose });
  if (!subscription) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Collect payment · ${subscription.plan?.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => save.mutate({ subscriptionId: subscription._id, amount: toPaise(pay.amount), mode: pay.mode, reference: pay.reference || undefined })}
          >
            Save payment
          </Button>
        </>
      }
    >
      <PaymentFields value={pay} onChange={setPay} max={subscription.dueAmount} />
      <button type="button" className="mt-2 text-xs font-medium text-brand-700 hover:underline" onClick={() => setPay({ ...pay, amount: String(toRupees(subscription.dueAmount)) })}>
        Full due ({inr(subscription.dueAmount)})
      </button>
    </Modal>
  );
}

export function FreezeModal({ open, onClose, subscription, canOverride }) {
  const [form, setForm] = useState({ from: ymd(), days: 7, reason: '', override: false });
  const used = (subscription?.freezes || []).reduce((s, f) => s + f.days, 0);
  const left = (subscription?.plan?.freezeDaysAllowed || 0) - used;
  const save = useAction((body) => post(`/subscriptions/${subscription._id}/freeze`, body), {
    success: 'Membership frozen. Entry is blocked during the freeze; end date extended.',
    invalidate: INVALIDATE,
    onSuccess: onClose,
  });
  if (!subscription) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Freeze membership"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate({ ...form, days: Number(form.days) })}>
            Freeze
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        Freeze days left on this plan: <b>{Math.max(0, left)}</b> of {subscription.plan?.freezeDaysAllowed || 0}. The end date moves forward by the frozen days. The member cannot enter while frozen.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <Input type="date" min={ymd()} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </Field>
        <Field label="Days">
          <Input type="number" min="1" max="180" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
        </Field>
        <Field label="Reason" className="sm:col-span-2">
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Travel, injury..." />
        </Field>
      </div>
      {canOverride && (
        <div className="mt-3">
          <Toggle checked={form.override} onChange={(v) => setForm({ ...form, override: v })} label="Override plan freeze limit (manager)" />
        </div>
      )}
    </Modal>
  );
}

export function ChangePlanModal({ open, onClose, subscription, branchId }) {
  const { data: plans } = useQuery({ queryKey: ['plans', 'active', branchId], queryFn: () => get('/plans', { active: true, branchId }), enabled: open });
  const [planId, setPlanId] = useState('');
  const save = useAction((body) => post(`/subscriptions/${subscription._id}/change-plan`, body), {
    success: (d) => `Plan changed. Credit applied: ${inr(d.credit)}`,
    invalidate: INVALIDATE,
    onSuccess: onClose,
  });
  if (!subscription) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade / change plan"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!planId} loading={save.isPending} onClick={() => save.mutate({ planId })}>
            Change plan
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        The current <b>{subscription.plan?.name}</b> membership ends today. The unused paid value is given as credit on the new plan, which starts today.
      </p>
      <Field label="New plan">
        <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">Choose…</option>
          {plans?.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} · {inr(p.price)}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

export function ReasonModal({ open, onClose, title, description, confirmLabel, danger = true, onConfirm, loading }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={reason.trim().length < 2} loading={loading} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="mb-3 text-sm text-slate-600">{description}</p>}
      <Field label="Reason">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

export function RefundModal({ open, onClose, payment }) {
  const [form, setForm] = useState({ amount: '', mode: 'cash', reason: '' });
  const save = useAction((body) => post(`/payments/${payment._id}/refund`, body), { success: 'Refund recorded', invalidate: INVALIDATE, onSuccess: onClose });
  if (!payment) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Refund · ${payment.receiptNo}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={save.isPending} onClick={() => save.mutate({ ...form, amount: toPaise(form.amount) })}>
            Record refund
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (₹)" hint={`Paid ${inr(payment.amount)} on ${fmtDate(payment.paidAt)}`}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Refund mode">
          <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reason" className="sm:col-span-2">
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function PortalModal({ open, onClose, member }) {
  const [password, setPassword] = useState('');
  const save = useAction((body) => post(`/members/${member._id}/portal`, body), { success: 'Portal access updated', invalidate: ['member'], onSuccess: onClose });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Member app access"
      size="sm"
      footer={
        <>
          {member.portalEnabled && (
            <Button variant="danger" loading={save.isPending} onClick={() => save.mutate({ enabled: false })}>
              Disable access
            </Button>
          )}
          <Button loading={save.isPending} disabled={password.length < 8} onClick={() => save.mutate({ enabled: true, password })}>
            {member.portalEnabled ? 'Reset password' : 'Enable access'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        The member signs in at <b>/portal</b> with phone <b>{member.phone}</b> and this password, to see their plan, dues, invoices and QR card.
      </p>
      <Field label="Password" hint="At least 8 characters. Share it with the member.">
        <Input value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
    </Modal>
  );
}
