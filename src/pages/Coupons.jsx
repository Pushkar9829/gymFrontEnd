import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, TicketPercent } from 'lucide-react';
import { get, post, put } from '../lib/api';
import { useAction } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, toPaise, toRupees, ymd } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Table, Toggle } from '../components/ui';

function CouponForm({ coupon, plans, onClose }) {
  const [f, setF] = useState(
    coupon
      ? {
          ...coupon,
          value: coupon.type === 'flat' ? toRupees(coupon.value) : coupon.value,
          maxDiscount: coupon.maxDiscount ? toRupees(coupon.maxDiscount) : '',
          validFrom: coupon.validFrom ? ymd(coupon.validFrom) : '',
          validTo: coupon.validTo ? ymd(coupon.validTo) : '',
          maxUses: coupon.maxUses ?? '',
        }
      : { code: '', description: '', type: 'percent', value: 10, maxDiscount: '', validFrom: '', validTo: '', maxUses: '', planIds: [], newMembersOnly: false, isActive: true },
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (coupon ? put(`/coupons/${coupon._id}`, b) : post('/coupons', b)), { success: 'Coupon saved', invalidate: ['coupons'], onSuccess: onClose });
  const submit = () =>
    save.mutate({
      code: f.code,
      description: f.description || undefined,
      type: f.type,
      value: f.type === 'flat' ? toPaise(f.value) : Number(f.value),
      maxDiscount: f.type === 'percent' && f.maxDiscount !== '' ? toPaise(f.maxDiscount) : null,
      validFrom: f.validFrom || null,
      validTo: f.validTo ? `${f.validTo}T23:59:59+05:30` : null,
      maxUses: f.maxUses === '' ? null : Number(f.maxUses),
      planIds: f.planIds,
      newMembersOnly: f.newMembersOnly,
      isActive: f.isActive,
    });
  const togglePlan = (id) => setF({ ...f, planIds: f.planIds.includes(id) ? f.planIds.filter((p) => p !== id) : [...f.planIds, id] });
  return (
    <Modal open onClose={onClose} title={coupon ? 'Edit coupon' : 'New coupon'} footer={<Button loading={save.isPending} onClick={submit}>Save</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Code" hint="Members type this at the counter or in the app">
          <Input value={f.code} onChange={set('code')} className="uppercase" disabled={!!coupon} />
        </Field>
        <Field label="Type">
          <Select value={f.type} onChange={set('type')}>
            <option value="percent">Percentage off</option>
            <option value="flat">Flat ₹ off</option>
          </Select>
        </Field>
        <Field label={f.type === 'percent' ? 'Percent (%)' : 'Amount (₹)'}>
          <Input type="number" min="1" value={f.value} onChange={set('value')} />
        </Field>
        {f.type === 'percent' && (
          <Field label="Max discount (₹)" hint="Optional cap">
            <Input type="number" min="0" value={f.maxDiscount} onChange={set('maxDiscount')} />
          </Field>
        )}
        <Field label="Valid from">
          <Input type="date" value={f.validFrom} onChange={set('validFrom')} />
        </Field>
        <Field label="Valid till">
          <Input type="date" value={f.validTo} onChange={set('validTo')} />
        </Field>
        <Field label="Max uses" hint="Empty = unlimited">
          <Input type="number" min="1" value={f.maxUses} onChange={set('maxUses')} />
        </Field>
        <Field label="Description">
          <Input value={f.description || ''} onChange={set('description')} placeholder="Diwali offer" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium text-slate-700">Valid for plans (none selected = all)</p>
          <div className="flex flex-wrap gap-3">
            {plans?.map((p) => (
              <label key={p._id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={f.planIds.includes(p._id)} onChange={() => togglePlan(p._id)} />
                {p.name}
              </label>
            ))}
          </div>
        </div>
        <Toggle checked={f.newMembersOnly} onChange={(v) => setF({ ...f, newMembersOnly: v })} label="New members only" />
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}

export default function Coupons() {
  const can = useAuth((s) => s.can);
  const [edit, setEdit] = useState(null);
  const { data } = useQuery({ queryKey: ['coupons'], queryFn: () => get('/coupons') });
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => get('/plans') });
  return (
    <Card
      title="Coupon codes"
      padded={false}
      actions={
        can('plans.write') && (
          <Button size="sm" onClick={() => setEdit('new')}>
            <Plus className="size-4" /> New coupon
          </Button>
        )
      }
    >
      <Table
        rows={data}
        empty={<EmptyState icon={TicketPercent} title="No coupons yet" />}
        columns={[
          { key: 'code', label: 'Code', render: (c) => <b className="font-mono">{c.code}</b> },
          { key: 'off', label: 'Discount', render: (c) => (c.type === 'percent' ? `${c.value}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ''}` : inr(c.value)) },
          { key: 'valid', label: 'Valid', render: (c) => (c.validTo ? `till ${fmtDate(c.validTo)}` : 'No expiry') },
          { key: 'uses', label: 'Used', render: (c) => `${c.usedCount}${c.maxUses ? ` / ${c.maxUses}` : ''}` },
          { key: 'st', label: 'Status', render: (c) => <Badge status={c.isActive ? 'allow' : 'cancelled'}>{c.isActive ? 'Active' : 'Off'}</Badge> },
          { key: 'e', label: '', render: (c) => can('plans.write') && <Button size="sm" variant="ghost" aria-label="Edit coupon" title="Edit" onClick={() => setEdit(c)}><Pencil className="size-4" /></Button> },
        ]}
      />
      {edit && <CouponForm coupon={edit === 'new' ? null : edit} plans={plans} onClose={() => setEdit(null)} />}
    </Card>
  );
}
