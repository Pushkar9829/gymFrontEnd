import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberApi, errorMessage } from '../../lib/api';
import { fmtDate, ymd } from '../../lib/format';
import { Button, Card, EmptyState, Input, Modal, PageLoader, Tabs } from '../../components/ui';
import { PrivateImage } from '../../components/PrivateImage';
import { DietView, WeightChart } from '../fitness/PlanViews';
import { StreakSummary } from '../fitness/WorkoutLogs';
import PortalWorkout from './PortalWorkout';
import { portalGet } from './PortalHome';

export default function PortalFitness() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(['workout', 'diet', 'progress'].includes(params.get('tab')) ? params.get('tab') : 'workout');
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'fitness'], queryFn: () => portalGet('/me/fitness') });
  const { data: notes } = useQuery({ queryKey: ['portal', 'progress'], queryFn: () => portalGet('/me/progress'), enabled: tab === 'progress' });
  const { data: summary } = useQuery({ queryKey: ['portal', 'progress-summary'], queryFn: () => portalGet('/me/progress-summary'), enabled: tab === 'progress' });
  const [photo, setPhoto] = useState(null);
  if (isLoading) return <PageLoader />;

  async function logWeight() {
    setBusy(true);
    try {
      await memberApi.client.post('/me/measurements', { date: ymd(), weightKg: Number(weight) });
      toast.success('Weight saved');
      setWeight('');
      await qc.invalidateQueries({ queryKey: ['portal', 'fitness'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold">My plan</h1>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'workout', label: 'Workout' },
          { value: 'diet', label: 'Diet' },
          { value: 'progress', label: 'Progress' },
        ]}
      />
      {tab === 'workout' && <PortalWorkout />}
      {tab === 'diet' && (data.diet ? <DietView plan={data.diet} /> : <EmptyState title="No diet plan yet">Ask your trainer to set one up.</EmptyState>)}
      {tab === 'progress' && (
        <div className="space-y-4">
          <Card title="My progress">
            {summary ? <StreakSummary summary={summary} /> : <p className="text-sm text-slate-500">Loading…</p>}
            <p className="mt-2 text-xs text-slate-500">A week counts towards your streak when you visit the gym {summary?.weeklyTarget || 3} days (Monday to Sunday).</p>
          </Card>
          <Card title="Log today's weight">
            <div className="flex gap-2">
              <Input type="number" step="0.1" placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <Button disabled={!(Number(weight) > 20)} loading={busy} onClick={logWeight}>
                Save
              </Button>
            </div>
          </Card>
          <Card title="Progress">
            <WeightChart measurements={data.measurements} />
          </Card>
          <Card title="Notes from your trainer" padded={false}>
            {!notes?.length ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No notes yet. Your trainer adds progress notes and photos here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notes.map((n) => (
                  <li key={n._id} className="px-4 py-3">
                    <p className="text-xs text-slate-500">
                      {fmtDate(n.createdAt)} · {n.createdBy?.name}
                      {n.measurementId?.weightKg ? ` · ${n.measurementId.weightKg} kg` : ''}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-line text-slate-800">{n.text}</p>
                    {n.photoIds?.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {n.photoIds.map((id) => (
                          <PrivateImage key={id} url={`/me/files/${id}`} client={memberApi.client} alt="Progress photo" className="aspect-square w-full rounded-lg" onClick={() => setPhoto(id)} />
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {photo && (
            <Modal open onClose={() => setPhoto(null)} title="Progress photo">
              <PrivateImage url={`/me/files/${photo}`} client={memberApi.client} alt="Progress photo" className="w-full rounded-lg object-contain" />
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}
