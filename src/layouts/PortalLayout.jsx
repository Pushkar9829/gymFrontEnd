import { useEffect } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router';
import clsx from 'clsx';
import { Home, History, LogOut, Dumbbell, CalendarDays } from 'lucide-react';
import { useMemberAuth } from '../store/auth';
import { PageLoader } from '../components/ui';

export default function PortalLayout() {
  const { status, bootstrap, logout } = useMemberAuth();
  useEffect(() => {
    if (status === 'loading') bootstrap();
  }, [status, bootstrap]);
  if (status === 'loading') return <PageLoader />;
  if (status === 'guest') return <Navigate to="/portal/login" replace />;

  const tab = ({ isActive }) => clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium', isActive ? 'text-brand-700' : 'text-slate-500');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50">
      <main className="flex-1 px-4 pt-4 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/portal" end className={tab}>
          <Home className="size-5" /> Home
        </NavLink>
        <NavLink to="/portal/fitness" className={tab}>
          <Dumbbell className="size-5" /> My plan
        </NavLink>
        <NavLink to="/portal/classes" className={tab}>
          <CalendarDays className="size-5" /> Classes
        </NavLink>
        <NavLink to="/portal/history" className={tab}>
          <History className="size-5" /> History
        </NavLink>
        <button onClick={logout} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium text-slate-500">
          <LogOut className="size-5" /> Log out
        </button>
      </nav>
    </div>
  );
}
