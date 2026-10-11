import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus, Wrench, AlertTriangle, History, Pencil } from 'lucide-react';
import { get, post, put } from '../lib/api';
import { useApi, useAction, useBranches, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, toPaise, toRupees, ymd, daysUntil } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Table, Textarea } from '../components/ui';

const CATEGORIES = ['cardio', 'strength-machine', 'free-weights', 'rack-bench', 'functional', 'other'];
const STATUS_BADGE = { working: 'allow', 'needs-repair': 'upcoming', 'out-of-order': 'deny', retired: 'cancelled' };

function EquipmentForm({ item, onClose }) {
  const { data: branches } = useBranches();
  const defaultBranch = useDefaultBranchId();
  const d = (v) => (v ? ymd(v) : '');
  const [f, setF] = useState(
    item
      ? { ...item, cost: item.cost ? toRupees(item.cost) : '', purchaseDate: d(item.purchaseDate), warrantyUntil: d(item.warrantyUntil), lastServiceAt: d(item.lastServiceAt) }
      : { branchId: defaultBranch, name: '', category: 'cardio', brand: '', model: '', serialNo: '', location: '', purchaseDate: '', cost: '', vendor: '', vendorPhone: '', warrantyUntil: '', serviceIntervalDays: 90, lastServiceAt: '' },
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (item ? put(`/equipment/${item._id}`, b) : post('/equipment', b)), { success: 'Saved', invalidate: ['equipment'], onSuccess: onClose });
  const submit = () =>
    save.mutate({
      branchId: f.branchId,
      name: f.name,
      category: f.category,
      brand: f.brand || undefined,
      model: f.model || undefined,
      serialNo: f.serialNo || undefined,
      location: f.location || undefined,
      purchaseDate: f.purchaseDate || null,
      cost: f.cost === '' ? null : toPaise(f.cost),
      vendor: f.vendor || undefined,
      vendorPhone: f.vendorPhone || undefined,
      warrantyUntil: f.warrantyUntil || null,
      serviceIntervalDays: Number(f.serviceIntervalDays) || 0,
      lastServiceAt: f.lastServiceAt || null,
      ...(item ? { status: f.status } : {}),
    });
  return (
    <Modal open onClose={onClose} title={item ? 'Edit equipment' : 'Add equipment'} size="lg" footer={<Button loading={save.isPending} onClick={submit}>Save</Button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={set('name')} placeholder="Treadmill #2" />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Brand">
          <Input value={f.brand || ''} onChange={set('brand')} />
        </Field>
        <Field label="Model">
          <Input value={f.model || ''} onChange={set('model')} />
        </Field>
        <Field label="Serial no.">
          <Input value={f.serialNo || ''} onChange={set('serialNo')} />
        </Field>
        <Field label="Location">
          <Input value={f.location || ''} onChange={set('location')} placeholder="Cardio zone" />
        </Field>
        <Field label="Purchase date">
          <Input type="date" value={f.purchaseDate} onChange={set('purchaseDate')} />
        </Field>
        <Field label="Cost (₹)">
          <Input type="number" min="0" value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label="Service vendor">
          <Input value={f.vendor || ''} onChange={set('vendor')} />
        </Field>
        <Field label="Vendor phone">
          <Input value={f.vendorPhone || ''} onChange={set('vendorPhone')} />
        </Field>
        <Field label="Warranty until">
          <Input type="date" value={f.warrantyUntil} onChange={set('warrantyUntil')} />
        </Field>
        <Field label="Service every (days)" hint="0 = no regular service">
          <Input type="number" min="0" value={f.serviceIntervalDays} onChange={set('serviceIntervalDays')} />
        </Field>
        <Field label="Last serviced">
          <Input type="date" value={f.lastServiceAt} onChange={set('lastServiceAt')} />
        </Field>
        {item && (
          <Field label="Status">
            <Select value={f.status} onChange={set('status')}>
              {Object.keys(STATUS_BADGE).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        )}
        {branches?.length > 1 && (
          <Field label="Branch">
            <Select value={f.branchId} onChange={set('branchId')}>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

function LogModal({ item, report, onClose }) {
  const [f, setF] = useState({ type: report ? 'issue-reported' : 'service', date: ymd(), cost: '', vendor: item.vendor || '', notes: '', statusAfter: report ? 'needs-repair' : 'working' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction(
    () => post(`/equipment/${item._id}/logs`, { type: f.type, date: f.date, cost: toPaise(f.cost), vendor: f.vendor || undefined, notes: f.notes || undefined, statusAfter: f.statusAfter }),
    { success: report ? 'Problem reported. The manager has been alerted.' : 'Logged', invalidate: ['equipment', 'expenses'], onSuccess: onClose },
  );
  return (
    <Modal open onClose={onClose} title={`${report ? 'Report a problem' : 'Log maintenance'} · ${item.name}`} footer={<Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {!report && (
          <Field label="Type">
            <Select value={f.type} onChange={set('type')}>
              <option value="service">Scheduled service</option>
              <option value="repair">Repair</option>
              <option value="inspection">Inspection</option>
            </Select>
          </Field>
        )}
        <Field label="Status now">
          <Select value={f.statusAfter} onChange={set('statusAfter')}>
            <option value="working">Working</option>
            <option value="needs-repair">Needs repair (usable)</option>
            <option value="out-of-order">Out of order</option>
            {!report && <option value="retired">Retired</option>}
          </Select>
        </Field>
        {!report && (
          <>
            <Field label="Date">
              <Input type="date" max={ymd()} value={f.date} onChange={set('date')} />
            </Field>
            <Field label="Cost (₹)" hint="Added to expenses as maintenance">
              <Input type="number" min="0" value={f.cost} onChange={set('cost')} />
            </Field>
            <Field label="Vendor" className="sm:col-span-2">
              <Input value={f.vendor} onChange={set('vendor')} />
            </Field>
          </>
        )}
        <Field label={report ? 'What is wrong?' : 'Notes'} className="sm:col-span-2">
          <Textarea value={f.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}

function HistoryModal({ item, onClose }) {
  const { data } = useQuery({ queryKey: ['equipment', item._id, 'logs'], queryFn: () => get(`/equipment/${item._id}/logs`, { limit: 50 }) });
  return (
    <Modal open onClose={onClose} title={`History · ${item.name}`} size="lg">
      <Table
        rows={data?.items}
        empty={<EmptyState title="No maintenance yet" />}
        columns={[
          { key: 'd', label: 'Date', render: (l) => fmtDate(l.date) },
          { key: 't', label: 'Type', render: (l) => l.type },
          { key: 'c', label: 'Cost', render: (l) => (l.cost ? inr(l.cost) : '—') },
          { key: 'n', label: 'Notes', className: 'whitespace-normal', render: (l) => l.notes || '—' },
          { key: 'b', label: 'By', render: (l) => l.by?.name },
        ]}
      />
    </Modal>
  );
}

export default function EquipmentPage() {
  const can = useAuth((s) => s.can);
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const { data } = useApi('equipment', '/equipment', { status });
  const c = data?.counts || {};
  return (
    <div>
      <PageHeader
        title="Equipment"
        subtitle="Service schedule and repairs. Anyone can report a broken machine; costs go to expenses."
        actions={can('equipment.manage') && <Button onClick={() => setModal({ type: 'edit' })}><Plus className="size-4" /> Add equipment</Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Working" value={c.working || 0} tone="green" onClick={() => setStatus('working')} />
        <StatCard label="Needs repair" value={c['needs-repair'] || 0} tone="amber" onClick={() => setStatus('needs-repair')} />
        <StatCard label="Out of order" value={c['out-of-order'] || 0} tone="red" onClick={() => setStatus('out-of-order')} />
        <StatCard label="Service due (7 days)" value={data?.dueSoon || 0} tone="indigo" onClick={() => setStatus('')} />
      </div>
      <Card padded={false}>
        <div className="flex gap-2 border-b border-slate-100 p-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            <option value="">All (except retired)</option>
            {Object.keys(STATUS_BADGE).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
        <Table
          rows={data?.items}
          empty={<EmptyState icon={Wrench} title="No equipment registered" />}
          columns={[
            { key: 'n', label: 'Equipment', render: (e) => <span><b>{e.name}</b><span className="block text-xs text-slate-500">{[e.brand, e.model, e.location].filter(Boolean).join(' · ')}</span></span> },
            { key: 'c', label: 'Category', render: (e) => e.category },
            { key: 's', label: 'Status', render: (e) => <span><Badge status={STATUS_BADGE[e.status]}>{e.status}</Badge>{e.issue && <span className="block max-w-48 truncate text-xs text-slate-500">{e.issue}</span>}</span> },
            {
              key: 'due',
              label: 'Next service',
              render: (e) => {
                if (!e.nextServiceDue) return '—';
                const d = daysUntil(e.nextServiceDue);
                return <span className={clsx(d < 0 ? 'font-semibold text-rose-600' : d <= 7 && 'text-amber-600')}>{fmtDate(e.nextServiceDue)}{d < 0 ? ' (overdue)' : ''}</span>;
              },
            },
            { key: 'w', label: 'Warranty', className: 'hidden lg:table-cell', render: (e) => (e.warrantyUntil ? fmtDate(e.warrantyUntil) : '—') },
            {
              key: 'a',
              label: '',
              render: (e) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'report', e })} aria-label="Report problem">
                    <AlertTriangle className="size-4 text-amber-600" />
                  </Button>
                  {can('equipment.manage') && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'log', e })}>
                        <Wrench className="size-3.5" /> Log
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'edit', e })} aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'history', e })} aria-label="History">
                    <History className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {modal?.type === 'edit' && <EquipmentForm item={modal.e} onClose={() => setModal(null)} />}
      {modal?.type === 'log' && <LogModal item={modal.e} onClose={() => setModal(null)} />}
      {modal?.type === 'report' && <LogModal item={modal.e} report onClose={() => setModal(null)} />}
      {modal?.type === 'history' && <HistoryModal item={modal.e} onClose={() => setModal(null)} />}
    </div>
  );
}
