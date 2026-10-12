import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import dayjs from 'dayjs';
import { Check, X } from 'lucide-react';
import { post } from '../lib/api';
import { useAction, useApi } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, fmtDateTime, fromNow, toPaise, toRupees, ymd } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Table, Tabs, Textarea } from '../components/ui';

const STATE = {
  pending: ['contacted', 'Waiting'],
  approved: ['active', 'Approved'],
  rejected: ['deny', 'Rejected'],
  used: ['cancelled', 'Used'],
  expired: ['expired', 'Expired'],
};
export const StateBadge = ({ state }) => <Badge status={STATE[state]?.[0]}>{STATE[state]?.[1] || state}</Badge>;
const pctOf = (a) => (a.listPrice ? Math.round((a.requestedDiscount / a.listPrice) * 1000) / 10 : 0);
const who = (a) => (a.memberId ? `${a.memberId.name} #${a.memberId.memberCode}` : a.customerName || 'Walk-in');

/** Approve (optionally a smaller amount) or reject a request. */
export function DecisionModal({ approval, approve, onClose }) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(String(toRupees(approval.requestedDiscount)));
  const act = useAction(
    () => post(`/approvals/${approval._id}/${approve ? 'approve' : 'reject'}`, { note: note.trim() || undefined, ...(approve ? { approvedDiscount: toPaise(amount) } : {}) }),
    { success: approve ? 'Discount approved. Reception can complete the sale now.' : 'Request rejected', invalidate: ['approvals', 'dashboard', 'notifications'], onSuccess: onClose },
  );
  const tooHigh = approve && (toPaise(amount) < 1 || toPaise(amount) > approval.requestedDiscount);
  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? 'Approve discount' : 'Reject discount'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={approve ? 'success' : 'danger'} loading={act.isPending} disabled={tooHigh} onClick={() => act.mutate()}>
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium">{who(approval)}</p>
        <p className="text-slate-600">
          {approval.itemLabel} · list {inr(approval.listPrice)} · asks {inr(approval.requestedDiscount)} off ({pctOf(approval)}%)
        </p>
        <p className="mt-1 text-slate-600">
          “{approval.reason}” — {approval.requestedBy?.name}
        </p>
      </div>
      {approve && (
        <Field label="Approved discount (₹)" hint="You can approve less than asked. Valid for 24 hours, one sale.">
          <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      <Field label="Note (optional)" className="mt-3">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

/** Pending requests with Approve / Reject (dashboard card and the page). */
export function PendingList({ items }) {
  const [decide, setDecide] = useState(null);
  return (
    <>
      <ul className="divide-y divide-slate-100">
        {items.map((a) => (
          <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {inr(a.requestedDiscount)} off {a.itemLabel}
              </p>
              <p className="text-xs text-slate-500">
                {who(a)} · {a.requestedBy?.name} · {fromNow(a.createdAt)} · “{a.reason}”
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={() => setDecide({ approval: a, approve: true })}>
                <Check className="size-4" /> Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDecide({ approval: a, approve: false })}>
                <X className="size-4" /> Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {decide && <DecisionModal {...decide} onClose={() => setDecide(null)} />}
    </>
  );
}

const FREEZE_STATE = { pending: ['contacted', 'Waiting'], approved: ['active', 'Approved'], rejected: ['deny', 'Rejected'], cancelled: ['cancelled', 'Cancelled by member'] };
const lastDay = (from, days) => dayjs(from).add(days - 1, 'day');

function FreezeDecision({ request: r, approve, onClose }) {
  const startPassed = dayjs(r.from).isBefore(dayjs(), 'day');
  const [from, setFrom] = useState(startPassed ? ymd(dayjs().add(1, 'day')) : ymd(r.from));
  const [days, setDays] = useState(String(r.days));
  const [note, setNote] = useState('');
  const act = useAction(() => post(`/freeze-requests/${r._id}/${approve ? 'approve' : 'reject'}`, approve ? { from, days: Number(days), note: note.trim() || undefined } : { note: note.trim() }), {
    success: approve ? 'Freeze approved. The member is informed.' : 'Request rejected. The member is informed.',
    invalidate: ['freeze-requests', 'notifications'],
    onSuccess: onClose,
  });
  const a = r.allowance;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={approve ? 'Approve freeze' : 'Reject freeze'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={approve ? 'success' : 'danger'} loading={act.isPending} disabled={approve ? !from || !(Number(days) > 0) : note.trim().length < 2} onClick={() => act.mutate()}>
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium">
          {r.memberId?.name} #{r.memberId?.memberCode}
        </p>
        <p className="text-slate-600">
          Asks {fmtDate(r.from)} – {fmtDate(lastDay(r.from, r.days))} ({r.days} days): “{r.reason}”
        </p>
        {a && (
          <p className="mt-1 text-slate-600">
            {r.subscriptionId?.plan?.name}: {a.daysLeft} of {a.daysAllowed} freeze day(s) left, {a.freezesLeft} of {a.freezesAllowed} freeze(s) left
          </p>
        )}
      </div>
      {approve ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" hint={startPassed ? 'The asked date has passed' : undefined}>
            <Input type="date" min={ymd()} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Days">
            <Input type="number" min="1" max="180" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <p className="col-span-2 text-xs text-slate-500">Entry stops on these days and the end date moves forward. A future start waits for that day.</p>
          <Field label="Note (optional)" className="col-span-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      ) : (
        <Field label="Note for the member" required>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Please visit the desk…" />
        </Field>
      )}
    </Modal>
  );
}

/** Freeze requests sent from the member app. Reception and managers decide. */
function FreezeRequests() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [decide, setDecide] = useState(null);
  const { data } = useApi(['freeze-requests', status, page], '/freeze-requests', { status: status === 'all' ? '' : status, page }, { refetchInterval: 30000 });
  return (
    <>
      <Tabs
        value={status}
        onChange={(v) => (setPage(1), setStatus(v))}
        tabs={[
          { value: 'pending', label: 'Waiting', count: data?.pending ?? 0 },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Card padded={false}>
        {!data?.items?.length ? (
          <EmptyState title={status === 'pending' ? 'No freeze requests waiting' : 'Nothing here'}>
            Members ask for a freeze from the member app (Home &gt; Request a freeze). To freeze at the desk, open the member's page.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    <Link to={`/admin/members/${r.memberId?._id}`} className="text-brand-700 hover:underline">
                      {r.memberId?.name}
                    </Link>{' '}
                    <span className="text-slate-400">#{r.memberId?.memberCode}</span> <Badge status={FREEZE_STATE[r.status]?.[0]}>{FREEZE_STATE[r.status]?.[1]}</Badge>
                  </p>
                  <p className="text-sm text-slate-600">
                    {fmtDate(r.approvedFrom || r.from)} – {fmtDate(lastDay(r.approvedFrom || r.from, r.approvedDays || r.days))} ({r.approvedDays || r.days} days) · “{r.reason}”
                  </p>
                  <p className="text-xs text-slate-500">
                    Asked {fromNow(r.createdAt)}
                    {r.allowance && ` · ${r.allowance.daysLeft} freeze day(s) left`}
                    {r.decidedBy && ` · ${r.status} by ${r.decidedBy.name}`}
                    {r.decisionNote && ` · “${r.decisionNote}”`}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => setDecide({ request: r, approve: true })}>
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDecide({ request: r, approve: false })}>
                      <X className="size-4" /> Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>
      {decide && <FreezeDecision {...decide} onClose={() => setDecide(null)} />}
    </>
  );
}

export default function Approvals() {
  const can = useAuth((s) => s.can);
  const approver = can('discounts.approve');
  const freezer = can('subscriptions.write');
  const [params, setParams] = useSearchParams();
  const section = params.get('tab') === 'freeze' || !approver ? 'freeze' : 'discounts';
  const { data: freezeCount } = useApi(['freeze-requests', 'count'], '/freeze-requests', { status: 'pending', limit: 1 }, { enabled: freezer, refetchInterval: 60000 });
  return (
    <div>
      <PageHeader title="Approvals" subtitle={section === 'freeze' ? 'Freeze requests from the member app. Approving freezes the membership on those dates.' : 'Discounts above the reception limit wait here. Approved ones are valid for 24 hours and one sale.'} />
      {approver && freezer && (
        <Tabs
          value={section}
          onChange={(v) => setParams(v === 'freeze' ? { tab: 'freeze' } : {})}
          tabs={[
            { value: 'discounts', label: 'Discounts' },
            { value: 'freeze', label: 'Freeze requests', count: freezeCount?.pending ?? 0 },
          ]}
        />
      )}
      {section === 'freeze' ? <FreezeRequests /> : <DiscountApprovals />}
    </div>
  );
}

function DiscountApprovals() {
  const can = useAuth((s) => s.can);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [decide, setDecide] = useState(null);
  const { data } = useApi(['approvals', status, page], '/approvals', { status: status === 'all' ? '' : status, page }, { refetchInterval: 30000 });
  const approver = can('discounts.approve');
  return (
    <div>
      <Tabs
        value={status}
        onChange={(v) => (setPage(1), setStatus(v))}
        tabs={[
          { value: 'pending', label: 'Waiting', count: data?.pending ?? 0 },
          { value: 'approved', label: 'Approved' },
          { value: 'used', label: 'Used' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'expired', label: 'Expired' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Card padded={false}>
        <Table
          rows={data?.items}
          empty={
            <EmptyState title={status === 'pending' ? 'No requests waiting' : 'Nothing here'}>
              When reception gives more than the allowed discount, the request shows up here. Change the limit in <Link to="/admin/settings" className="text-brand-700 hover:underline">Settings</Link>.
            </EmptyState>
          }
          columns={[
            { key: 'at', label: 'Asked', render: (a) => <span title={fmtDateTime(a.createdAt)}>{fromNow(a.createdAt)}</span> },
            { key: 'm', label: 'Customer', render: (a) => (a.memberId ? <Link to={`/admin/members/${a.memberId._id}`} className="text-brand-700 hover:underline">{who(a)}</Link> : who(a)) },
            { key: 'i', label: 'Item', render: (a) => <span className="block max-w-56 truncate">{a.itemLabel}</span> },
            { key: 'p', label: 'List price', className: 'hidden md:table-cell', render: (a) => inr(a.listPrice) },
            { key: 'd', label: 'Discount', render: (a) => `${inr(a.approvedDiscount || a.requestedDiscount)} (${pctOf(a)}%)` },
            { key: 'r', label: 'Reason', className: 'hidden lg:table-cell', render: (a) => <span className="block max-w-56 truncate">{a.reason}</span> },
            { key: 'by', label: 'Asked by', className: 'hidden md:table-cell', render: (a) => a.requestedBy?.name },
            { key: 's', label: 'Status', render: (a) => <span title={a.decisionNote || ''}><StateBadge state={a.state} />{a.decidedBy && <span className="ml-1 text-xs text-slate-500">{a.decidedBy.name}</span>}</span> },
            {
              key: 'x',
              label: '',
              render: (a) =>
                approver && a.state === 'pending' ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="success" onClick={() => setDecide({ approval: a, approve: true })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDecide({ approval: a, approve: false })}>
                      Reject
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>
      {decide && <DecisionModal {...decide} onClose={() => setDecide(null)} />}
    </div>
  );
}
