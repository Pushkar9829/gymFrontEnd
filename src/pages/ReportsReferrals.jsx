import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '../lib/hooks';
import { fmtDate } from '../lib/format';
import { Badge, Card, EmptyState, Pagination, Select, StatCard, Table } from '../components/ui';

export const REFERRAL_LABEL = {
  pending: 'Waiting for first payment',
  processing: 'Updating',
  waiting: 'Owed: no membership to extend',
  rewarded: 'Rewarded',
  capped: 'Yearly limit reached',
  skipped: 'Not rewarded',
  revoked: 'Taken back',
};
const STYLE = { pending: 'upcoming', waiting: 'contacted', rewarded: 'allow', capped: 'cancelled', skipped: 'cancelled', revoked: 'deny' };
export const ReferralBadge = ({ status }) => <Badge status={STYLE[status] || 'none'}>{REFERRAL_LABEL[status] || status}</Badge>;

/** Reports > Referrals: who referred whom and what they got. */
export function ReferralsReport() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useApi('referrals', '/referrals', { status, page });
  const s = data?.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Friends referred" value={(data && Object.entries(s).filter(([k]) => k !== 'daysGiven').reduce((a, [, n]) => a + n, 0)) || 0} />
        <StatCard label="Rewarded" value={s.rewarded || 0} tone="green" />
        <StatCard label="Waiting for payment" value={s.pending || 0} tone="indigo" />
        <StatCard label="Free days given" value={s.daysGiven || 0} tone="amber" />
      </div>
      <Card
        title="Referrals"
        padded={false}
        actions={
          <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-auto" aria-label="Status">
            <option value="">All</option>
            {Object.entries(REFERRAL_LABEL)
              .filter(([k]) => k !== 'processing')
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </Select>
        }
      >
        <Table
          rows={data?.items}
          empty={<EmptyState title="No referrals yet">Members share their code from the member app, or the desk picks "Referred by" when registering.</EmptyState>}
          columns={[
            { key: 'at', label: 'Date', render: (r) => fmtDate(r.createdAt) },
            {
              key: 'by',
              label: 'Referred by',
              render: (r) =>
                r.referrerId ? (
                  <button className="font-medium text-brand-700 hover:underline" onClick={() => navigate(`/admin/members/${r.referrerId._id}`)}>
                    {r.referrerId.name} <span className="text-slate-400">#{r.referrerId.memberCode}</span>
                  </button>
                ) : (
                  '—'
                ),
            },
            {
              key: 'friend',
              label: 'New member',
              render: (r) =>
                r.referredId ? (
                  <button className="font-medium text-brand-700 hover:underline" onClick={() => navigate(`/admin/members/${r.referredId._id}`)}>
                    {r.referredId.name} <span className="text-slate-400">#{r.referredId.memberCode}</span>
                  </button>
                ) : (
                  '—'
                ),
            },
            { key: 'src', label: 'How', render: (r) => (r.source === 'online' ? 'Joined online' : 'At the desk') },
            { key: 'status', label: 'Status', render: (r) => <ReferralBadge status={r.status} /> },
            {
              key: 'reward',
              label: 'Reward',
              className: 'whitespace-normal',
              render: (r) => (
                <span className="text-xs">
                  {r.status === 'rewarded' ? `+${r.rewardDays} days${r.rewardSubscriptionId ? ` · now ends ${fmtDate(r.rewardSubscriptionId.endDate)}` : ''}` : r.note || `${r.rewardDays ?? 0} days`}
                </span>
              ),
            },
          ]}
        />
        <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
      </Card>
    </div>
  );
}
