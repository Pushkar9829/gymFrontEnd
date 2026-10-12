import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Gift, Share2 } from 'lucide-react';
import { fmtDate } from '../../lib/format';
import { Button, Card, EmptyState, PageLoader } from '../../components/ui';
import { portalGet } from './PortalHome';

const FRIEND_STATUS = {
  pending: 'Joined, first payment pending',
  processing: 'Joined',
  waiting: 'Days added with your next membership',
  rewarded: 'Free days added',
  capped: 'Yearly reward limit reached',
  skipped: 'No reward',
  revoked: 'Cancelled, reward taken back',
};

export const inviteLink = (code) => `${window.location.origin}/join?ref=${encodeURIComponent(code)}`;
export function inviteText(info) {
  const off = info.friendDiscountPercent > 0 ? ` and get ${info.friendDiscountPercent}% off your first membership` : '';
  return `Join me at ${info.gymName}! Use my code ${info.code}${off}: ${inviteLink(info.code)}`;
}

/** Member app: my referral code and how to share it. */
export default function PortalInvite() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'referral'], queryFn: () => portalGet('/me/referral') });
  if (isLoading) return <PageLoader />;

  const back = (
    <button onClick={() => navigate('/portal')} className="inline-flex items-center gap-1 text-sm text-slate-500">
      <ArrowLeft className="size-4" /> Back
    </button>
  );
  if (!data?.enabled) {
    return (
      <div className="space-y-4">
        {back}
        <h1 className="text-lg font-semibold">Invite a friend</h1>
        <EmptyState title="Invites are not open right now">Ask at the reception about bringing a friend.</EmptyState>
      </div>
    );
  }
  const text = inviteText(data);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${data.gymName}`, text, url: inviteLink(data.code) });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open(whatsapp, '_blank', 'noopener');
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Invite copied');
    } catch {
      toast.error('Could not copy. Long-press the code to copy it.');
    }
  }

  return (
    <div className="space-y-4">
      {back}
      <h1 className="text-lg font-semibold">Invite a friend</h1>
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-center text-white shadow-md">
        <Gift className="mx-auto size-8" />
        <p className="mt-2 text-sm text-white/90">Your invite code</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-widest select-all" data-testid="referral-code">
          {data.code}
        </p>
        <p className="mt-3 text-sm text-white/90">
          When a friend joins with your code and pays for their first membership, you get <b>{data.rewardDays} free days</b>.
          {data.friendDiscountPercent > 0 && ` Your friend gets ${data.friendDiscountPercent}% off.`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={share}>
          <Share2 className="size-4" /> Share
        </Button>
        <Button size="lg" variant="secondary" onClick={copy}>
          <Copy className="size-4" /> Copy
        </Button>
      </div>
      <a href={whatsapp} target="_blank" rel="noreferrer" className="block text-center text-sm font-medium text-emerald-700">
        Send on WhatsApp
      </a>
      <Card title="Friends who joined" padded={false}>
        {data.referrals.length ? (
          <ul className="divide-y divide-slate-100">
            {data.referrals.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <b>{r.name}</b>
                  <span className="block text-xs text-slate-500">{fmtDate(r.createdAt)}</span>
                </span>
                <span className={`text-right text-xs ${r.status === 'rewarded' ? 'font-medium text-emerald-700' : 'text-slate-500'}`}>
                  {FRIEND_STATUS[r.status] || r.status}
                  {r.status === 'rewarded' && r.rewardDays ? ` (+${r.rewardDays})` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No friends yet. Share your code to invite one.</p>
        )}
      </Card>
    </div>
  );
}
