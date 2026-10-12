import { useState } from 'react';
import { Link } from 'react-router';
import { Check, X } from 'lucide-react';
import { post } from '../lib/api';
import { useAction, useApi } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDateTime, fromNow, toPaise, toRupees } from '../lib/format';
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

export default function Approvals() {
  const can = useAuth((s) => s.can);
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [decide, setDecide] = useState(null);
  const { data } = useApi(['approvals', status, page], '/approvals', { status: status === 'all' ? '' : status, page }, { refetchInterval: 30000 });
  const approver = can('discounts.approve');
  return (
    <div>
      <PageHeader title="Discount approvals" subtitle="Discounts above the reception limit wait here. Approved ones are valid for 24 hours and one sale." />
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
