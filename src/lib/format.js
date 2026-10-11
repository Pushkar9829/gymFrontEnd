import dayjs from 'dayjs';

/** API money is integer paise. */
export const inr = (paise, { decimals = false } = {}) =>
  `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;

export const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toRupees = (paise) => Number(paise || 0) / 100;

export const fmtDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
export const fmtDateTime = (d) => (d ? dayjs(d).format('DD MMM YYYY, hh:mm A') : '—');
export const fmtTime = (d) => (d ? dayjs(d).format('hh:mm A') : '—');
export const ymd = (d = new Date()) => dayjs(d).format('YYYY-MM-DD');
export const fromNow = (d) => {
  if (!d) return 'never';
  const mins = Math.round((Date.now() - new Date(d)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};

export const daysUntil = (d) => (d ? dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day') : null);

export const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  upcoming: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  frozen: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  expired: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  none: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  new: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  contacted: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  trial: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  converted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  lost: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  allow: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  deny: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export const STATUS_LABEL = {
  none: 'No plan',
  active: 'Active',
  upcoming: 'Upcoming',
  frozen: 'Frozen',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' },
];
