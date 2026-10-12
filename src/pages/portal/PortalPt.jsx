import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import { memberApi, errorMessage } from '../../lib/api';
import { fmtDate, fmtTime } from '../../lib/format';
import { Button, Card, EmptyState, PageLoader, Select, Spinner } from '../../components/ui';
import SlotPicker, { BookingBadge } from '../../components/SlotPicker';
import { portalGet } from './PortalHome';

const when = (d) => `${dayjs(d).format('ddd, DD MMM')} · ${fmtTime(d)}`;

export default function PortalPt() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'pt-booking'], queryFn: () => portalGet('/me/pt-booking') });
  const [purchaseId, setPurchaseId] = useState('');
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(null);
  const purchases = data?.purchases || [];
  const purchase = purchases.find((p) => p._id === purchaseId) || purchases[0];
  const slots = useQuery({
    queryKey: ['portal', 'pt-slots', purchase?._id],
    queryFn: () => portalGet('/me/pt-booking/slots', { purchaseId: purchase._id }),
    enabled: Boolean(purchase && purchase.bookable > 0),
  });
  if (isLoading || !data) return <PageLoader />;

  async function act(key, fn, msg) {
    setBusy(key);
    try {
      const r = await fn();
      toast.success(typeof msg === 'function' ? msg(r.data.data) : msg);
      setSlot('');
      await qc.invalidateQueries({ queryKey: ['portal'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const now = Date.now();
  const upcoming = data.bookings.filter((b) => b.status === 'booked' && new Date(b.endsAt) > now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const past = data.bookings.filter((b) => !upcoming.includes(b));
  const cutoff = data.settings.cancelHours;

  return (
    <div className="space-y-4">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="text-lg font-semibold">Personal training</h1>

      {!purchases.length ? (
        <Card>
          <EmptyState icon={CalendarCheck} title="No active PT package">
            Ask at the reception to buy a personal training package, then book your sessions here.
          </EmptyState>
        </Card>
      ) : (
        <Card title="Book a session">
          {purchases.length > 1 && (
            <Select value={purchase._id} onChange={(e) => (setPurchaseId(e.target.value), setSlot(''))} className="mb-3" aria-label="PT package">
              {purchases.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.package?.name} with {p.trainerId?.name}
                </option>
              ))}
            </Select>
          )}
          <p className="mb-3 text-sm text-slate-600">
            With <b>{purchase.trainerId?.name}</b> · {purchase.bookable} session(s) left to book · valid till {fmtDate(purchase.validTo)}
          </p>
          {purchase.bookable <= 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">All sessions on this package are booked or used.</p>
          ) : slots.isLoading ? (
            <Spinner />
          ) : (
            <SlotPicker days={slots.data?.days} value={slot} onChange={setSlot} empty={slots.data?.hasHours === false ? 'Your trainer has not opened PT slots yet. Please ask at the reception.' : 'No free slots right now. Please check again later.'} />
          )}
          {slot && (
            <Button className="mt-4 w-full" size="lg" loading={busy === 'book'} onClick={() => act('book', () => memberApi.client.post('/me/pt-booking', { purchaseId: purchase._id, startsAt: slot }), (b) => `Booked: ${when(b.startsAt)}`)}>
              Book {when(slot)}
            </Button>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Book up to {data.settings.bookingWindowDays} days ahead, {data.settings.maxPerDay} session(s) a day. Cancel in the app up to {cutoff} hour(s) before.
          </p>
        </Card>
      )}

      <Card title="My bookings" padded={false}>
        {!data.bookings.length ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No bookings yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...upcoming, ...past].map((b) => {
              const canCancel = b.status === 'booked' && new Date(b.startsAt) - now > cutoff * 3600000;
              return (
                <li key={b._id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{when(b.startsAt)}</p>
                    <p className="text-xs text-slate-500">
                      with {b.trainerId?.name} <BookingBadge status={b.status} />
                    </p>
                  </div>
                  {canCancel ? (
                    <Button size="sm" variant="secondary" loading={busy === b._id} onClick={() => window.confirm('Cancel this booking?') && act(b._id, () => memberApi.client.post(`/me/pt-booking/${b._id}/cancel`), 'Booking cancelled')}>
                      Cancel
                    </Button>
                  ) : (
                    b.status === 'booked' && <span className="max-w-28 text-right text-[11px] text-slate-400">Call the gym to cancel</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
