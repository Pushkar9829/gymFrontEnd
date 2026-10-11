import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberApi, errorMessage } from '../../lib/api';
import { ymd } from '../../lib/format';
import { Button, Card, EmptyState, Input, PageLoader, Tabs } from '../../components/ui';
import { WorkoutView, DietView, WeightChart } from '../fitness/PlanViews';
import { portalGet } from './PortalHome';

export default function PortalFitness() {
  const [tab, setTab] = useState('workout');
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'fitness'], queryFn: () => portalGet('/me/fitness') });
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
      {tab === 'workout' && (data.workout ? <WorkoutView plan={data.workout} /> : <EmptyState title="No workout plan yet">Ask your trainer to set one up.</EmptyState>)}
      {tab === 'diet' && (data.diet ? <DietView plan={data.diet} /> : <EmptyState title="No diet plan yet">Ask your trainer to set one up.</EmptyState>)}
      {tab === 'progress' && (
        <div className="space-y-4">
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
        </div>
      )}
    </div>
  );
}
