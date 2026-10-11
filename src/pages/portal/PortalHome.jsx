import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { openCheckout } from '../../lib/razorpay';
import { errorMessage } from '../../lib/api';
import clsx from 'clsx';
import { ShieldCheck, ShieldX, FileText, Phone, MapPin, Clock } from 'lucide-react';
import { memberApi, openFile } from '../../lib/api';
import { inr, fmtDate } from '../../lib/format';
import { Avatar, Badge, Button, Card, PageLoader } from '../../components/ui';

export const portalGet = (url, params) => memberApi.client.get(url, { params }).then((r) => r.data.data);

export default function PortalHome() {
  const { data, isLoading } = useQuery({ queryKey: ['portal'], queryFn: () => portalGet('/me') });
  const { data: cfg } = useQuery({ queryKey: ['portal', 'paycfg'], queryFn: () => portalGet('/me/pay/config') });
  const { data: pt } = useQuery({ queryKey: ['portal', 'pt'], queryFn: () => portalGet('/me/pt') });
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
        <Avatar name={member.name} src={member.photoUrl} />
        <div>
          <p className="text-xs text-slate-500">{gym.name}</p>
          <p className="text-lg font-semibold">Hi, {member.name.split(' ')[0]}</p>
        </div>
      </div>

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
        {cfg?.enabled && (
          <Link to="/portal/renew" className="mt-3 inline-block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-800">
            {ok ? 'Renew / extend' : 'Renew now'}
          </Link>
        )}
      </div>

      <Card>
        <div className="flex flex-col items-center text-center">
          <img src={card.qr} alt="Membership QR code" className="size-52" />
          <p className="mt-1 font-mono text-sm text-slate-600">Member #{member.memberCode}</p>
          <p className="text-xs text-slate-500">Show this at reception if the biometric scanner is unavailable.</p>
        </div>
      </Card>

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
        </Card>
      )}

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
