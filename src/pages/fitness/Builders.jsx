import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { get, post, put } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';

const GOALS = ['general-fitness', 'weight-loss', 'muscle-gain', 'strength', 'endurance', 'rehab'];
const emptyExercise = () => ({ name: '', sets: 3, reps: '10', weight: '', restSec: 60 });

/** Create / edit a workout plan. memberId = null creates a reusable template. */
export function WorkoutBuilder({ plan, memberId = null, onClose }) {
  const { data: library } = useQuery({ queryKey: ['exercises'], queryFn: () => get('/fitness/exercises') });
  const [f, setF] = useState(
    plan
      ? { name: plan.name, goal: plan.goal, level: plan.level, notes: plan.notes || '', days: plan.days.map((d) => ({ name: d.name, exercises: d.exercises.map((e) => ({ ...e })) })) }
      : { name: '', goal: 'general-fitness', level: 'beginner', notes: '', days: [{ name: 'Day 1', exercises: [emptyExercise()] }] },
  );
  const save = useAction((b) => (plan ? put(`/fitness/workout-plans/${plan._id}`, b) : post('/fitness/workout-plans', b)), {
    success: 'Workout plan saved',
    invalidate: ['fitness'],
    onSuccess: onClose,
  });

  const setDay = (i, patch) => setF({ ...f, days: f.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setEx = (i, k, patch) => setDay(i, { exercises: f.days[i].exercises.map((e, j) => (j === k ? { ...e, ...patch } : e)) });

  const submit = () =>
    save.mutate({
      ...(plan ? {} : { memberId }),
      name: f.name,
      goal: f.goal,
      level: f.level,
      notes: f.notes || undefined,
      days: f.days.map((d) => ({
        name: d.name,
        exercises: d.exercises
          .filter((e) => e.name.trim())
          .map((e) => ({ exerciseId: e.exerciseId || null, name: e.name, sets: Number(e.sets) || 1, reps: String(e.reps || ''), weight: e.weight || undefined, restSec: Number(e.restSec) || 0, notes: e.notes || undefined })),
      })),
    });

  return (
    <Modal open onClose={onClose} title={plan ? 'Edit workout plan' : memberId ? 'New workout plan' : 'New workout template'} size="xl" footer={<Button loading={save.isPending} onClick={submit}>Save plan</Button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Plan name" className="sm:col-span-3">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Beginner 3-day split" />
        </Field>
        <Field label="Goal">
          <Select value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>
            {GOALS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Level">
          <Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            <option>beginner</option>
            <option>intermediate</option>
            <option>advanced</option>
          </Select>
        </Field>
      </div>
      <datalist id="exercise-library">
        {library?.map((x) => (
          <option key={x._id} value={x.name}>
            {x.muscleGroup}
          </option>
        ))}
      </datalist>
      <div className="mt-4 space-y-4">
        {f.days.map((d, i) => (
          <div key={i} className="rounded-xl p-3 ring-1 ring-slate-200">
            <div className="mb-2 flex items-center gap-2">
              <Input value={d.name} onChange={(e) => setDay(i, { name: e.target.value })} className="font-semibold" />
              <Button size="sm" variant="ghost" className="text-rose-600" disabled={f.days.length === 1} onClick={() => setF({ ...f, days: f.days.filter((_, j) => j !== i) })} aria-label="Remove day">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
              <span className="col-span-5">Exercise</span>
              <span className="col-span-1">Sets</span>
              <span className="col-span-2">Reps</span>
              <span className="col-span-2">Weight</span>
              <span className="col-span-1">Rest s</span>
            </div>
            {d.exercises.map((e, k) => (
              <div key={k} className="mt-1 grid grid-cols-12 gap-2">
                <Input
                  className="col-span-12 sm:col-span-5"
                  list="exercise-library"
                  value={e.name}
                  placeholder="Exercise"
                  onChange={(ev) => setEx(i, k, { name: ev.target.value, exerciseId: library?.find((x) => x.name === ev.target.value)?._id })}
                />
                <Input className="col-span-3 sm:col-span-1" type="number" min="1" value={e.sets} onChange={(ev) => setEx(i, k, { sets: ev.target.value })} />
                <Input className="col-span-3 sm:col-span-2" value={e.reps} onChange={(ev) => setEx(i, k, { reps: ev.target.value })} />
                <Input className="col-span-3 sm:col-span-2" value={e.weight || ''} placeholder="kg" onChange={(ev) => setEx(i, k, { weight: ev.target.value })} />
                <Input className="col-span-2 sm:col-span-1" type="number" min="0" value={e.restSec} onChange={(ev) => setEx(i, k, { restSec: ev.target.value })} />
                <button className="col-span-1 text-slate-400 hover:text-rose-600" onClick={() => setDay(i, { exercises: d.exercises.filter((_, j) => j !== k) })} aria-label="Remove exercise">
                  <Trash2 className="mx-auto size-4" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setDay(i, { exercises: [...d.exercises, emptyExercise()] })}>
              <Plus className="size-4" /> Exercise
            </Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setF({ ...f, days: [...f.days, { name: `Day ${f.days.length + 1}`, exercises: [emptyExercise()] }] })}>
          <Plus className="size-4" /> Add day
        </Button>
        <Field label="Notes">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Warm up 10 min before each session" />
        </Field>
      </div>
    </Modal>
  );
}

const emptyItem = () => ({ food: '', quantity: '', calories: '', protein: '' });

export function DietBuilder({ plan, memberId = null, onClose }) {
  const [f, setF] = useState(
    plan
      ? { ...plan, dailyCalories: plan.dailyCalories ?? '', proteinGrams: plan.proteinGrams ?? '', meals: plan.meals.map((m) => ({ ...m, items: m.items.map((x) => ({ ...x })) })) }
      : {
          name: '',
          goal: '',
          preference: 'veg',
          dailyCalories: '',
          proteinGrams: '',
          notes: '',
          meals: ['Breakfast|08:00', 'Lunch|13:00', 'Snack|17:00', 'Dinner|20:30'].map((x) => ({ name: x.split('|')[0], time: x.split('|')[1], items: [emptyItem()] })),
        },
  );
  const save = useAction((b) => (plan ? put(`/fitness/diet-plans/${plan._id}`, b) : post('/fitness/diet-plans', b)), { success: 'Diet plan saved', invalidate: ['fitness'], onSuccess: onClose });
  const setMeal = (i, patch) => setF({ ...f, meals: f.meals.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const setItem = (i, k, patch) => setMeal(i, { items: f.meals[i].items.map((x, j) => (j === k ? { ...x, ...patch } : x)) });
  const totalCalories = f.meals.reduce((s, m) => s + m.items.reduce((a, x) => a + (Number(x.calories) || 0), 0), 0);
  const n = (v) => (v === '' || v == null ? null : Number(v));

  const submit = () =>
    save.mutate({
      ...(plan ? {} : { memberId }),
      name: f.name,
      goal: f.goal || undefined,
      preference: f.preference,
      dailyCalories: n(f.dailyCalories),
      proteinGrams: n(f.proteinGrams),
      notes: f.notes || undefined,
      meals: f.meals.map((m) => ({
        name: m.name,
        time: m.time || undefined,
        notes: m.notes || undefined,
        items: m.items.filter((x) => x.food.trim()).map((x) => ({ food: x.food, quantity: x.quantity || undefined, calories: n(x.calories), protein: n(x.protein) })),
      })),
    });

  return (
    <Modal open onClose={onClose} title={plan ? 'Edit diet plan' : memberId ? 'New diet plan' : 'New diet template'} size="xl" footer={<Button loading={save.isPending} onClick={submit}>Save plan</Button>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Plan name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Veg 1800 kcal" />
        </Field>
        <Field label="Preference">
          <Select value={f.preference} onChange={(e) => setF({ ...f, preference: e.target.value })}>
            <option value="veg">Veg</option>
            <option value="egg">Eggetarian</option>
            <option value="non-veg">Non-veg</option>
            <option value="vegan">Vegan</option>
          </Select>
        </Field>
        <Field label="Goal">
          <Input value={f.goal || ''} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="Fat loss" />
        </Field>
        <Field label="Target kcal / day" hint={`Meals add up to ${totalCalories} kcal`}>
          <Input type="number" value={f.dailyCalories} onChange={(e) => setF({ ...f, dailyCalories: e.target.value })} />
        </Field>
        <Field label="Protein g / day">
          <Input type="number" value={f.proteinGrams} onChange={(e) => setF({ ...f, proteinGrams: e.target.value })} />
        </Field>
      </div>
      <div className="mt-4 space-y-3">
        {f.meals.map((m, i) => (
          <div key={i} className="rounded-xl p-3 ring-1 ring-slate-200">
            <div className="mb-2 flex gap-2">
              <Input value={m.name} onChange={(e) => setMeal(i, { name: e.target.value })} className="font-semibold" />
              <Input type="time" value={m.time || ''} onChange={(e) => setMeal(i, { time: e.target.value })} className="w-32" />
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setF({ ...f, meals: f.meals.filter((_, j) => j !== i) })} disabled={f.meals.length === 1} aria-label="Remove meal">
                <Trash2 className="size-4" />
              </Button>
            </div>
            {m.items.map((x, k) => (
              <div key={k} className="mt-1 grid grid-cols-12 gap-2">
                <Input className="col-span-12 sm:col-span-5" placeholder="Food" value={x.food} onChange={(e) => setItem(i, k, { food: e.target.value })} />
                <Input className="col-span-4 sm:col-span-3" placeholder="Qty" value={x.quantity || ''} onChange={(e) => setItem(i, k, { quantity: e.target.value })} />
                <Input className="col-span-4 sm:col-span-2" type="number" placeholder="kcal" value={x.calories ?? ''} onChange={(e) => setItem(i, k, { calories: e.target.value })} />
                <Input className="col-span-3 sm:col-span-1" type="number" placeholder="P g" value={x.protein ?? ''} onChange={(e) => setItem(i, k, { protein: e.target.value })} />
                <button className="col-span-1 text-slate-400 hover:text-rose-600" onClick={() => setMeal(i, { items: m.items.filter((_, j) => j !== k) })} aria-label="Remove item">
                  <Trash2 className="mx-auto size-4" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setMeal(i, { items: [...m.items, emptyItem()] })}>
              <Plus className="size-4" /> Food item
            </Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setF({ ...f, meals: [...f.meals, { name: 'Meal', time: '', items: [emptyItem()] }] })}>
          <Plus className="size-4" /> Add meal
        </Button>
        <Field label="Notes">
          <Textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Drink 3 litres of water a day" />
        </Field>
      </div>
    </Modal>
  );
}
