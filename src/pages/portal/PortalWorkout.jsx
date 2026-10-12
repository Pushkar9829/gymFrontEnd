import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberApi, errorMessage } from '../../lib/api';
import { Button, Card, EmptyState, Field, Input, PageLoader, Select } from '../../components/ui';
import { WorkoutView } from '../fitness/PlanViews';
import { WorkoutHistory } from '../fitness/WorkoutLogs';
import { portalGet } from './PortalHome';

const blankEntries = (day) => (day?.exercises || []).map((x) => ({ name: x.name, exerciseId: x.exerciseId, done: false, sets: '', reps: '', weight: '', planned: x }));

/** My plan > Workout: today's workout from the plan (tick + actual sets / reps / weight), then history. */
export default function PortalWorkout() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'workout'], queryFn: () => portalGet('/me/workout') });
  const { data: logs } = useQuery({ queryKey: ['portal', 'workout-logs'], queryFn: () => portalGet('/me/workout-logs', { limit: 30 }) });
  const [dayIndex, setDayIndex] = useState(null);
  const [entries, setEntries] = useState([]);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const plan = data?.plan;
  const current = dayIndex ?? data?.suggestedDayIndex ?? 0;
  useEffect(() => {
    if (plan) setEntries(blankEntries(plan.days[current]));
  }, [plan, current]);

  if (isLoading) return <PageLoader />;
  const refresh = () => Promise.all(['workout', 'workout-logs', 'progress-summary'].map((k) => qc.invalidateQueries({ queryKey: ['portal', k] })));
  const setEntry = (i, patch) => setEntries(entries.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const doneCount = entries.filter((e) => e.done).length;

  async function finish() {
    setBusy(true);
    try {
      await memberApi.client.post('/me/workout-logs', {
        planId: plan._id,
        dayIndex: current,
        durationMin: Number(duration) > 0 ? Number(duration) : undefined,
        note: note.trim() || undefined,
        entries: entries.map((e) => ({
          name: e.name,
          exerciseId: e.exerciseId || undefined,
          done: e.done,
          sets: e.done && e.sets !== '' ? Number(e.sets) : undefined,
          reps: e.done && e.reps ? String(e.reps) : undefined,
          weight: e.done && e.weight ? String(e.weight) : undefined,
        })),
      });
      toast.success('Workout saved. Great job!');
      setDuration('');
      setNote('');
      setDayIndex(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(log) {
    if (!window.confirm(`Delete the workout of ${log.dayName || 'this day'}?`)) return;
    try {
      await memberApi.client.delete(`/me/workout-logs/${log._id}`);
      toast.success('Workout deleted');
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <EmptyState title="No workout plan yet">Ask your trainer to set one up. Your workouts will show here to tick off.</EmptyState>
        {logs?.items?.length > 0 && (
          <Card title="Past workouts" padded={false}>
            <WorkoutHistory logs={logs.items} onDelete={remove} />
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Today's workout">
        {data.today?.length > 0 && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Done today: {data.today.map((t) => t.dayName || 'Workout').join(', ')}</p>}
        <Field label="Plan day" hint={data.last ? `Last time: ${data.last.dayName}` : 'Start with day 1'}>
          <Select value={current} onChange={(e) => setDayIndex(Number(e.target.value))}>
            {plan.days.map((d, i) => (
              <option key={i} value={i}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <ul className="mt-3 space-y-2">
          {entries.map((e, i) => (
            <li key={`${current}-${i}`} className={`rounded-xl p-3 ring-1 ${e.done ? 'bg-emerald-50/60 ring-emerald-200' : 'ring-slate-200'}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={e.done} onChange={(ev) => setEntry(i, { done: ev.target.checked })} className="mt-0.5 size-5 rounded text-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{e.name}</span>
                  <span className="block text-xs text-slate-500">
                    Plan: {e.planned.sets} × {e.planned.reps}
                    {e.planned.weight ? ` · ${e.planned.weight}` : ''}
                  </span>
                </span>
              </label>
              {e.done && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Input type="number" min="0" max="50" inputMode="numeric" aria-label={`Sets done: ${e.name}`} placeholder={`Sets (${e.planned.sets})`} value={e.sets} onChange={(ev) => setEntry(i, { sets: ev.target.value })} />
                  <Input aria-label={`Reps: ${e.name}`} placeholder={`Reps (${e.planned.reps})`} value={e.reps} onChange={(ev) => setEntry(i, { reps: ev.target.value })} />
                  <Input aria-label={`Weight: ${e.name}`} placeholder={e.planned.weight ? `Weight (${e.planned.weight})` : 'Weight'} value={e.weight} onChange={(ev) => setEntry(i, { weight: ev.target.value })} />
                </div>
              )}
            </li>
          ))}
          {!entries.length && <li className="text-sm text-slate-500">No exercises on this day.</li>}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Minutes (optional)">
            <Input type="number" min="1" max="600" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        </div>
        <Button className="mt-4 w-full" size="lg" disabled={!doneCount} loading={busy} onClick={finish}>
          Finish workout{doneCount ? ` (${doneCount} done)` : ''}
        </Button>
        {!doneCount && <p className="mt-2 text-center text-xs text-slate-500">Tick the exercises you did</p>}
      </Card>

      <Card title="Past workouts" padded={false}>
        <WorkoutHistory logs={logs?.items} onDelete={remove} empty={<p className="px-4 py-6 text-center text-sm text-slate-500">No workouts yet. Finish today's workout to start your history.</p>} />
      </Card>

      <div>
        <button type="button" className="text-sm font-medium text-brand-700" onClick={() => setShowPlan(!showPlan)}>
          {showPlan ? 'Hide full plan' : `See full plan: ${plan.name}`}
        </button>
        {showPlan && (
          <div className="mt-3">
            <WorkoutView plan={plan} />
          </div>
        )}
      </div>
    </div>
  );
}
