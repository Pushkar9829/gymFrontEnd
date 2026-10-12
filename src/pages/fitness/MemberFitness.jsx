import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { del, get, post } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDate, ymd } from '../../lib/format';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Table } from '../../components/ui';
import { WorkoutBuilder, DietBuilder } from './Builders';
import { WorkoutView, DietView, WeightChart } from './PlanViews';
import ProgressNotes from './ProgressNotes';

function AssignTemplate({ kind, memberId }) {
  const path = kind === 'workout' ? 'workout-plans' : 'diet-plans';
  const { data } = useQuery({ queryKey: ['fitness', path, 'templates'], queryFn: () => get(`/fitness/${path}`) });
  const [id, setId] = useState('');
  const assign = useAction(() => post(`/fitness/${path}/${id}/assign`, { memberId }), { success: 'Plan assigned', invalidate: ['fitness'] });
  if (!data?.length) return null;
  return (
    <div className="flex gap-2">
      <Select value={id} onChange={(e) => setId(e.target.value)} className="w-auto">
        <option value="">From template…</option>
        {data.map((t) => (
          <option key={t._id} value={t._id}>
            {t.name}
          </option>
        ))}
      </Select>
      <Button size="sm" variant="secondary" disabled={!id} loading={assign.isPending} onClick={() => assign.mutate()}>
        Assign
      </Button>
    </div>
  );
}

function MeasurementForm({ memberId, onClose }) {
  const [f, setF] = useState({ date: ymd(), weightKg: '', heightCm: '', bodyFatPercent: '', chestCm: '', waistCm: '', hipsCm: '', armsCm: '', thighsCm: '', notes: '' });
  const save = useAction((b) => post('/fitness/measurements', b), { success: 'Saved', invalidate: ['fitness'], onSuccess: onClose });
  const n = (v) => (v === '' ? null : Number(v));
  const fields = [
    ['weightKg', 'Weight (kg)'],
    ['heightCm', 'Height (cm)'],
    ['bodyFatPercent', 'Body fat %'],
    ['chestCm', 'Chest (cm)'],
    ['waistCm', 'Waist (cm)'],
    ['hipsCm', 'Hips (cm)'],
    ['armsCm', 'Arms (cm)'],
    ['thighsCm', 'Thighs (cm)'],
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title="Add measurement"
      footer={
        <Button loading={save.isPending} onClick={() => save.mutate({ memberId, date: f.date, notes: f.notes || undefined, ...Object.fromEntries(fields.map(([k]) => [k, n(f[k])])) })}>
          Save
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Date" className="col-span-2">
          <Input type="date" max={ymd()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            <Input type="number" step="0.1" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label="Notes" className="col-span-2 sm:col-span-4">
          <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export default function MemberFitness({ member }) {
  const can = useAuth((s) => s.can);
  const write = can('fitness.write');
  const [modal, setModal] = useState(null);
  const { data: workouts } = useQuery({ queryKey: ['fitness', 'workout-plans', member._id], queryFn: () => get('/fitness/workout-plans', { memberId: member._id }) });
  const { data: diets } = useQuery({ queryKey: ['fitness', 'diet-plans', member._id], queryFn: () => get('/fitness/diet-plans', { memberId: member._id }) });
  const { data: measurements } = useQuery({ queryKey: ['fitness', 'measurements', member._id], queryFn: () => get('/fitness/measurements', { memberId: member._id }) });
  const remove = useAction((id) => del(`/fitness/measurements/${id}`), { success: 'Removed', invalidate: ['fitness'] });
  const workout = workouts?.find((p) => p.isActive);
  const diet = diets?.find((p) => p.isActive);
  const latest = measurements?.at(-1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title="Workout plan"
        actions={
          write && (
            <>
              {workout && (
                <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'workout', plan: workout })} aria-label="Edit workout">
                  <Pencil className="size-4" />
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'workout' })}>
                <Plus className="size-4" /> New
              </Button>
            </>
          )
        }
      >
        {write && (
          <div className="mb-3">
            <AssignTemplate kind="workout" memberId={member._id} />
          </div>
        )}
        {workout ? (
          <>
            <p className="mb-2 font-semibold">{workout.name}</p>
            <WorkoutView plan={workout} />
          </>
        ) : (
          <EmptyState title="No workout plan yet" />
        )}
      </Card>
      <Card
        title="Diet plan"
        actions={
          write && (
            <>
              {diet && (
                <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'diet', plan: diet })} aria-label="Edit diet">
                  <Pencil className="size-4" />
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'diet' })}>
                <Plus className="size-4" /> New
              </Button>
            </>
          )
        }
      >
        {write && (
          <div className="mb-3">
            <AssignTemplate kind="diet" memberId={member._id} />
          </div>
        )}
        {diet ? (
          <>
            <p className="mb-2 font-semibold">{diet.name}</p>
            <DietView plan={diet} />
          </>
        ) : (
          <EmptyState title="No diet plan yet" />
        )}
      </Card>
      <Card
        title={`Progress${latest?.bmi ? ` · BMI ${latest.bmi}` : ''}`}
        className="lg:col-span-2"
        actions={
          write && (
            <Button size="sm" onClick={() => setModal({ type: 'measure' })}>
              <Plus className="size-4" /> Add measurement
            </Button>
          )
        }
      >
        <WeightChart measurements={measurements} />
        <div className="mt-3">
          <Table
            rows={[...(measurements || [])].reverse()}
            empty={<EmptyState title="No measurements yet" />}
            columns={[
              { key: 'date', label: 'Date', render: (m) => fmtDate(m.date) },
              { key: 'w', label: 'Weight', render: (m) => (m.weightKg ? `${m.weightKg} kg` : '—') },
              { key: 'bmi', label: 'BMI', render: (m) => m.bmi ?? '—' },
              { key: 'bf', label: 'Body fat', render: (m) => (m.bodyFatPercent ? `${m.bodyFatPercent}%` : '—') },
              { key: 'waist', label: 'Waist', render: (m) => (m.waistCm ? `${m.waistCm} cm` : '—') },
              { key: 'by', label: 'By', render: (m) => (m.recordedBy ? 'Trainer' : 'Member') },
              { key: 'x', label: '', render: (m) => write && <Button size="sm" variant="ghost" onClick={() => window.confirm('Delete this measurement?') && remove.mutate(m._id)} aria-label="Delete measurement" title="Delete"><Trash2 className="size-4" /></Button> },
            ]}
          />
        </div>
      </Card>
      <ProgressNotes member={member} measurements={measurements} />
      {modal?.type === 'workout' && <WorkoutBuilder plan={modal.plan} memberId={member._id} onClose={() => setModal(null)} />}
      {modal?.type === 'diet' && <DietBuilder plan={modal.plan} memberId={member._id} onClose={() => setModal(null)} />}
      {modal?.type === 'measure' && <MeasurementForm memberId={member._id} onClose={() => setModal(null)} />}
    </div>
  );
}
