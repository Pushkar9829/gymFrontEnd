import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Hourglass } from 'lucide-react';
import { get, post } from '../lib/api';
import { useAction } from '../lib/hooks';
import { inr, fmtDateTime, fromNow } from '../lib/format';
import { Button, Field, Textarea } from './ui';

/** The API refused a discount above the receptionist limit. */
export const needsApproval = (err) => err?.response?.data?.code === 'DISCOUNT_APPROVAL_REQUIRED';

/**
 * Shown on a sale form after the API asked for approval: ask the owner/manager, wait, then complete the sale.
 * request: { kind, memberId?, branchId?, planId?, packageId?, items?, waiveJoiningFee?, discount }
 */
export function DiscountApproval({ request, onComplete, completing }) {
  const [reason, setReason] = useState('');
  const [id, setId] = useState(null);
  const { data: a } = useQuery({
    queryKey: ['approval', id],
    queryFn: () => get(`/approvals/${id}`),
    enabled: Boolean(id),
    refetchInterval: (q) => (!q.state.data || q.state.data.state === 'pending' ? 4000 : false),
  });
  const ask = useAction(() => post('/approvals', { ...request, reason: reason.trim() }), {
    success: 'Approval requested. The owner and manager have been alerted.',
    invalidate: ['approvals'],
    onSuccess: (r) => setId(r._id),
  });

  if (!id) {
    return (
      <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <ShieldAlert className="size-4" /> {inr(request.discount)} off needs approval from the owner or manager.
        </p>
        <Field label="Reason for the discount" className="mt-2">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Corporate referral, long-time member" />
        </Field>
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={ask.isPending} disabled={reason.trim().length < 3} onClick={() => ask.mutate()}>
            Request approval
          </Button>
        </div>
      </div>
    );
  }
  const state = a?.state || 'pending';
  if (state === 'pending') {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
        <Hourglass className="size-4 animate-pulse" /> Waiting for approval… asked {fromNow(a?.createdAt)}. You can close this and finish later from the same screen.
      </p>
    );
  }
  if (state === 'approved') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
        <p className="flex items-center gap-2 text-sm text-emerald-900">
          <ShieldCheck className="size-4" /> Approved by {a.decidedBy?.name} — {inr(a.approvedDiscount)} off
          {a.decisionNote ? ` (${a.decisionNote})` : ''}
        </p>
        <Button size="sm" variant="success" loading={completing} onClick={() => onComplete(a)}>
          Complete sale
        </Button>
      </div>
    );
  }
  return (
    <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
      {state === 'rejected' ? `Rejected by ${a.decidedBy?.name}${a.decisionNote ? `: ${a.decisionNote}` : ''}. Lower the discount to continue.` : state === 'expired' ? 'This approval has expired. Ask again.' : 'This approval was already used.'}
    </p>
  );
}

/** Approved discounts waiting to be used for this member (e.g. approved after the form was closed). */
export function UsableApprovals({ kind, memberId, selectedId, onUse }) {
  const { data } = useQuery({ queryKey: ['approvals', 'usable', kind, memberId], queryFn: () => get('/approvals/usable', { kind, memberId }), enabled: Boolean(memberId) });
  if (!data?.length) return null;
  return (
    <ul className="space-y-2">
      {data.map((a) => (
        <li key={a._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200">
          <span className="text-emerald-900">
            <ShieldCheck className="mr-1 inline size-4" />
            Approved by {a.decidedBy?.name}: {inr(a.approvedDiscount)} off {a.itemLabel} (valid till {fmtDateTime(a.expiresAt)})
          </span>
          {selectedId === a._id ? (
            <span className="text-xs font-semibold text-emerald-700">In use</span>
          ) : (
            <Button size="sm" variant="success" onClick={() => onUse(a)}>
              Use approval
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
