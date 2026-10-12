import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { ArrowLeft, Snowflake } from 'lucide-react';
import { memberApi, errorMessage } from '../../lib/api';
import { fmtDate, ymd } from '../../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, PageLoader, Textarea } from '../../components/ui';
import { portalGet } from './PortalHome';

const STATE = { pending: ['contacted', 'Waiting'], approved: ['active', 'Approved'], rejected: ['deny', 'Not approved'], cancelled: ['cancelled', 'Cancelled'] };
export const FreezeStateBadge = ({ status }) => <Badge status={STATE[status]?.[0]}>{STATE[status]?.[1] || status}</Badge>;
const lastDay = (from, days) => dayjs(from).add(days - 1, 'day');

export default function PortalFreeze() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'freeze'], queryFn: () => portalGet('/me/freeze') });
  const tomorrow = ymd(dayjs().add(1, 'day'));
  const [f, setF] = useState({ from: tomorrow, days: '7', reason: '' });
  const [busy, setBusy] = useState(null);
  if (isLoading || !data) return <PageLoader />;
  const { subscription: sub, allowance: a, requests } = data;
  const pending = requests.find((r) => r.status === 'pending');
  const days = Number(f.days) || 0;
  const tooMany = a && days > a.daysLeft;

  async function act(key, fn, msg) {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: ['portal'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="text-lg font-semibold">Freeze membership</h1>

      {!sub ? (
        <Card>
          <EmptyState icon={Snowflake} title="No active membership">
            A freeze is possible on an active membership. Renew first, or ask at the reception.
          </EmptyState>
        </Card>
      ) : pending ? (
        <Card title="Request waiting">
          <p className="text-sm text-slate-700">
            {fmtDate(pending.from)} – {fmtDate(lastDay(pending.from, pending.days))} ({pending.days} days) <FreezeStateBadge status="pending" />
          </p>
          <p className="mt-1 text-xs text-slate-500">“{pending.reason}”. The gym will approve or reply soon.</p>
          <Button className="mt-3" size="sm" variant="secondary" loading={busy === 'cancel'} onClick={() => window.confirm('Cancel this freeze request?') && act('cancel', () => memberApi.client.post(`/me/freeze-requests/${pending._id}/cancel`), 'Request cancelled')}>
            Cancel request
          </Button>
        </Card>
      ) : !a.daysAllowed ? (
        <Card>
          <EmptyState icon={Snowflake} title="Your plan has no freeze days">
            Please talk to the reception if you need a break.
          </EmptyState>
        </Card>
      ) : (
        <Card title="Request a freeze">
          <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            {sub.plan?.name}: <b>{a.daysLeft}</b> of {a.daysAllowed} freeze day(s) left, {a.freezesLeft} of {a.freezesAllowed} freeze(s) left. Your end date moves forward by the frozen days.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input type="date" min={tomorrow} max={ymd(sub.endDate)} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            </Field>
            <Field label="Days" error={tooMany ? `Only ${a.daysLeft} day(s) left` : undefined}>
              <Input type="number" min="1" max={a.daysLeft} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
            </Field>
            <Field label="Reason" className="col-span-2">
              <Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Travel, illness, exams…" />
            </Field>
          </div>
          {days > 0 && f.from && <p className="mt-2 text-xs text-slate-500">Frozen from {fmtDate(f.from)} to {fmtDate(lastDay(f.from, days))}. No gym entry on these days.</p>}
          <Button
            className="mt-3 w-full"
            disabled={!f.from || days < 1 || tooMany || f.reason.trim().length < 3 || !a.freezesLeft}
            loading={busy === 'ask'}
            onClick={() => act('ask', () => memberApi.client.post('/me/freeze-requests', { subscriptionId: sub._id, from: f.from, days, reason: f.reason.trim() }), 'Freeze request sent. The gym will confirm.')}
          >
            Send request
          </Button>
          {!a.freezesLeft && <p className="mt-2 text-xs text-rose-600">All freezes on this plan are used.</p>}
        </Card>
      )}

      <Card title="My requests" padded={false}>
        {!requests.length ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No freeze requests yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => {
              const from = r.approvedFrom || r.from;
              const n = r.approvedDays || r.days;
              return (
                <li key={r._id} className="px-4 py-3">
                  <p className="flex items-center justify-between gap-2 text-sm font-medium">
                    {fmtDate(from)} – {fmtDate(lastDay(from, n))} <FreezeStateBadge status={r.status} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {n} day(s) · “{r.reason}”
                  </p>
                  {r.decisionNote && <p className="mt-1 text-xs text-slate-700">Gym: {r.decisionNote}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
