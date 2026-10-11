import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Library, Trash2 } from 'lucide-react';
import { del, get, post } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Table, Tabs } from '../../components/ui';
import { WorkoutBuilder, DietBuilder } from './Builders';

const GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'cardio', 'full-body', 'mobility'];

function Exercises() {
  const can = useAuth((s) => s.can);
  const [group, setGroup] = useState('');
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', muscleGroup: 'chest', equipment: '' });
  const { data } = useQuery({ queryKey: ['exercises', group], queryFn: () => get('/fitness/exercises', { muscleGroup: group || undefined }) });
  const defaults = useAction(() => post('/fitness/exercises/defaults'), { success: (d) => `${d.added} exercises added`, invalidate: ['exercises'] });
  const add = useAction((b) => post('/fitness/exercises', b), { success: 'Exercise added', invalidate: ['exercises'], onSuccess: () => setAdding(false) });
  return (
    <Card
      padded={false}
      title="Exercise library"
      actions={
        can('fitness.write') && (
          <>
            <Button size="sm" variant="secondary" loading={defaults.isPending} onClick={() => defaults.mutate()}>
              <Library className="size-4" /> Load starter library
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Exercise
            </Button>
          </>
        )
      }
    >
      <div className="border-b border-slate-100 p-3">
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-auto capitalize">
          <option value="">All muscle groups</option>
          {GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
      </div>
      <Table
        rows={data}
        empty={<EmptyState title="No exercises yet">Use “Load starter library” to add 35+ common exercises.</EmptyState>}
        columns={[
          { key: 'name', label: 'Exercise', render: (e) => <b>{e.name}</b> },
          { key: 'g', label: 'Muscle group', render: (e) => <span className="capitalize">{e.muscleGroup}</span> },
          { key: 'eq', label: 'Equipment', render: (e) => e.equipment },
        ]}
      />
      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Add exercise" size="sm" footer={<Button loading={add.isPending} onClick={() => add.mutate(f)}>Save</Button>}>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Muscle group">
              <Select value={f.muscleGroup} onChange={(e) => setF({ ...f, muscleGroup: e.target.value })}>
                {GROUPS.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment">
              <Input value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} placeholder="dumbbell" />
            </Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function Templates({ kind }) {
  const path = kind === 'workout' ? 'workout-plans' : 'diet-plans';
  const can = useAuth((s) => s.can);
  const [edit, setEdit] = useState(null);
  const { data } = useQuery({ queryKey: ['fitness', path, 'templates'], queryFn: () => get(`/fitness/${path}`) });
  const remove = useAction((id) => del(`/fitness/${path}/${id}`), { success: 'Template removed', invalidate: ['fitness'] });
  const Builder = kind === 'workout' ? WorkoutBuilder : DietBuilder;
  return (
    <Card
      padded={false}
      title={kind === 'workout' ? 'Workout templates' : 'Diet templates'}
      actions={
        can('fitness.write') && (
          <Button size="sm" onClick={() => setEdit('new')}>
            <Plus className="size-4" /> New template
          </Button>
        )
      }
    >
      <Table
        rows={data}
        empty={<EmptyState title="No templates yet">Templates can be assigned to members in one click from their Fitness tab.</EmptyState>}
        columns={[
          { key: 'name', label: 'Name', render: (p) => <b>{p.name}</b> },
          {
            key: 'info',
            label: kind === 'workout' ? 'Days' : 'Calories',
            render: (p) => (kind === 'workout' ? `${p.days.length} day(s) · ${p.level}` : p.dailyCalories ? `${p.dailyCalories} kcal` : '—'),
          },
          { key: 'goal', label: 'Goal', render: (p) => <Badge status="upcoming">{p.goal || p.preference}</Badge> },
          {
            key: 'a',
            label: '',
            render: (p) =>
              can('fitness.write') && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(p)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => window.confirm('Remove this template?') && remove.mutate(p._id)} aria-label="Remove">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ),
          },
        ]}
      />
      {edit && <Builder plan={edit === 'new' ? null : edit} memberId={null} onClose={() => setEdit(null)} />}
    </Card>
  );
}

export default function FitnessLibrary() {
  const [tab, setTab] = useState('workout');
  return (
    <div>
      <PageHeader title="Workouts & diet" subtitle="Templates and the exercise library. Plans for a member are set from the member's Fitness tab." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'workout', label: 'Workout templates' },
          { value: 'diet', label: 'Diet templates' },
          { value: 'exercises', label: 'Exercise library' },
        ]}
      />
      {tab === 'workout' && <Templates kind="workout" />}
      {tab === 'diet' && <Templates kind="diet" />}
      {tab === 'exercises' && <Exercises />}
    </div>
  );
}
