import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft, Pencil, Plus, IndianRupee, Snowflake, Ban, ShieldCheck, ShieldX, Smartphone, FileText, Trash2,
  RefreshCw, Fingerprint, QrCode, ArrowUpCircle, XCircle, Play, Undo2, Link2, Copy, Printer, Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { get, post, put as apiPut, del, openFile } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { inr, fmtDate, fmtDateTime, fmtTime, daysUntil } from '../../lib/format';
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageLoader, Table, Tabs, Toggle } from '../../components/ui';
import MemberForm from './MemberForm';
import MemberPt from './MemberPt';
import MemberDocuments from './MemberDocuments';
import MemberAutopay from './MemberAutopay';
import MemberLocker from './MemberLocker';
import MemberFitness from '../fitness/MemberFitness';
import { MembershipModal, PaymentModal, FreezeModal, ChangePlanModal, ReasonModal, RefundModal, PortalModal } from './MemberModals';
import { TrialActions, TrialBadge } from '../Trials';
import { useMemberWaiver, WaiverBadge, WaiverActions } from './MemberWaiver';

function trialState(member) {
  const t = member.trial || {};
  if (!member.isTrial) return 'converted';
  if (t.endedAt || daysUntil(t.to) < 0) return 'ended';
  return daysUntil(t.from) > 0 ? 'upcoming' : 'active';
}

function TrialCard({ member, visits }) {
  const t = member.trial || {};
  const state = trialState(member);
  return (
    <div className="mt-4 rounded-xl bg-violet-50 p-4 ring-1 ring-violet-200">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-violet-900">
        <Ticket className="size-4" /> {member.isTrial ? 'Trial pass' : 'Joined after a trial pass'} <TrialBadge status={state} />
      </p>
      <p className="mt-1 text-sm text-violet-800">
        {fmtDate(t.from)} – {fmtDate(t.to)} · {visits} visit(s){t.fee ? ` · fee ${inr(t.fee)}` : ' · free'}
        {t.override ? ' · repeat allowed by manager' : ''}
      </p>
      {member.isTrial && <p className="mt-1 text-xs text-violet-700">Not counted as a member. Convert to member to add a membership.</p>}
      {member.isTrial && (
        <div className="mt-3">
          <TrialActions trial={{ ...member, status: state }} size="md" />
        </div>
      )}
    </div>
  );
}

