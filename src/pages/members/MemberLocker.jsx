import { useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { inr, fmtDate, daysUntil } from '../../lib/format';
import { Button, Card } from '../../components/ui';

/** The member's current locker, with a shortcut to the Lockers screen. */
export default function MemberLocker({ member }) {
  const can = useAuth((s) => s.can);
  const navigate = useNavigate();
  const { data } = useApi(['lockers', 'member', member._id], '/lockers/allotments', { memberId: member._id, branchId: member.branchId }, { enabled: can('lockers.read') });
  if (!can('lockers.read') || !data) return null;
  const current = data.find((a) => a.status === 'active');
  const left = current && daysUntil(current.endDate);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="size-4" /> Locker
        </span>
      }
      actions={
        can('lockers.write') && (
          <Button size="sm" variant="secondary" onClick={() => navigate(current ? '/admin/lockers?status=occupied' : '/admin/lockers?status=available')}>
            {current ? 'Manage' : 'Allot a locker'}
          </Button>
        )
      }
    >
      {current ? (
        <p className="text-sm">
          <b>{current.lockerId?.number}</b> · till {fmtDate(current.endDate)}{' '}
          <span className={left < 0 ? 'font-semibold text-rose-600' : 'text-slate-500'}>({left < 0 ? `${-left} day(s) overdue` : `${left} day(s) left`})</span>
          {current.deposit > 0 && <span className="block text-slate-500">Deposit held {inr(current.deposit)}</span>}
        </p>
      ) : (
        <p className="text-sm text-slate-500">No locker.{data.length ? ` Had ${data.length} before.` : ''}</p>
      )}
    </Card>
  );
}
