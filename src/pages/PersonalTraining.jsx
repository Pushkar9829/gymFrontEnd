import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Plus, Pencil, CheckCircle2, UserX, Undo2 } from 'lucide-react';
import { del, get, post, put } from '../lib/api';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, fmtDateTime, toPaise, toRupees, ymd, daysUntil } from '../lib/format';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Spinner, StatCard, Table, Tabs, Textarea, Toggle } from '../components/ui';

export function LogSessionModal({ purchase, onClose }) {
  const [status, setStatus] = useState('done');
  const [notes, setNotes] = useState('');
  const save = useAction((b) => post(`/pt/purchases/${purchase._id}/sessions`, b), {
    success: (d) => `Session logged. ${d.purchase.sessionsTotal - d.purchase.sessionsUsed} left.`,
    invalidate: ['pt', 'member'],
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Log session · ${purchase.memberId?.name || ''}`}
      size="sm"
      footer={
        <Button loading={save.isPending} onClick={() => save.mutate({ status, notes: notes || undefined })}>
          Save
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {purchase.package?.name}: {purchase.sessionsTotal - purchase.sessionsUsed} of {purchase.sessionsTotal} sessions left.
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant={status === 'done' ? 'primary' : 'secondary'} onClick={() => setStatus('done')}>
          <CheckCircle2 className="size-4" /> Done
        </Button>
        <Button variant={status === 'no-show' ? 'danger' : 'secondary'} onClick={() => setStatus('no-show')}>
          <UserX className="size-4" /> No-show
        </Button>
      </div>
      <Field label="Notes (workout done, progress…)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="mt-2 text-xs text-slate-500">A no-show also uses one session.</p>
    </Modal>
  );
}

function ActivePackages() {
  const [page, setPage] = useState(1);
  const [logFor, setLogFor] = useState(null);
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const { data, isLoading } = useApi(['pt', 'purchases'], '/pt/purchases', { state: 'active', page });
  if (isLoading) return <Spinner />;
  return (
    <Card padded={false}>
      <Table
        rows={data?.items}
        empty={<EmptyState title="No active PT packages">Sell a PT package from the member's page, Personal training tab.<div><Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate('/admin/members')}>Go to members</Button></div></EmptyState>}
        columns={[
          {
            key: 'm',
            label: 'Member',
            render: (p) => (
              <button className="flex items-center gap-2 text-left" onClick={() => navigate(`/admin/members/${p.memberId?._id}`)}>
                <Avatar name={p.memberId?.name} src={p.memberId?.photoUrl} size="sm" />
                <span>
                  <span className="block font-medium text-slate-900">{p.memberId?.name}</span>
                  <span className="text-xs text-slate-500">#{p.memberId?.memberCode}</span>
                </span>
              </button>
            ),
          },
          { key: 'pkg', label: 'Package', render: (p) => p.package?.name },
          { key: 'trainer', label: 'Trainer', render: (p) => p.trainerId?.name },
          {
            key: 'left',
            label: 'Sessions left',
            render: (p) => (
              <span className="font-semibold">
                {p.sessionsTotal - p.sessionsUsed}
                <span className="font-normal text-slate-400"> / {p.sessionsTotal}</span>
              </span>
            ),
          },
          { key: 'valid', label: 'Valid till', render: (p) => <span className={daysUntil(p.validTo) <= 7 ? 'text-amber-600' : ''}>{fmtDate(p.validTo)}</span> },
          { key: 'due', label: 'Due', render: (p) => (p.dueAmount ? <span className="text-rose-600">{inr(p.dueAmount)}</span> : '—') },
          { key: 'a', label: '', render: (p) => can('pt.log') && <Button size="sm" onClick={() => setLogFor(p)}>Log session</Button> },
        ]}
      />
      <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
      {logFor && <LogSessionModal purchase={logFor} onClose={() => setLogFor(null)} />}
    </Card>
  );
}

function Sessions() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(ymd(dayjs().startOf('month')));
  const [to, setTo] = useState(ymd());
  const { data } = useApi(['pt', 'sessions'], '/pt/sessions', { from, to, page });
  const undo = useAction((id) => del(`/pt/sessions/${id}`), { success: 'Session removed and given back', invalidate: ['pt'] });
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <span className="text-slate-400">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      </div>
      <Table
        rows={data?.items}
        empty={<EmptyState title="No sessions in this period" />}
        columns={[
          { key: 'at', label: 'When', render: (s) => fmtDateTime(s.at) },
          { key: 'm', label: 'Member', render: (s) => `${s.memberId?.name} (#${s.memberId?.memberCode})` },
          { key: 't', label: 'Trainer', render: (s) => s.trainerId?.name },
          { key: 'st', label: 'Status', render: (s) => <Badge status={s.status === 'done' ? 'allow' : 'deny'}>{s.status}</Badge> },
          { key: 'n', label: 'Notes', className: 'max-w-xs truncate', render: (s) => s.notes || '—' },
          {
            key: 'u',
            label: '',
            render: (s) =>
              Date.now() - new Date(s.createdAt) < 48 * 3600 * 1000 && (
                <Button size="sm" variant="ghost" onClick={() => window.confirm('Remove this session and give it back?') && undo.mutate(s._id)} aria-label="Undo">
                  <Undo2 className="size-4" />
                </Button>
              ),
          },
        ]}
      />
      <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
    </Card>
  );
}