function AccessBanner({ access, member }) {
  const ok = access.allowed;
  return (
    <div className={clsx('flex items-center gap-3 rounded-xl p-4 ring-1', ok ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200')}>
      {ok ? <ShieldCheck className="size-8 shrink-0 text-emerald-600" /> : <ShieldX className="size-8 shrink-0 text-rose-600" />}
      <div>
        <p className={clsx('font-semibold', ok ? 'text-emerald-800' : 'text-rose-800')}>{ok ? 'Entry allowed' : 'No entry'}</p>
        <p className={clsx('text-sm', ok ? 'text-emerald-700' : 'text-rose-700')}>{access.reason}</p>
        {member.dueAmount > 0 && <p className="mt-0.5 text-sm font-medium text-amber-700">Pending dues: {inr(member.dueAmount)}</p>}
      </div>
    </div>
  );
}

function subState(s) {
  if (s.status === 'cancelled') return 'cancelled';
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(s.startDate).toISOString().slice(0, 10);
  if (daysUntil(s.endDate) < 0) return 'expired';
  if (start > today && daysUntil(s.startDate) > 0) return 'upcoming';
  const frozen = s.freezes?.some((f) => !f.endedEarlyAt && daysUntil(f.from) <= 0 && daysUntil(f.to) >= 0);
  return frozen ? 'frozen' : 'active';
}

function Memberships({ subscriptions, member, onAction }) {
  const can = useAuth((s) => s.can);
  if (!subscriptions.length) return <EmptyState title="No memberships yet">Add a membership to give gym access.</EmptyState>;
  return (
    <div className="space-y-3">
      {subscriptions.map((s) => {
        const state = subState(s);
        const live = s.status === 'active' && state !== 'expired';
        const runningFreeze = s.freezes?.find((f) => !f.endedEarlyAt && daysUntil(f.to) >= 0);
        return (
          <div key={s._id} className="rounded-xl p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {s.plan?.name} <Badge status={state} className="ml-1" />
                  <span className="ml-2 text-xs font-normal text-slate-500 capitalize">{s.type}</span>
                </p>
                <p className="text-sm text-slate-600">
                  {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                  {s.originalEndDate && new Date(s.originalEndDate).getTime() !== new Date(s.endDate).getTime() && (
                    <span className="text-xs text-slate-400"> (was {fmtDate(s.originalEndDate)})</span>
                  )}
                </p>
                {s.cancelReason && <p className="text-xs text-slate-500">Cancelled: {s.cancelReason}</p>}
                {s.groupOf && <p className="text-xs text-emerald-700">Covered by a family plan (billed to the main member)</p>}
                {s.familyMemberIds?.length > 0 && <p className="text-xs text-emerald-700">Family plan: also covers {s.familyMemberIds.length} other member(s)</p>}
                {s.billTo === 'company' && <p className="text-xs text-indigo-700">Billed to company</p>}
              </div>
              <div className="text-right text-sm">
                <p>
                  Total <b>{inr(s.totalAmount)}</b> · Paid {inr(s.paidAmount)}
                </p>
                {s.dueAmount > 0 && <p className="font-medium text-rose-600">Due {inr(s.dueAmount)}</p>}
              </div>
            </div>
            {s.freezes?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-indigo-700">
                {s.freezes.map((f) => (
                  <li key={f._id}>
                    <Snowflake className="mr-1 inline size-3" />
                    Frozen {fmtDate(f.from)} – {fmtDate(f.endedEarlyAt ? new Date(new Date(f.endedEarlyAt) - 86400000) : f.to)} ({f.days} days){f.reason ? ` · ${f.reason}` : ''}
                    {f.endedEarlyAt && ' · ended early'}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {s.invoiceId && (
                <Button size="sm" variant="secondary" onClick={() => openFile(`/invoices/${s.invoiceId}/pdf`)}>
                  <FileText className="size-3.5" /> Invoice
                </Button>
              )}
              {live && s.dueAmount > 0 && can('payments.create') && (
                <Button size="sm" onClick={() => onAction('pay', s)}>
                  <IndianRupee className="size-3.5" /> Collect due
                </Button>
              )}
              {live && s.dueAmount > 0 && can('payments.create') && (
                <Button size="sm" variant="secondary" onClick={() => onAction('link', s)}>
                  <Link2 className="size-3.5" /> Payment link
                </Button>
              )}
              {live && !runningFreeze && can('subscriptions.write') && (
                <Button size="sm" variant="secondary" onClick={() => onAction('freeze', s)}>
                  <Snowflake className="size-3.5" /> Freeze
                </Button>
              )}
              {live && runningFreeze && can('subscriptions.write') && (
                <Button size="sm" variant="secondary" onClick={() => onAction('unfreeze', s, runningFreeze)}>
                  <Play className="size-3.5" /> {daysUntil(runningFreeze.from) > 0 ? 'Remove planned freeze' : 'End freeze now'}
                </Button>
              )}
              {state === 'active' && can('subscriptions.write') && (
                <Button size="sm" variant="secondary" onClick={() => onAction('change', s)}>
                  <ArrowUpCircle className="size-3.5" /> Change plan
                </Button>
              )}
              {live && can('subscriptions.cancel') && (
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => onAction('cancel', s)}>
                  <XCircle className="size-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {member.isDeleted && <p className="text-sm text-rose-600">This member was deleted.</p>}
    </div>
  );
}

function Biometric({ member, deviceUsers, onSaved }) {
  const can = useAuth((s) => s.can);
  const bio = member.biometric || {};
  const save = useAction((body) => apiPut(`/members/${member._id}/biometric`, body), { success: 'Saved', invalidate: ['member'], onSuccess: onSaved });
  const resync = useAction(() => post(`/members/${member._id}/resync`), { success: 'Re-sync queued to devices', invalidate: ['member'] });
  const update = (body) => save.mutate(body);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Enrolment">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">
            Device user ID: <b className="font-mono text-base text-slate-900">{member.memberCode}</b>. Enrol the finger/face on the device using this ID.
          </p>
          {bio.consentAt ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Biometric consent recorded on {fmtDateTime(bio.consentAt)}</p>
          ) : (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              Consent not recorded. Fingerprint/face data is stored only on the device.
              {can('members.write') && (
                <Button size="sm" className="mt-2" loading={save.isPending} onClick={() => update({ consent: true })}>
                  Record consent
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Toggle checked={!!bio.fingerEnrolled} disabled={!bio.consentAt || !can('members.write')} onChange={(v) => update({ fingerEnrolled: v })} label="Fingerprint enrolled on device" />
            <Toggle checked={!!bio.faceEnrolled} disabled={!bio.consentAt || !can('members.write')} onChange={(v) => update({ faceEnrolled: v })} label="Face enrolled on device" />
          </div>
        </div>
      </Card>
      <Card
        title="Device access"
        actions={
          can('members.write') && (
            <Button size="sm" variant="secondary" loading={resync.isPending} onClick={() => resync.mutate()}>
              <RefreshCw className="size-3.5" /> Re-sync
            </Button>
          )
        }
      >
        {deviceUsers.length ? (
          <ul className="space-y-3 text-sm">
            {deviceUsers.map((du) => (
              <li key={du._id} className="rounded-lg p-3 ring-1 ring-slate-200">
                <p className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-2">
                    <Fingerprint className="size-4 text-slate-400" /> {du.deviceId?.name}
                  </span>
                  <Badge status={du.enabled ? 'allow' : 'deny'}>{du.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </p>
                {du.enabled && (
                  <p className="mt-1 text-slate-600">
                    Door opens from {fmtDate(du.validFrom)} to {fmtDate(du.validTo)}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {du.lastConfirmedAt && new Date(du.lastConfirmedAt) >= new Date(du.lastQueuedAt) ? `Confirmed by device ${fmtDateTime(du.lastConfirmedAt)}` : `Waiting for device to pick up (queued ${fmtDateTime(du.lastQueuedAt)})`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Not on any device yet. The member is added automatically once they have an active membership and a device exists in their branch.</p>
        )}
      </Card>
    </div>
  );
}

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const [tab, setTab] = useState('memberships');
  const [modal, setModal] = useState(null); // { type, sub, extra }
  const [params, setParams] = useSearchParams();

  const { data, isLoading, refetch } = useQuery({ queryKey: ['member', id], queryFn: () => get(`/members/${id}`) });
  const { data: timeline } = useQuery({ queryKey: ['member', id, 'timeline'], queryFn: () => get(`/members/${id}/timeline`) });
  const { data: card } = useQuery({ queryKey: ['member', id, 'card'], queryFn: () => get(`/members/${id}/card`), enabled: modal?.type === 'card' });
  const { data: waiver } = useMemberWaiver(id);

  const close = () => setModal(null);
  const blockAction = useAction((reason) => post(`/members/${id}/block`, { reason }), { success: 'Member blocked. Device access removed.', invalidate: ['member', 'members'], onSuccess: close });
  const unblock = useAction(() => post(`/members/${id}/unblock`), { success: 'Member unblocked', invalidate: ['member', 'members'] });
  const cancel = useAction(({ sub, reason }) => post(`/subscriptions/${sub._id}/cancel`, { reason }), { success: 'Membership cancelled', invalidate: ['member', 'members', 'dashboard'], onSuccess: close });
  const unfreeze = useAction(({ sub, freeze }) => post(`/subscriptions/${sub._id}/freezes/${freeze._id}/end`), { success: 'Freeze ended. Access restored.', invalidate: ['member', 'members'] });
  const link = useAction((sub) => post('/online-payments/link', { subscriptionId: sub._id }), { onSuccess: (d) => setModal({ type: 'linkResult', extra: d }) });
  const remove = useAction(() => del(`/members/${id}`), { success: 'Member deleted', invalidate: ['members'], onSuccess: () => navigate('/admin/members') });

  // Coming from "Convert to member": open the membership form straight away.
  const addNow = params.get('add') === 'membership' && data && !data.member.isTrial;
  useEffect(() => {
    if (!addNow) return;
    setModal({ type: 'membership' });
    setParams({}, { replace: true });
  }, [addNow, setParams]);

  if (isLoading || !data) return <PageLoader />;
  const { member, access, subscriptions, deviceUsers } = data;
  const isFirst = subscriptions.length === 0;

  const onAction = (type, sub, extra) => {
    if (type === 'unfreeze') return unfreeze.mutate({ sub, freeze: extra });
    if (type === 'link') return link.mutate(sub);
    setModal({ type, sub, extra });
  };

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={member.name} src={member.photoUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-slate-900">
                {member.name} {member.isBlocked && <Badge status="deny">Blocked</Badge>}
              </h1>
              <p className="text-sm text-slate-500">
                #{member.memberCode} · {member.phone}
                {member.email && ` · ${member.email}`}
              </p>
              <p className="text-sm text-slate-500">
                {member.branchId?.name} · Joined {fmtDate(member.joinedAt)}
                {member.trainerId && ` · Trainer: ${member.trainerId.name}`}
                {member.companyId && ` · ${member.companyId.name}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {member.isTrial ? <Badge status="trial">Trial visitor</Badge> : <Badge status={member.membershipStatus} />}
                {member.currentPlanName && <span className="text-sm text-slate-600">{member.currentPlanName}</span>}
                {member.membershipEnd && <span className="text-sm text-slate-500">till {fmtDate(member.membershipEnd)}</span>}
                <WaiverBadge waiver={waiver} />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {can('subscriptions.write') && !member.isTrial && (
              <Button onClick={() => setModal({ type: 'membership' })}>
                <Plus className="size-4" /> {isFirst ? 'Add membership' : 'Renew'}
              </Button>
            )}
            {can('members.write') && (
              <Button variant="secondary" onClick={() => setModal({ type: 'edit' })}>
                <Pencil className="size-4" /> Edit
              </Button>
            )}
            <Button variant="secondary" onClick={() => setModal({ type: 'card' })}>
              <QrCode className="size-4" /> QR card
            </Button>
            <WaiverActions member={member} waiver={waiver} />
            {can('members.write') && !member.isTrial && (
              <Button variant="secondary" onClick={() => setModal({ type: 'portal' })}>
                <Smartphone className="size-4" /> App access {member.portalEnabled ? '(on)' : ''}
              </Button>
            )}
            {can('members.write') &&
              (member.isBlocked ? (
                <Button variant="secondary" loading={unblock.isPending} onClick={() => unblock.mutate()}>
                  <Undo2 className="size-4" /> Unblock
                </Button>
              ) : (
                <Button variant="ghost" className="text-rose-600" onClick={() => setModal({ type: 'block' })}>
                  <Ban className="size-4" /> Block entry
                </Button>
              ))}
            {can('members.delete') && (
              <Button variant="ghost" className="text-rose-600" onClick={() => setModal({ type: 'delete' })}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>
          {member.trial?.issuedAt && <TrialCard member={member} visits={(timeline?.attendance || []).filter((a) => a.isTrial).length} />}
        </Card>
        <div className="space-y-4">
          <AccessBanner access={access} member={member} />
          <MemberAutopay member={member} />
          <MemberLocker member={member} />
          <MemberDocuments member={member} />
          <Card title="Details">
            <dl className="space-y-1.5 text-sm">
              {[
                ['Gender', member.gender],
                ['Date of birth', member.dob && fmtDate(member.dob)],
                ['Address', member.address],
                ['Emergency', member.emergencyContact?.name && `${member.emergencyContact.name} (${member.emergencyContact.relation || '-'}) ${member.emergencyContact.phone || ''}`],
                ['Health notes', member.healthNotes],
                ['Last visit', member.lastVisitAt && fmtDateTime(member.lastVisitAt)],
                ['RFID card', member.cardNo],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
                  <dd className="text-slate-800">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'memberships', label: 'Memberships', count: subscriptions.length },
            { value: 'pt', label: 'Personal training' },
            ...(can('fitness.read') ? [{ value: 'fitness', label: 'Fitness' }] : []),
            { value: 'payments', label: 'Payments' },
            { value: 'attendance', label: 'Attendance & entry log' },
            { value: 'biometric', label: 'Biometric' },
          ]}
        />
        {tab === 'memberships' && <Memberships subscriptions={subscriptions} member={member} onAction={onAction} />}
        {tab === 'pt' && <MemberPt member={member} />}
        {tab === 'fitness' && <MemberFitness member={member} />}
        {tab === 'payments' && (
          <Card padded={false}>
            <Table
              rows={timeline?.payments}
              empty={<EmptyState title="No payments yet" />}
              columns={[
                { key: 'receiptNo', label: 'Receipt' },
                { key: 'paidAt', label: 'Date', render: (p) => fmtDateTime(p.paidAt) },
                { key: 'type', label: 'Type', render: (p) => <Badge status={p.type === 'refund' ? 'deny' : 'allow'}>{p.type}</Badge> },
                { key: 'mode', label: 'Mode', render: (p) => p.mode.toUpperCase() },
                { key: 'amount', label: 'Amount', render: (p) => <b className={p.type === 'refund' ? 'text-rose-600' : ''}>{p.type === 'refund' ? '-' : ''}{inr(p.amount)}</b> },
                { key: 'by', label: 'By', render: (p) => p.receivedBy?.name || '—' },
                {
                  key: 'actions',
                  label: '',
                  render: (p) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openFile(`/payments/${p._id}/receipt.pdf`)}>
                        <Printer className="size-3.5" /> Print receipt
                      </Button>
                      {p.type === 'payment' && can('payments.refund') && (
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setModal({ type: 'refund', extra: p })}>
                          Refund
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        )}
        {tab === 'attendance' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Visits" padded={false}>
              <Table
                rows={timeline?.attendance}
                empty={<EmptyState title="No visits yet" />}
                columns={[
                  { key: 'day', label: 'Date', render: (a) => fmtDate(a.checkInAt) },
                  { key: 'in', label: 'In', render: (a) => fmtTime(a.checkInAt) },
                  { key: 'out', label: 'Out', render: (a) => fmtTime(a.checkOutAt) },
                  { key: 'method', label: 'Via', render: (a) => a.method },
                ]}
              />
            </Card>
            <Card title="Entry log (allowed & denied)" padded={false}>
              <Table
                rows={timeline?.accessLogs}
                empty={<EmptyState title="No entries yet" />}
                columns={[
                  { key: 'at', label: 'Time', render: (l) => fmtDateTime(l.at) },
                  { key: 'result', label: 'Result', render: (l) => <Badge status={l.result}>{l.result === 'allow' ? 'Allowed' : 'Denied'}</Badge> },
                  { key: 'reason', label: 'Reason', className: 'whitespace-normal', render: (l) => <span className="text-xs">{l.reason}</span> },
                  { key: 'source', label: 'Via', render: (l) => l.deviceId?.name || l.source },
                ]}
              />
            </Card>
          </div>
        )}
        {tab === 'biometric' && <Biometric member={member} deviceUsers={deviceUsers} onSaved={refetch} />}
      </div>

      <MemberForm open={modal?.type === 'edit'} onClose={close} member={member} />
      <MembershipModal open={modal?.type === 'membership'} onClose={close} member={member} isFirst={isFirst} />
      <PaymentModal open={modal?.type === 'pay'} onClose={close} subscription={modal?.sub} />
      <FreezeModal open={modal?.type === 'freeze'} onClose={close} subscription={modal?.sub} canOverride={['owner', 'manager'].includes(user.role)} />
      <ChangePlanModal open={modal?.type === 'change'} onClose={close} subscription={modal?.sub} branchId={member.branchId?._id} />
      <RefundModal open={modal?.type === 'refund'} onClose={close} payment={modal?.extra} />
      <PortalModal open={modal?.type === 'portal'} onClose={close} member={member} />
      <ReasonModal
        open={modal?.type === 'cancel'}
        onClose={close}
        title="Cancel membership"
        description="Gym entry stops immediately and pending dues are written off. Refunds are recorded separately from the Payments tab."
        confirmLabel="Cancel membership"
        loading={cancel.isPending}
        onConfirm={(reason) => cancel.mutate({ sub: modal.sub, reason })}
      />
      <ReasonModal
        open={modal?.type === 'block'}
        onClose={close}
        title="Block entry"
        description="The member will be disabled on all biometric devices and refused at reception until unblocked."
        confirmLabel="Block"
        loading={blockAction.isPending}
        onConfirm={(reason) => blockAction.mutate(reason)}
      />
      <Modal
        open={modal?.type === 'delete'}
        onClose={close}
        title="Delete member?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Keep
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {member.name} will be hidden from lists and removed from all biometric devices (including fingerprints). Payment history is kept.
        </p>
      </Modal>
      <Modal open={modal?.type === 'linkResult'} onClose={close} title="Payment link sent" size="sm">
        <p className="text-sm text-slate-600">Razorpay has sent this link to the member by SMS{member.email ? ' and email' : ''}. It is valid for 7 days. The due is cleared automatically when they pay.</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2">
          <code className="flex-1 truncate text-sm">{modal?.extra?.shortUrl}</code>
          <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(modal.extra.shortUrl).then(() => toast.success('Copied'))}>
            <Copy className="size-3.5" />
          </Button>
        </div>
        <a
          className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/91${member.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hi ${member.name}, please pay your gym membership due of ${inr(modal?.extra?.amount || 0)} here: ${modal?.extra?.shortUrl}`)}`}
        >
          Share on WhatsApp
        </a>
      </Modal>
      <Modal open={modal?.type === 'card'} onClose={close} title="Membership QR card" size="sm">
        <div className="flex flex-col items-center text-center">
          {card ? <img src={card.qr} alt="QR code" className="size-56" /> : <div className="size-56 animate-pulse rounded-lg bg-slate-100" />}
          <p className="mt-2 font-semibold">{member.name}</p>
          <p className="text-sm text-slate-500">Member #{member.memberCode}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </Modal>
    </div>
  );
}
