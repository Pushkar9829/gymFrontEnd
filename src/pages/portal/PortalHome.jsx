import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { openCheckout } from '../../lib/razorpay';
import { errorMessage } from '../../lib/api';
import clsx from 'clsx';
import { ShieldCheck, ShieldX, FileText, Phone, MapPin, Clock, KeyRound, MessageSquareText, ChevronRight, CalendarPlus, Snowflake, FileSignature, Flame, Gift, Award } from 'lucide-react';
import { memberApi, openFile } from '../../lib/api';
import { inr, fmtDate, fmtTime } from '../../lib/format';
import { Badge, Button, Card, PageLoader } from '../../components/ui';
import { MemberAvatar } from '../../components/MemberAvatar';
import AppSetup from './AppSetup';

export const portalGet = (url, params) => memberApi.client.get(url, { params }).then((r) => r.data.data);

export default function PortalHome() {
  const { data, isLoading } = useQuery({ queryKey: ['portal'], queryFn: () => portalGet('/me') });
  const { data: cfg } = useQuery({ queryKey: ['portal', 'paycfg'], queryFn: () => portalGet('/me/pay/config') });
  const { data: pt } = useQuery({ queryKey: ['portal', 'pt'], queryFn: () => portalGet('/me/pt') });
  const { data: autopay } = useQuery({ queryKey: ['portal', 'autopay'], queryFn: () => portalGet('/me/autopay') });
  const { data: locker } = useQuery({ queryKey: ['portal', 'locker'], queryFn: () => portalGet('/me/locker') });
  const { data: waiver } = useQuery({ queryKey: ['portal', 'waiver'], queryFn: () => portalGet('/me/waiver') });
  const { data: freeze } = useQuery({ queryKey: ['portal', 'freeze'], queryFn: () => portalGet('/me/freeze') });
  const { data: ptBooking } = useQuery({ queryKey: ['portal', 'pt-booking'], queryFn: () => portalGet('/me/pt-booking') });
  const { data: progress } = useQuery({ queryKey: ['portal', 'progress-summary'], queryFn: () => portalGet('/me/progress-summary') });
  const { data: referral } = useQuery({ queryKey: ['portal', 'referral'], queryFn: () => portalGet('/me/referral') });
  const navigate = useNavigate();
  const signNow = Boolean(waiver?.pending && waiver?.ask);
  // First visit in this session: open the waiver straight away while it is unsigned ("Later" comes back here).
  useEffect(() => {
    if (!signNow) return;
    try {
      if (sessionStorage.getItem('gym.waiverPrompted')) return;
      sessionStorage.setItem('gym.waiverPrompted', '1');
    } catch {
      return;
    }
    navigate('/portal/waiver');
  }, [signNow, navigate]);
  const nextPt = (ptBooking?.bookings || []).filter((b) => b.status === 'booked' && new Date(b.startsAt) > new Date()).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const lastFreeze = freeze?.requests?.[0];
  const freezeNote = lastFreeze && (lastFreeze.status === 'pending' || Date.now() - new Date(lastFreeze.updatedAt) < 14 * 86400000) ? lastFreeze : null;
  const autopayOn = autopay && ['created', 'authenticated', 'active', 'pending', 'halted', 'paused'].includes(autopay.status);
  const activePt = (pt?.purchases || []).filter((p) => p.status === 'active' && p.sessionsUsed < p.sessionsTotal && new Date(p.validTo) >= new Date(new Date().toDateString()));
  const qc = useQueryClient();
  const [paying, setPaying] = useState(null);
  async function payDue(sub) {
    setPaying(sub._id);
    try {
      const order = await memberApi.client.post('/me/pay/due', { subscriptionId: sub._id }).then((r) => r.data.data);
      const r = await openCheckout(order, { description: `${sub.plan?.name} membership due` });
      await memberApi.client.post('/me/pay/verify', r);
      toast.success('Payment successful. Thank you!');
      await qc.invalidateQueries({ queryKey: ['portal'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPaying(null);
    }
  }
  if (isLoading || !data) return <PageLoader />;
  const { member, gym, branch, access, subscriptions, card } = data;
  const ok = access.allowed;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MemberAvatar member={member} client={memberApi.client} own />
        <div>
          <p className="text-xs text-slate-500">{gym.name}</p>
          <p className="text-lg font-semibold">Hi, {member.name.split(' ')[0]}</p>
        </div>
      </div>

      {signNow && (
        <Link to="/portal/waiver" className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
            <FileSignature className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block text-amber-900">Please sign the gym waiver</b>
            <span className="text-xs text-amber-800">{waiver.requiredForEntry ? 'Needed before you can enter the gym' : 'Takes one minute'}</span>
          </span>
          <ChevronRight className="size-5 text-amber-700" />
        </Link>
      )}

      <div className={clsx('rounded-2xl p-4 text-white shadow-md', ok ? 'bg-gradient-to-br from-brand-700 to-brand-900' : 'bg-gradient-to-br from-rose-600 to-rose-800')}>
        <div className="flex items-center gap-2">
          {ok ? <ShieldCheck className="size-6" /> : <ShieldX className="size-6" />}
          <p className="text-lg font-semibold">{ok ? 'Membership active' : 'No gym access'}</p>
        </div>
        <p className="mt-1 text-sm text-white/90">{access.reason}</p>
        {access.validTo && (
          <p className="mt-3 text-sm">
            {access.membershipStatus === 'upcoming' ? 'Valid from' : 'Valid till'} <b>{fmtDate(access.membershipStatus === 'upcoming' ? access.validFrom : access.validTo)}</b>
          </p>
        )}
        {member.dueAmount > 0 && <p className="mt-1 rounded-lg bg-white/15 px-2 py-1 text-sm">Pending payment: {inr(member.dueAmount)}</p>}
        {autopayOn && (
          <p className="mt-1 text-sm text-white/90">
            Autopay {autopay.status === 'created' ? 'waiting for your approval' : autopay.status}: {autopay.planId?.name}, {inr(autopay.amount)} per cycle
            {autopay.status === 'created' && autopay.shortUrl && (
              <a href={autopay.shortUrl} className="ml-1 underline">
                Approve
              </a>
            )}
          </p>
        )}
        {cfg?.enabled && (
          <Link to="/portal/renew" className="mt-3 inline-block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-800">
            {ok ? 'Renew / extend' : 'Renew now'}
          </Link>
        )}
      </div>

      {progress && (
        <Link to="/portal/fitness?tab=progress" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-label="My progress">
          <span className="rounded-lg bg-orange-50 p-2 text-orange-600">
            <Flame className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block">
              {progress.currentStreak}-week streak · {progress.thisWeekVisits}/{progress.weeklyTarget} visits this week
            </b>
            <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <Award className="size-3.5 text-amber-600" /> {progress.earned} badge{progress.earned === 1 ? '' : 's'}
              {progress.badges.filter((b) => b.earned).slice(-1).map((b) => ` · ${b.label}`)}
            </span>
          </span>
          <ChevronRight className="size-5 text-slate-400" />
        </Link>
      )}

      <Card>
        <div className="flex flex-col items-center text-center">
          <img src={card.qr} alt="Membership QR code" className="size-52" />
          <p className="mt-1 font-mono text-sm text-slate-600">Member #{member.memberCode}</p>
          <p className="text-xs text-slate-500">Show this at reception if the biometric scanner is unavailable.</p>
        </div>
      </Card>

      {referral?.enabled && (
        <Link to="/portal/invite" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <Gift className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block">Invite a friend</b>
            <span className="text-xs text-slate-500">Get {referral.rewardDays} free days when they join</span>
          </span>
          <ChevronRight className="size-5 text-slate-400" />
        </Link>
      )}

      <AppSetup />

      {activePt.length > 0 && (
        <Card title="Personal training">
          <ul className="space-y-2 text-sm">
            {activePt.map((p) => (
              <li key={p._id} className="flex items-center justify-between">
                <span>
                  <b>{p.package?.name}</b> with {p.trainerId?.name}
                  <span className="block text-xs text-slate-500">valid till {fmtDate(p.validTo)}</span>
                </span>
                <span className="text-right">
                  <b className="text-lg text-brand-800">{p.sessionsTotal - p.sessionsUsed}</b>
                  <span className="block text-xs text-slate-500">sessions left</span>
                </span>
              </li>
            ))}
          </ul>
          {nextPt && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
              Next session: <b>{fmtDate(nextPt.startsAt)}, {fmtTime(nextPt.startsAt)}</b> with {nextPt.trainerId?.name}
            </p>
          )}
          <Link to="/portal/pt" className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            <CalendarPlus className="size-4" /> Book PT session
          </Link>
        </Card>
      )}

      {locker && (
        <Card>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
              <KeyRound className="size-5" />
            </span>
            <p className="text-sm">
              Your locker <b className="text-base">{locker.number}</b>
              <span className="block text-xs text-slate-500">paid till {fmtDate(locker.endDate)}</span>
            </p>
          </div>
        </Card>
      )}

      {freeze?.subscription && (
        <Link to="/portal/freeze" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
            <Snowflake className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block">Need a break? Request a freeze</b>
            <span className="text-xs text-slate-500">
              {freezeNote
                ? `Freeze request ${{ pending: 'waiting for the gym', approved: 'approved', rejected: 'not approved', cancelled: 'cancelled' }[freezeNote.status]}`
                : `${freeze.allowance?.daysLeft ?? 0} freeze day(s) left on your plan`}
            </span>
          </span>
          <ChevronRight className="size-5 text-slate-400" />
        </Link>
      )}

      {waiver?.signed && !signNow && (
        <Link to="/portal/waiver" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <FileSignature className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block">Waiver signed</b>
            <span className="text-xs text-slate-500">Version {waiver.signed.version} on {fmtDate(waiver.signed.signedAt)}</span>
          </span>
          <ChevronRight className="size-5 text-slate-400" />
        </Link>
      )}

      <Link to="/portal/feedback" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
          <MessageSquareText className="size-5" />
        </span>
        <span className="flex-1 text-sm">
          <b className="block">Complaint or suggestion?</b>
          <span className="text-xs text-slate-500">Tell the gym and track the reply</span>
        </span>
        <ChevronRight className="size-5 text-slate-400" />
      </Link>

      <Card title="My memberships" padded={false}>
        <ul className="divide-y divide-slate-100">
          {subscriptions.map((s) => (
            <li key={s._id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium">
                  {s.plan?.name} {s.status === 'cancelled' && <Badge status="cancelled" />}
                </p>
                <p className="text-xs text-slate-500">
                  {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                </p>
                {s.dueAmount > 0 && <p className="text-xs font-medium text-rose-600">Due {inr(s.dueAmount)}</p>}
                {s.dueAmount > 0 && s.status === 'active' && cfg?.enabled && (
                  <Button size="sm" className="mt-1" loading={paying === s._id} onClick={() => payDue(s)}>
                    Pay {inr(s.dueAmount)}
                  </Button>
                )}
              </div>
              {s.invoiceId && (
                <button onClick={() => openFile(`/me/invoices/${s.invoiceId}/pdf`, { client: memberApi.client })} className="rounded-lg p-2 text-brand-700 hover:bg-brand-50" aria-label="Invoice">
                  <FileText className="size-5" />
                </button>
              )}
            </li>
          ))}
          {!subscriptions.length && <li className="px-4 py-6 text-center text-sm text-slate-500">No memberships yet</li>}
        </ul>
      </Card>

      {branch && (
        <Card title={branch.name}>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Clock className="size-4" /> {branch.openingTime} – {branch.closingTime}
            </li>
            {branch.address && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4" /> {branch.address}
              </li>
            )}
            {(branch.phone || gym.phone) && (
              <li className="flex items-center gap-2">
                <Phone className="size-4" />
                <a href={`tel:${branch.phone || gym.phone}`} className="text-brand-700">
                  {branch.phone || gym.phone}
                </a>
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}