function Commission() {
  const [from, setFrom] = useState(ymd(dayjs().startOf('month')));
  const [to, setTo] = useState(ymd());
  const { data } = useApi(['pt', 'commission'], '/pt/commission', { from, to });
  const total = (data || []).reduce((s, r) => s + r.commission, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <span className="text-slate-400">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Sessions" value={(data || []).reduce((s, r) => s + r.sessions, 0)} />
        <StatCard label="Trainer commission" value={inr(total)} tone="amber" />
      </div>
      <Card title="By trainer" padded={false}>
        <Table
          rows={data}
          empty={<EmptyState title="No sessions in this period" />}
          columns={[
            { key: 'trainer', label: 'Trainer', render: (r) => <b>{r.trainer}</b> },
            { key: 'sessions', label: 'Sessions done' },
            { key: 'noShows', label: 'No-shows' },
            { key: 'clients', label: 'Clients' },
            { key: 'commission', label: 'Commission', render: (r) => inr(r.commission) },
          ]}
        />
      </Card>
      <p className="text-xs text-slate-500">Commission per session = package price after discount ÷ sessions × trainer's commission % (set in Settings → Staff).</p>
    </div>
  );
}

function PackageForm({ pkg, onClose }) {
  const [f, setF] = useState(pkg ? { ...pkg, price: toRupees(pkg.price), taxPercent: pkg.taxPercent ?? '' } : { name: '', sessions: 12, validityDays: 60, price: '', taxPercent: '', description: '', isActive: true });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (pkg ? put(`/pt/packages/${pkg._id}`, b) : post('/pt/packages', b)), { success: 'Package saved', invalidate: ['pt'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={pkg ? 'Edit PT package' : 'New PT package'}
      footer={
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              name: f.name,
              sessions: Number(f.sessions),
              validityDays: Number(f.validityDays),
              price: toPaise(f.price),
              taxPercent: f.taxPercent === '' ? null : Number(f.taxPercent),
              description: f.description || undefined,
              isActive: f.isActive,
            })
          }
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={set('name')} placeholder="12 sessions" />
        </Field>
        <Field label="Sessions">
          <Input type="number" min="1" value={f.sessions} onChange={set('sessions')} />
        </Field>
        <Field label="Valid for (days)">
          <Input type="number" min="1" value={f.validityDays} onChange={set('validityDays')} />
        </Field>
        <Field label="Price (₹, before GST)">
          <Input type="number" min="0" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="GST %" hint="Empty = gym default">
          <Input type="number" min="0" value={f.taxPercent} onChange={set('taxPercent')} />
        </Field>
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Available for sale" />
      </div>
    </Modal>
  );
}

function Packages() {
  const can = useAuth((s) => s.can);
  const [edit, setEdit] = useState(null);
  const { data } = useQuery({ queryKey: ['pt', 'packages'], queryFn: () => get('/pt/packages') });
  return (
    <Card
      title="PT packages"
      padded={false}
      actions={
        can('pt.manage') && (
          <Button size="sm" onClick={() => setEdit('new')}>
            <Plus className="size-4" /> New package
          </Button>
        )
      }
    >
      <Table
        rows={data}
        empty={<EmptyState title="No PT packages yet">Create packages like “12 sessions in 60 days” to sell to members.<div>{can('pt.manage') && (<Button size="sm" className="mt-3" onClick={() => setEdit('new')}><Plus className="size-4" /> New package</Button>)}</div></EmptyState>}
        columns={[
          { key: 'name', label: 'Package', render: (p) => <b>{p.name}</b> },
          { key: 's', label: 'Sessions', render: (p) => p.sessions },
          { key: 'v', label: 'Validity', render: (p) => `${p.validityDays} days` },
          { key: 'p', label: 'Price', render: (p) => inr(p.price) },
          { key: 'per', label: 'Per session', render: (p) => inr(Math.round(p.price / p.sessions)) },
          { key: 'a', label: 'Status', render: (p) => <Badge status={p.isActive ? 'allow' : 'cancelled'}>{p.isActive ? 'On sale' : 'Off'}</Badge> },
          { key: 'e', label: '', render: (p) => can('pt.manage') && <Button size="sm" variant="ghost" aria-label="Edit package" title="Edit" onClick={() => setEdit(p)}><Pencil className="size-4" /></Button> },
        ]}
      />
      {edit && <PackageForm pkg={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

export default function PersonalTraining() {
  const [tab, setTab] = useState('active');
  return (
    <div>
      <PageHeader title="Personal training" subtitle="Sell PT packages from a member's page. Trainers log each session here." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'Active packages' },
          { value: 'sessions', label: 'Session log' },
          { value: 'commission', label: 'Trainer commission' },
          { value: 'packages', label: 'Packages' },
        ]}
      />
      {tab === 'active' && <ActivePackages />}
      {tab === 'sessions' && <Sessions />}
      {tab === 'commission' && <Commission />}
      {tab === 'packages' && <Packages />}
    </div>
  );
}
