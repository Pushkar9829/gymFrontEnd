import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inr, fmtDate, fmtTime, fmtDateTime } from '../../lib/format';
import { Card, Tabs, Spinner } from '../../components/ui';
import { portalGet } from './PortalHome';

export default function PortalHistory() {
  const [tab, setTab] = useState('visits');
  const visits = useQuery({ queryKey: ['portal', 'attendance'], queryFn: () => portalGet('/me/attendance', { limit: 60 }) });
  const payments = useQuery({ queryKey: ['portal', 'payments'], queryFn: () => portalGet('/me/payments', { limit: 50 }), enabled: tab === 'payments' });
  const q = tab === 'visits' ? visits : payments;

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">History</h1>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'visits', label: 'Visits', count: visits.data?.total },
          { value: 'payments', label: 'Payments' },
        ]}
      />
      <Card padded={false}>
        {q.isLoading ? (
          <div className="p-6">
            <Spinner />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tab === 'visits' &&
              visits.data?.items.map((a) => (
                <li key={a._id} className="flex justify-between px-4 py-3 text-sm">
                  <span className="font-medium">{fmtDate(a.checkInAt)}</span>
                  <span className="text-slate-500">
                    {fmtTime(a.checkInAt)}
                    {a.checkOutAt && ` – ${fmtTime(a.checkOutAt)}`}
                  </span>
                </li>
              ))}
            {tab === 'payments' &&
              payments.data?.items.map((p) => (
                <li key={p._id} className="flex justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{p.receiptNo}</p>
                    <p className="text-xs text-slate-500">
                      {fmtDateTime(p.paidAt)} · {p.mode.toUpperCase()}
                    </p>
                  </div>
                  <span className={p.type === 'refund' ? 'font-semibold text-rose-600' : 'font-semibold'}>
                    {p.type === 'refund' ? '-' : ''}
                    {inr(p.amount)}
                  </span>
                </li>
              ))}
            {!q.data?.items?.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Nothing yet</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}
