import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ShieldCheck, ShieldX, FileText, Phone, MapPin, Clock } from 'lucide-react';
import { memberApi, openFile } from '../../lib/api';
import { inr, fmtDate } from '../../lib/format';
import { Avatar, Badge, Card, PageLoader } from '../../components/ui';

export const portalGet = (url, params) => memberApi.client.get(url, { params }).then((r) => r.data.data);

export default function PortalHome() {
  const { data, isLoading } = useQuery({ queryKey: ['portal'], queryFn: () => portalGet('/me') });
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
      </div>

      <Card>
        <div className="flex flex-col items-center text-center">
          <img src={card.qr} alt="Membership QR code" className="size-52" />
          <p className="mt-1 font-mono text-sm text-slate-600">Member #{member.memberCode}</p>
          <p className="text-xs text-slate-500">Show this at reception if the biometric scanner is unavailable.</p>
        </div>
      </Card>

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
