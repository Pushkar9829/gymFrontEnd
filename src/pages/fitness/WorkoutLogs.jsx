import { useState } from 'react';
import { Award, Flame, CheckCircle2, Circle } from 'lucide-react';
import clsx from 'clsx';
import { fmtDate } from '../../lib/format';
import { EmptyState } from '../../components/ui';

/** Compact streak + badges line (member app Home, staff Fitness tab). */
export function StreakSummary({ summary, className }) {
  if (!summary) return null;
  const earned = summary.badges.filter((b) => b.earned);
  return (
    <div className={clsx('space-y-3', className)}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat icon={Flame} value={summary.currentStreak} label={`week streak`} tone="text-orange-600" />
        <Stat value={`${summary.thisWeekVisits}/${summary.weeklyTarget}`} label="visits this week" />
        <Stat value={summary.visits} label="total visits" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {summary.badges.map((b) => (
          <span
            key={b.key}
            title={b.earned ? 'Earned' : 'Not yet'}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1',
              b.earned ? 'bg-amber-50 font-medium text-amber-800 ring-amber-200' : 'bg-slate-50 text-slate-400 ring-slate-200',
            )}
          >
            <Award className="size-3" /> {b.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {earned.length} of {summary.badges.length} badges · best streak {summary.bestStreak} week{summary.bestStreak === 1 ? '' : 's'} · {summary.workouts} workout{summary.workouts === 1 ? '' : 's'} logged
      </p>
    </div>
  );
}

function Stat({ icon: Icon, value, label, tone }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <p className={clsx('flex items-center justify-center gap-1 text-lg font-semibold', tone || 'text-slate-900')}>
        {Icon && <Icon className="size-4" />} {value}
      </p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

/** Past workouts, newest first; tap one to see the exercises. */
export function WorkoutHistory({ logs, empty, onDelete }) {
  const [open, setOpen] = useState(null);
  if (!logs?.length) return empty || <EmptyState title="No workouts logged yet" />;
  return (
    <ul className="divide-y divide-slate-100">
      {logs.map((l) => {
        const done = l.entries.filter((e) => e.done);
        return (
          <li key={l._id} className="px-4 py-3">
            <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setOpen(open === l._id ? null : l._id)}>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900">{l.dayName || 'Workout'}</span>
                <span className="block text-xs text-slate-500">
                  {fmtDate(l.day)} · {done.length} of {l.entries.length} exercises{l.durationMin ? ` · ${l.durationMin} min` : ''}
                </span>
              </span>
              <span className="shrink-0 text-xs text-brand-700">{open === l._id ? 'Hide' : 'Details'}</span>
            </button>
            {open === l._id && (
              <div className="mt-2 space-y-1">
                {l.entries.map((e, i) => (
                  <p key={i} className={clsx('flex items-start gap-1.5 text-sm', e.done ? 'text-slate-800' : 'text-slate-400')}>
                    {e.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0" />}
                    <span>
                      {e.name}
                      {e.done && (e.sets || e.reps || e.weight) && (
                        <span className="text-slate-500">
                          {' '}
                          · {[e.sets && `${e.sets} sets`, e.reps && `${e.reps} reps`, e.weight].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </p>
                ))}
                {l.note && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{l.note}</p>}
                {onDelete && (
                  <button type="button" className="text-xs font-medium text-rose-600" onClick={() => onDelete(l)}>
                    Delete this workout
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
