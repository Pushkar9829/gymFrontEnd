import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { get } from '../lib/api';
import { useAuth } from '../store/auth';

const KEY = 'gym.setupChecklist.hidden';
const hiddenAlready = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** First-run guide for owners and managers: disappears once everything is set up (or when closed). */
export default function SetupChecklist() {
  const can = useAuth((s) => s.can);
  const [hidden, setHidden] = useState(hiddenAlready);
  const on = !hidden && can('users.read');
  const opts = { enabled: on, staleTime: 60000 };
  const gym = useQuery({ queryKey: ['setup', 'gym'], queryFn: () => get('/settings'), ...opts });
  const plans = useQuery({ queryKey: ['setup', 'plans'], queryFn: () => get('/plans'), ...opts });
  const staff = useQuery({ queryKey: ['setup', 'staff'], queryFn: () => get('/users'), ...opts });
  const devices = useQuery({ queryKey: ['setup', 'devices'], queryFn: () => get('/devices'), ...opts });
  const members = useQuery({ queryKey: ['setup', 'members'], queryFn: () => get('/members', { limit: 1 }), ...opts });
  if (!on || [gym, plans, staff, devices, members].some((r) => !r.data)) return null;

  const steps = [
    { done: Boolean(gym.data.address && gym.data.phone), label: 'Add your gym address and phone (printed on invoices)', to: '/admin/settings' },
    { done: plans.data.length > 0, label: 'Create your membership plans and prices', to: '/admin/plans' },
    { done: staff.data.some((u) => u.role !== 'owner'), label: 'Add staff accounts for reception and trainers', to: '/admin/settings' },
    { done: (devices.data.items || devices.data).length > 0, label: 'Connect the biometric / entry device', to: '/admin/devices' },
    { done: members.data.total > 0, label: 'Register your first member', to: '/admin/members' },
    { done: Boolean(gym.data.settings?.channels?.sms || gym.data.settings?.channels?.whatsapp || gym.data.settings?.sendEmails), label: 'Switch on SMS, WhatsApp or email reminders', to: '/admin/settings' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // private mode: just hide for now
    }
    setHidden(true);
  };
  return (
    <div className="mb-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-brand-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">Get your gym ready</p>
          <p className="text-sm text-slate-500">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <button onClick={close} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Hide setup checklist" title="Hide">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.label}>
            {s.done ? (
              <span className="flex items-center gap-2 text-sm text-slate-400 line-through">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" /> {s.label}
              </span>
            ) : (
              <Link to={s.to} className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
                <Circle className="size-4 shrink-0 text-slate-300" /> {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
