import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { fmtTime } from '../lib/format';
import { Badge } from './ui';

const STATUS = { booked: ['upcoming', 'Booked'], done: ['active', 'Done'], 'no-show': ['deny', 'No-show'], cancelled: ['cancelled', 'Cancelled'] };
/** Status of a PT booking. */
export const BookingBadge = ({ status }) => <Badge status={STATUS[status]?.[0]}>{STATUS[status]?.[1] || status}</Badge>;

/**
 * Pick a day, then a time. days: [{ day: 'YYYY-MM-DD', slots: [{ startsAt, endsAt, free? }] }].
 * Taken slots (free === false) are shown greyed out. value = startsAt ISO string.
 */
export default function SlotPicker({ days = [], value, onChange, empty = 'No free slots' }) {
  const withSlots = days.filter((d) => d.slots.some((s) => s.free !== false));
  const [day, setDay] = useState(withSlots[0]?.day || '');
  useEffect(() => {
    if (!withSlots.some((d) => d.day === day)) setDay(withSlots[0]?.day || '');
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!withSlots.length) return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">{empty}</p>;
  const current = days.find((d) => d.day === day);
  return (
    <div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Day">
        {withSlots.map((d) => {
          const free = d.slots.filter((s) => s.free !== false).length;
          return (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={d.day === day}
              onClick={() => setDay(d.day)}
              className={clsx('flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs ring-1', d.day === day ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-200')}
            >
              <span className="font-semibold">{dayjs(d.day).format('ddd')}</span>
              <span>{dayjs(d.day).format('DD MMM')}</span>
              <span className={clsx('text-[10px]', d.day === day ? 'text-white/80' : 'text-slate-400')}>{free} free</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(current?.slots || []).map((s) => {
          const iso = new Date(s.startsAt).toISOString();
          const taken = s.free === false;
          return (
            <button
              key={iso}
              type="button"
              disabled={taken}
              onClick={() => onChange(iso)}
              className={clsx(
                'rounded-lg px-2 py-2 text-sm font-medium ring-1',
                taken ? 'cursor-not-allowed bg-slate-50 text-slate-300 line-through ring-slate-100' : value === iso ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-800 ring-slate-300 hover:ring-brand-400',
              )}
            >
              {fmtTime(s.startsAt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
