import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell, IndianRupee, FileText, Plus, CalendarPlus } from 'lucide-react';
import { get, post, openFile } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { inr, fmtDate, fmtDateTime, toPaise, toRupees, ymd, PAYMENT_MODES } from '../../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from '../../components/ui';
import { LogSessionModal } from '../PersonalTraining';
import { BookSlotModal } from '../pt/PtSchedule';
import { BookingBadge } from '../../components/SlotPicker';
import { DiscountApproval, UsableApprovals, needsApproval } from '../../components/DiscountApproval';

function SellPtModal({ member, onClose }) {
  const { data: pkgs } = useQuery({ queryKey: ['pt', 'packages', 'active'], queryFn: () => get('/pt/packages', { active: true }) });
  const { data: trainers } = useQuery({ queryKey: ['trainers'], queryFn: () => get('/users/trainers') });
  const branchId = member.branchId?._id || member.branchId;
  const [f, setF] = useState({ packageId: '', trainerId: member.trainerId?._id || '', discount: '', amount: '', mode: 'upi' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pkg = pkgs?.find((p) => p._id === f.packageId);
  const [needApproval, setNeedApproval] = useState(false);
  const [approvalId, setApprovalId] = useState('');
  const sell = useAction((b) => post('/pt/purchases', b), {
    success: 'PT package sold',
    invalidate: ['pt', 'member', 'payments', 'approvals'],
    onSuccess: onClose,
    onError: (err) => needsApproval(err) && setNeedApproval(true),
  });
  const body = (extra = {}) => ({
    memberId: member._id,
    packageId: f.packageId,
    trainerId: f.trainerId,
    discount: toPaise(f.discount),
    payment: Number(f.amount) > 0 ? { amount: toPaise(f.amount), mode: f.mode } : undefined,
    approvalId: approvalId || undefined,
    ...extra,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Sell PT package"
      footer={
        <Button disabled={!f.packageId || !f.trainerId} loading={sell.isPending} onClick={() => sell.mutate(body())}>
          Sell package
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <UsableApprovals
            kind="pt"
            memberId={member._id}
            selectedId={approvalId}
            onUse={(a) => {
              setF({ ...f, packageId: a.itemKey.split(':')[1], discount: String(toRupees(a.approvedDiscount)) });
              setApprovalId(a._id);
              setNeedApproval(false);
            }}
          />
        </div>
        <Field label="Package" className="sm:col-span-2">
          <Select value={f.packageId} onChange={(e) => (set('packageId')(e), setNeedApproval(false))}>
            <option value="">Choose…</option>
            {pkgs?.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} · {p.sessions} sessions · {inr(p.price)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trainer" className="sm:col-span-2">
          <Select value={f.trainerId} onChange={set('trainerId')}>
            <option value="">Choose…</option>
            {trainers
              ?.filter((t) => t.branchIds.map(String).includes(String(branchId)))
              .map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Discount (₹)">
          <Input type="number" min="0" value={f.discount} onChange={(e) => (set('discount')(e), setNeedApproval(false))} />
        </Field>
        <div />
        <Field label="Amount received (₹)" hint={pkg ? `Price ${inr(pkg.price)} + GST` : undefined}>
          <Input type="number" min="0" value={f.amount} onChange={set('amount')} />
        </Field>
        <Field label="Mode">
          <Select value={f.mode} onChange={set('mode')}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        {needApproval && f.packageId && (
          <div className="sm:col-span-2">
            <DiscountApproval
              request={{ kind: 'pt', memberId: member._id, packageId: f.packageId, discount: toPaise(f.discount) }}
              completing={sell.isPending}
              onComplete={(a) => sell.mutate(body({ discount: a.approvedDiscount, approvalId: a._id }))}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function PayPtModal({ purchase, onClose }) {
  const [amount, setAmount] = useState(String(toRupees(purchase.dueAmount)));
  const [mode, setMode] = useState('upi');
  const pay = useAction((b) => post(`/pt/purchases/${purchase._id}/payments`, b), { success: 'Payment recorded', invalidate: ['pt', 'member', 'payments'], onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Collect PT payment" size="sm" footer={<Button loading={pay.isPending} onClick={() => pay.mutate({ amount: toPaise(amount), mode })}>Save</Button>}>
      <div className="grid gap-3">
        <Field label="Amount (₹)" hint={`Due ${inr(purchase.dueAmount)}`}>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Mode">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export default function MemberPt({ member }) {
  const can = useAuth((s) => s.can);
  const [modal, setModal] = useState(null);
  const { data } = useQuery({ queryKey: ['pt', 'member', member._id], queryFn: () => get('/pt/purchases', { memberId: member._id, limit: 50 }) });
  const { data: bookings } = useQuery({
    queryKey: ['pt', 'bookings', 'member', member._id],
    queryFn: () => get('/pt/bookings', { memberId: member._id, from: ymd(), to: ymd(new Date(Date.now() + 30 * 86400000)), status: 'open' }),
  });
  const items = data?.items || [];
  return (
    <Card
      title="Personal training"
      actions={
        can('pt.sell') && (
          <Button size="sm" onClick={() => setModal({ type: 'sell' })}>
            <Plus className="size-4" /> Sell PT package
          </Button>
        )
      }
    >
      {!items.length ? (
        <EmptyState icon={Dumbbell} title="No PT packages" />
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const left = p.sessionsTotal - p.sessionsUsed;
            const expired = new Date(p.validTo) < new Date(new Date().toDateString());
            const active = p.status === 'active' && !expired && left > 0;
            return (
              <li key={p._id} className="rounded-xl p-3 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {p.package?.name}{' '}
                      <Badge status={p.status === 'cancelled' ? 'cancelled' : active ? 'active' : 'expired'}>{p.status === 'cancelled' ? 'Cancelled' : active ? 'Active' : left === 0 ? 'Completed' : 'Expired'}</Badge>
                    </p>
                    <p className="text-sm text-slate-600">
                      {left} of {p.sessionsTotal} sessions left · with {p.trainerId?.name} · till {fmtDate(p.validTo)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      Total <b>{inr(p.totalAmount)}</b>
                    </p>
                    {p.dueAmount > 0 && <p className="text-rose-600">Due {inr(p.dueAmount)}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {active && can('pt.log') && (
                    <Button size="sm" onClick={() => setModal({ type: 'log', p: { ...p, memberId: member } })}>
                      Log session
                    </Button>
                  )}
                  {active && can('pt.log') && (
                    <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'book', p })}>
                      <CalendarPlus className="size-3.5" /> Book slot
                    </Button>
                  )}
                  {p.dueAmount > 0 && p.status === 'active' && can('payments.create') && (
                    <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'pay', p })}>
                      <IndianRupee className="size-3.5" /> Collect due
                    </Button>
                  )}
                  {p.invoiceId && can('payments.read') && (
                    <Button size="sm" variant="secondary" onClick={() => openFile(`/invoices/${p.invoiceId}/pdf`)}>
                      <FileText className="size-3.5" /> Invoice
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {bookings?.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Upcoming PT bookings</p>
          <ul className="space-y-1.5 text-sm">
            {bookings.map((b) => (
              <li key={b._id} className="flex flex-wrap items-center gap-2">
                <span>{fmtDateTime(b.startsAt)}</span> <span className="text-slate-500">with {b.trainerId?.name}</span> <BookingBadge status={b.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {modal?.type === 'sell' && <SellPtModal member={member} onClose={() => setModal(null)} />}
      {modal?.type === 'pay' && <PayPtModal purchase={modal.p} onClose={() => setModal(null)} />}
      {modal?.type === 'log' && <LogSessionModal purchase={modal.p} onClose={() => setModal(null)} />}
      {modal?.type === 'book' && <BookSlotModal member={member} purchase={modal.p} onClose={() => setModal(null)} />}
    </Card>
  );
}
