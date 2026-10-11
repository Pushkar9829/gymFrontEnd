import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { memberApi, errorMessage } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { Badge, Button, EmptyState, PageLoader } from '../../components/ui';
import { portalGet } from './PortalHome';

export default function PortalClasses() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'classes'], queryFn: () => portalGet('/me/classes') });
  if (isLoading) return <PageLoader />;

  async function act(id, fn, msg) {
    setBusy(id);
    try {
      const r = await fn();
      toast.success(typeof msg === 'function' ? msg(r.data.data) : msg);
      await qc.invalidateQueries({ queryKey: ['portal', 'classes'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const upcoming = data.sessions.filter((s) => new Date(s.startsAt) > new Date());
  const byDay = upcoming.reduce((acc, s) => {
    const k = dayjs(s.startsAt).format('YYYY-MM-DD');
    (acc[k] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Classes</h1>
      <p className="mb-4 text-xs text-slate-500">Cancel up to {data.cancelCutoffMin} minutes before the class so someone on the waitlist gets your seat.</p>
      {!upcoming.length && <EmptyState title="No classes in the next 7 days" />}
      <div className="space-y-4">
        {Object.entries(byDay).map(([day, list]) => (
          <div key={day}>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">{dayjs(day).format('dddd, DD MMM')}</p>
            <ul className="space-y-2">
              {list.map((s) => {
                const full = s.bookedCount >= s.capacity;
                const mine = s.myBooking;
                return (
                  <li key={s._id} className="flex items-center justify-between gap-2 rounded-xl border-l-4 bg-white p-3 shadow-sm ring-1 ring-slate-200" style={{ borderLeftColor: s.color || '#0f766e' }}>
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-slate-500">
                        {fmtTime(s.startsAt)}
                        {s.trainerId?.name && ` · ${s.trainerId.name}`}
                      </p>
                      {s.status === 'cancelled' ? (
                        <Badge status="cancelled">Cancelled</Badge>
                      ) : (
                        <p className="text-xs text-slate-400">{full ? 'Full' : `${s.capacity - s.bookedCount} spot(s) left`}</p>
                      )}
                    </div>
                    {s.status === 'scheduled' &&
                      (mine ? (
                        <div className="text-right">
                          <Badge status={mine.status === 'booked' ? 'active' : 'upcoming'}>{mine.status === 'booked' ? 'Booked' : 'On waitlist'}</Badge>
                          <button
                            className="mt-1 block text-xs text-rose-600"
                            disabled={busy === s._id}
                            onClick={() => act(s._id, () => memberApi.client.post(`/me/bookings/${mine._id}/cancel`), 'Booking cancelled')}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant={full ? 'secondary' : 'primary'}
                          loading={busy === s._id}
                          onClick={() => act(s._id, () => memberApi.client.post(`/me/classes/${s._id}/book`), (d) => (d.booking.status === 'booked' ? 'Booked!' : 'Added to the waitlist'))}
                        >
                          {full ? 'Join waitlist' : 'Book'}
                        </Button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
