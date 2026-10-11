import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { get, post, put } from '../lib/api';
import { useAction } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, toPaise, toRupees } from '../lib/format';
import Coupons from './Coupons';
import Companies from './Companies';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Select, Textarea, Toggle } from '../components/ui';

const empty = { name: '', description: '', durationValue: 1, durationUnit: 'month', price: '', joiningFee: '', taxPercent: '', freezeDaysAllowed: 0, maxFreezes: 1, accessStart: '', accessEnd: '', deviceTimezoneId: 1, maxMembers: 1, isActive: true };

function PlanForm({ plan, onClose }) {
  const [f, setF] = useState(
    plan
      ? { ...plan, price: toRupees(plan.price), joiningFee: toRupees(plan.joiningFee), taxPercent: plan.taxPercent ?? '' }
      : empty,
  );
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const save = useAction((body) => (plan ? put(`/plans/${plan._id}`, body) : post('/plans', body)), {
    success: 'Plan saved',
    invalidate: ['plans'],
    onSuccess: onClose,
  });
  const submit = () =>
    save.mutate({
      name: f.name,
      description: f.description || undefined,
      durationValue: Number(f.durationValue),
      durationUnit: f.durationUnit,
      price: toPaise(f.price),
      joiningFee: toPaise(f.joiningFee),
      taxPercent: f.taxPercent === '' ? null : Number(f.taxPercent),
      freezeDaysAllowed: Number(f.freezeDaysAllowed),
      maxFreezes: Number(f.maxFreezes),
      accessStart: f.accessStart || null,
      accessEnd: f.accessEnd || null,
      deviceTimezoneId: Number(f.deviceTimezoneId) || 1,
      maxMembers: Number(f.maxMembers) || 1,
      isActive: f.isActive,
    });
  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? 'Edit plan' : 'New plan'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan name" required className="sm:col-span-2">
          <Input value={f.name} onChange={set('name')} placeholder="Quarterly" />
        </Field>
        <Field label="Duration">
          <div className="flex gap-2">
            <Input type="number" min="1" value={f.durationValue} onChange={set('durationValue')} className="w-20" />
            <Select value={f.durationUnit} onChange={set('durationUnit')}>
              <option value="month">Month(s)</option>
              <option value="day">Day(s)</option>
            </Select>
          </div>
        </Field>
        <Field label="Price (₹, before GST)" required>
          <Input type="number" min="0" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="Joining fee (₹)" hint="Charged on a member's first membership only">
          <Input type="number" min="0" value={f.joiningFee} onChange={set('joiningFee')} />
        </Field>
        <Field label="GST %" hint="Empty = gym default">
          <Input type="number" min="0" max="50" value={f.taxPercent} onChange={set('taxPercent')} />
        </Field>
        <Field label="Freeze days allowed">
          <Input type="number" min="0" value={f.freezeDaysAllowed} onChange={set('freezeDaysAllowed')} />
        </Field>
        <Field label="Max number of freezes">
          <Input type="number" min="0" value={f.maxFreezes} onChange={set('maxFreezes')} />
        </Field>
        <Field label="Members covered" hint="2 = couple plan, 4 = family plan">
          <Input type="number" min="1" max="10" value={f.maxMembers ?? 1} onChange={set('maxMembers')} />
        </Field>
        <div />
        <Field label="Entry from (optional)" hint="Time-slot plan, e.g. morning only">
          <Input type="time" value={f.accessStart || ''} onChange={set('accessStart')} />
        </Field>
        <Field label="Entry until">
          <Input type="time" value={f.accessEnd || ''} onChange={set('accessEnd')} />
        </Field>
        {f.accessStart && (
          <Field label="Device access time-zone no." hint="The time-zone number set up on the biometric device for this slot" className="sm:col-span-2">
            <Input type="number" min="1" max="50" value={f.deviceTimezoneId ?? 1} onChange={set('deviceTimezoneId')} />
          </Field>
        )}
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={f.description || ''} onChange={set('description')} />
        </Field>
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Available for new memberships" />
      </div>
    </Modal>
  );
}

export default function Plans() {
  const [editing, setEditing] = useState(null);
  const can = useAuth((s) => s.can);
  const { data, isLoading } = useQuery({ queryKey: ['plans'], queryFn: () => get('/plans') });
  if (isLoading) return <PageLoader />;
  return (
    <div>
      <PageHeader
        title="Membership plans"
        subtitle="Editing a plan never changes existing memberships or invoices"
        actions={
          can('plans.write') && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> New plan
            </Button>
          )
        }
      />
      {!data?.length ? (
        <Card>
          <EmptyState title="No plans yet" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card key={p._id} className={p.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-500">
                    {p.durationValue} {p.durationUnit}
                    {p.durationValue > 1 ? 's' : ''}
                  </p>
                </div>
                {!p.isActive && <Badge status="cancelled">Inactive</Badge>}
              </div>
              <p className="mt-3 text-2xl font-bold text-brand-800">{inr(p.price)}</p>
              <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                {p.joiningFee > 0 && <li>+ {inr(p.joiningFee)} joining fee</li>}
                <li>GST {p.taxPercent ?? 'default'}{p.taxPercent != null && '%'}</li>
                <li>{p.freezeDaysAllowed ? `${p.freezeDaysAllowed} freeze days (max ${p.maxFreezes}×)` : 'No freeze'}</li>
                {p.accessStart && <li className="text-indigo-700">Entry {p.accessStart}–{p.accessEnd} only</li>}
                {p.maxMembers > 1 && <li className="text-emerald-700">Covers {p.maxMembers} members</li>}
              </ul>
              {can('plans.write') && (
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(p)}>
                  <Pencil className="size-3.5" /> Edit
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 space-y-6">
        <Coupons />
        <Companies />
      </div>
      {editing && <PlanForm plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
