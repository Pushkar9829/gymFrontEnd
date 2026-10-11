import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';

export function WorkoutView({ plan }) {
  if (!plan) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 capitalize">
        {plan.goal?.replace('-', ' ')} · {plan.level}
        {plan.createdBy?.name && ` · by ${plan.createdBy.name}`}
      </p>
      {plan.days.map((d, i) => (
        <div key={i} className="rounded-xl ring-1 ring-slate-200">
          <p className="border-b border-slate-100 px-3 py-2 text-sm font-semibold">{d.name}</p>
          <ul className="divide-y divide-slate-100">
            {d.exercises.map((e, k) => (
              <li key={k} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium">{e.name}</span>
                <span className="text-right text-slate-600">
                  {e.sets} × {e.reps}
                  {e.weight && ` · ${e.weight}`}
                  {e.restSec ? <span className="block text-xs text-slate-400">rest {e.restSec}s</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {plan.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm">{plan.notes}</p>}
    </div>
  );
}

export function DietView({ plan }) {
  if (!plan) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {plan.preference} {plan.dailyCalories ? `· ${plan.dailyCalories} kcal/day` : ''} {plan.proteinGrams ? `· ${plan.proteinGrams} g protein` : ''}
        {plan.createdBy?.name && ` · by ${plan.createdBy.name}`}
      </p>
      {plan.meals.map((m, i) => (
        <div key={i} className="rounded-xl ring-1 ring-slate-200">
          <p className="flex justify-between border-b border-slate-100 px-3 py-2 text-sm font-semibold">
            {m.name} <span className="font-normal text-slate-500">{m.time}</span>
          </p>
          <ul className="divide-y divide-slate-100">
            {m.items.map((x, k) => (
              <li key={k} className="flex justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {x.food} {x.quantity && <span className="text-slate-500">· {x.quantity}</span>}
                </span>
                <span className="text-slate-500">{x.calories ? `${x.calories} kcal` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {plan.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm">{plan.notes}</p>}
    </div>
  );
}

export function WeightChart({ measurements }) {
  const data = (measurements || []).filter((m) => m.weightKg).map((m) => ({ day: dayjs(m.date).format('DD MMM'), Weight: m.weightKg, Waist: m.waistCm }));
  if (data.length < 2) return <p className="text-sm text-slate-500">Add at least two weight entries to see the progress chart.</p>;
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
          <Tooltip />
          <Line type="monotone" dataKey="Weight" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Waist" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
