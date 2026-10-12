import { useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router';
import clsx from 'clsx';
import {
  LayoutDashboard, Users, ScanLine, CalendarCheck, CreditCard, Tags, UserPlus, Wallet, BarChart3,
  Fingerprint, Settings, UserCog, LogOut, Menu, X, Bell, Dumbbell, MessageSquare, HeartPulse, Salad, CalendarDays, Banknote, Store, Wrench, KeyRound, MessageSquareWarning, HandCoins, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useBranches, useApi, useAction } from '../lib/hooks';
import { post } from '../lib/api';
import { fromNow } from '../lib/format';
import { Avatar, PageLoader, Select } from '../components/ui';
import { ClockButton } from '../pages/StaffAttendance';

const NAV = [
  { section: 'Daily', to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: 'dashboard.read' },
  { to: '/admin/check-in', label: 'Check-in', icon: ScanLine, perm: 'attendance.write' },
  { to: '/admin/members', label: 'Members', icon: Users, perm: 'members.read' },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck, perm: 'attendance.read' },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, perm: 'payments.read' },
  { to: '/admin/lockers', label: 'Lockers', icon: KeyRound, perm: 'lockers.read' },
  { to: '/admin/feedback', label: 'Complaints & feedback', icon: MessageSquareWarning, perm: 'feedback.read' },
  { section: 'Training', to: '/admin/classes', label: 'Classes', icon: CalendarDays, perm: 'classes.read' },
  { to: '/admin/pt', label: 'Personal training', icon: HeartPulse, perm: 'pt.read' },
  { to: '/admin/fitness', label: 'Workouts & diet', icon: Salad, perm: 'fitness.read' },
  { section: 'Sales', to: '/admin/leads', label: 'Leads', icon: UserPlus, perm: 'leads.read' },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare, perm: 'members.write' },
  { to: '/admin/plans', label: 'Plans & coupons', icon: Tags, perm: 'plans.read' },
  { to: '/admin/shop', label: 'Shop', icon: Store, perm: 'shop.sell' },
  { section: 'Money', to: '/admin/cash', label: 'Day closing', icon: HandCoins, perm: 'cash.close' },
  { to: '/admin/approvals', label: 'Approvals', icon: BadgeCheck, perm: 'discounts.approve' },
  { to: '/admin/expenses', label: 'Expenses', icon: Wallet, perm: 'expenses.read' },
  { to: '/admin/payroll', label: 'Payroll', icon: Banknote, perm: 'payroll.manage' },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3, perm: 'reports.read' },
  { section: 'Gym setup', to: '/admin/equipment', label: 'Equipment', icon: Wrench, perm: 'equipment.read' },
  { to: '/admin/devices', label: 'Biometric devices', icon: Fingerprint, perm: 'devices.read' },
  // Everyone needs their own account (password, payslips); only managers see full settings.
  { to: '/admin/settings', label: 'Settings', icon: Settings, perm: 'users.read', otherwise: { label: 'My account', icon: UserCog } },
];
// Every item inherits the section of the item above it.
NAV.reduce((sec, n) => (n.section ||= sec), null);

function Sidebar({ onNavigate }) {
  const can = useAuth((s) => s.can);
  const items = NAV.flatMap((n) => (can(n.perm) ? [n] : n.otherwise ? [{ ...n, ...n.otherwise }] : []));
  // Headings only help on a long menu (owner/manager), not a trainer's few items.
  const grouped = items.length > 6;
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {items.map(({ to, label, icon: Icon, end, section }, i) => (
        <div key={to}>
          {grouped && section !== items[i - 1]?.section && <p className="mt-3 mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{section}</p>}
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        </div>
      ))}
    </nav>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const { data } = useApi('notifications', '/notifications', { limit: 15 }, { refetchInterval: 60000 });
  const readAll = useAction(() => post('/notifications/read-all'), { invalidate: ['notifications', 'dashboard'] });
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
        <Bell className="size-5" />
        {data?.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[11px] leading-5 font-semibold text-white">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-semibold">Alerts</span>
              {data?.unread > 0 && (
                <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => readAll.mutate()}>
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {(data?.items || []).map((n) => (
                <li key={n._id} className={clsx('px-4 py-3', !n.readAt && 'bg-amber-50/50')}>
                  <p className="text-sm font-medium text-slate-800">{n.subject}</p>
                  {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">{fromNow(n.createdAt)}</p>
                </li>
              ))}
              {!data?.items?.length && <li className="px-4 py-8 text-center text-sm text-slate-500">No alerts</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function BranchSwitcher() {
  const { data: branches } = useBranches();
  const { branchId, setBranch, user } = useAuth();
  if (!branches || branches.length < 2) return null;
  return (
    <Select value={branchId} onChange={(e) => setBranch(e.target.value)} className="w-auto max-w-44 py-1.5">
      {(user.role === 'owner' || branches.length > 1) && <option value="">All branches</option>}
      {branches.map((b) => (
        <option key={b._id} value={b._id}>
          {b.name}
        </option>
      ))}
    </Select>
  );
}

export default function AdminLayout() {
  const { status, user, logout, bootstrap } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'loading') bootstrap();
  }, [status, bootstrap]);

  if (status === 'loading') return <PageLoader />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-5 py-4 text-white">
        <span className="rounded-lg bg-brand-600 p-1.5">
          <Dumbbell className="size-5" />
        </span>
        <span className="text-lg font-semibold">Gym Manager</span>
      </div>
      <Sidebar onNavigate={() => setOpen(false)} />
      <div className="border-t border-white/10 p-3">
        <button
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-[18px]" /> Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-slate-900 lg:flex">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-slate-900">
            <button onClick={() => setOpen(false)} className="absolute top-5 right-3 text-slate-400" aria-label="Close menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <ClockButton />
          <BranchSwitcher />
          <Notifications />
          <div className="flex items-center gap-2">
            <Avatar name={user.name} size="sm" />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
