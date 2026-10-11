import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import { get, post, put } from '../../lib/api';
import { useAction, useBranches } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDateTime, inr, toPaise, toRupees } from '../../lib/format';
import { MyPayslips } from '../Payroll';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, PageLoader, Select, Table, Tabs, Textarea, Toggle } from '../../components/ui';

function GymSettings() {
  const can = useAuth((s) => s.can);
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => get('/settings') });
  const [f, setF] = useState(null);
  useEffect(() => {
    if (data) setF({ ...data, settings: { ...data.settings, reminderDays: (data.settings?.reminderDays || []).join(', ') } });
  }, [data]);
  const save = useAction((b) => put('/settings', b), { success: 'Settings saved', invalidate: ['settings'] });
  if (!f) return <PageLoader />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setS = (k, v) => setF({ ...f, settings: { ...f.settings, [k]: v } });
  const editable = can('settings.write');
  const dirty = JSON.stringify(f) !== JSON.stringify({ ...data, settings: { ...data.settings, reminderDays: (data.settings?.reminderDays || []).join(', ') } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Gym details (printed on invoices)">
        <div className="grid gap-3">
          <Field label="Gym name">
            <Input value={f.name} onChange={set('name')} disabled={!editable} />
          </Field>
          <Field label="GSTIN">
            <Input value={f.gstin || ''} onChange={set('gstin')} disabled={!editable} className="uppercase" />
          </Field>
          <Field label="Address">
            <Textarea value={f.address || ''} onChange={set('address')} disabled={!editable} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={f.phone || ''} onChange={set('phone')} disabled={!editable} />
            </Field>
            <Field label="Email">
              <Input value={f.email || ''} onChange={set('email')} disabled={!editable} />
            </Field>
            <Field label="Default GST %">
              <Input type="number" value={f.taxPercent} onChange={set('taxPercent')} disabled={!editable} />
            </Field>
            <Field label="Invoice prefix">
              <Input value={f.invoicePrefix} onChange={set('invoicePrefix')} disabled={!editable} />
            </Field>
          </div>
        </div>
      </Card>
      <Card title="Entry rules & reminders">
        <div className="space-y-4">
          <Field label="Grace days after membership ends" hint="0 = no entry from the day after the end date (recommended)">
            <Select value={f.settings.graceDays} onChange={(e) => setS('graceDays', Number(e.target.value))} disabled={!editable}>
              {[0, 1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'No grace — block on expiry' : `${d} day(s)`}
                </option>
              ))}
            </Select>
          </Field>
          <Toggle checked={f.settings.blockOnDues} onChange={(v) => setS('blockOnDues', v)} disabled={!editable} label="Also block entry when dues are pending" />
          <Field label="Renewal reminder days" hint="Days before expiry to email the member, e.g. 7, 3, 1">
            <Input value={f.settings.reminderDays} onChange={(e) => setS('reminderDays', e.target.value)} disabled={!editable} />
          </Field>
          <Toggle checked={f.settings.sendEmails} onChange={(v) => setS('sendEmails', v)} disabled={!editable} label="Send emails (invoices, reminders, birthdays)" />
          <Toggle checked={!!f.settings.channels?.sms} onChange={(v) => setS('channels', { ...f.settings.channels, sms: v })} disabled={!editable} label="Send SMS (reminders, receipts, login codes)" />
          <Toggle checked={!!f.settings.channels?.whatsapp} onChange={(v) => setS('channels', { ...f.settings.channels, whatsapp: v })} disabled={!editable} label="Send WhatsApp messages" />
          <Toggle checked={f.settings.memberOtpLogin !== false} onChange={(v) => setS('memberOtpLogin', v)} disabled={!editable} label="Members can log in with a one-time code" />
          <p className="text-xs text-slate-500">Changing entry rules re-checks every member and updates the biometric devices immediately.</p>
        </div>
      </Card>
      {editable && (
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-sm ring-1 ring-slate-200 backdrop-blur lg:col-span-2">
          <span className="text-sm text-slate-500">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
          <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              name: f.name,
              gstin: f.gstin || '',
              address: f.address || '',
              phone: f.phone || '',
              email: f.email || '',
              taxPercent: Number(f.taxPercent),
              invoicePrefix: f.invoicePrefix,
              settings: {
                graceDays: Number(f.settings.graceDays),
                blockOnDues: f.settings.blockOnDues,
                sendEmails: f.settings.sendEmails,
                channels: { sms: !!f.settings.channels?.sms, whatsapp: !!f.settings.channels?.whatsapp },
                memberOtpLogin: f.settings.memberOtpLogin !== false,
                reminderDays: String(f.settings.reminderDays).split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)),
              },
            })
          }
        >
          Save settings
        </Button>
        </div>
      )}
    </div>
  );
}

function Branches() {
  const { data } = useBranches();
  const can = useAuth((s) => s.can);
  const [edit, setEdit] = useState(null);
  return (
    <Card
      title="Branches"
      padded={false}
      actions={
        can('branches.write') && (
          <Button size="sm" onClick={() => setEdit({ name: '', code: '', address: '', phone: '', openingTime: '05:00', closingTime: '23:00' })}>
            <Plus className="size-4" /> Add branch
          </Button>
        )
      }
    >
      <Table
        rows={data}
        columns={[
          { key: 'name', label: 'Name', render: (b) => <b>{b.name}</b> },
          { key: 'code', label: 'Code' },
          { key: 'hours', label: 'Hours', render: (b) => `${b.openingTime} – ${b.closingTime}` },
          { key: 'phone', label: 'Phone', render: (b) => b.phone || '—' },
          { key: 'a', label: '', render: (b) => can('branches.write') && <Button size="sm" variant="ghost" aria-label="Edit branch" title="Edit" onClick={() => setEdit(b)}><Pencil className="size-4" /></Button> },
        ]}
      />
      {edit && <BranchForm branch={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function BranchForm({ branch, onClose }) {
  const [f, setF] = useState(branch);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (branch._id ? put(`/branches/${branch._id}`, b) : post('/branches', b)), { success: 'Branch saved', invalidate: ['branches'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={branch._id ? 'Edit branch' : 'New branch'}
      footer={
        <Button loading={save.isPending} onClick={() => save.mutate({ name: f.name, code: f.code, address: f.address, phone: f.phone, openingTime: f.openingTime, closingTime: f.closingTime })}>
          Save
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Short code">
          <Input value={f.code} onChange={set('code')} className="uppercase" />
        </Field>
        <Field label="Opens">
          <Input type="time" value={f.openingTime} onChange={set('openingTime')} />
        </Field>
        <Field label="Closes">
          <Input type="time" value={f.closingTime} onChange={set('closingTime')} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={f.address || ''} onChange={set('address')} />
        </Field>
      </div>
    </Modal>
  );
}

function Staff() {
  const { can, user } = useAuth();
  const { data } = useQuery({ queryKey: ['users'], queryFn: () => get('/users') });
  const { data: branches } = useBranches();
  const [edit, setEdit] = useState(null);
  const bName = (id) => branches?.find((b) => b._id === id)?.name;
  return (
    <Card
      title="Staff accounts"
      padded={false}
      actions={
        can('users.write') && (
          <Button size="sm" onClick={() => setEdit({ name: '', email: '', phone: '', role: 'receptionist', branchIds: branches?.[0] ? [branches[0]._id] : [], password: '' })}>
            <Plus className="size-4" /> Add staff
          </Button>
        )
      }
    >
      <Table
        rows={data}
        columns={[
          { key: 'name', label: 'Name', render: (u) => <b>{u.name}</b> },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: (u) => <span className="capitalize">{u.role}</span> },
          { key: 'pin', label: 'Device ID', render: (u) => (u.devicePin ? <code>{u.devicePin}</code> : '—') },
          { key: 'sal', label: 'Salary', className: 'hidden lg:table-cell', render: (u) => (u.salary?.amount ? `${inr(u.salary.amount)}${u.salary.type === 'per-day' ? '/day' : '/mo'}` : '—') },
          { key: 'b', label: 'Branches', render: (u) => (u.role === 'owner' ? 'All' : u.branchIds.map(bName).join(', ')) },
          { key: 'status', label: 'Status', render: (u) => <Badge status={u.isActive ? 'allow' : 'cancelled'}>{u.isActive ? 'Active' : 'Disabled'}</Badge> },
          { key: 'last', label: 'Last login', className: 'hidden md:table-cell', render: (u) => fmtDateTime(u.lastLoginAt) },
          { key: 'a', label: '', render: (u) => can('users.write') && u._id !== user._id && <Button size="sm" variant="ghost" aria-label="Edit staff" title="Edit" onClick={() => setEdit({ ...u, password: '' })}><Pencil className="size-4" /></Button> },
        ]}
      />
      {edit && <StaffForm staff={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function StaffForm({ staff, onClose }) {
  const { data: branches } = useBranches();
  const isOwner = useAuth((s) => s.user.role === 'owner');
  const canPayroll = useAuth((s) => s.can('payroll.manage'));
  const [f, setF] = useState({ ...staff, salaryType: staff.salary?.type || 'monthly', salaryAmount: staff.salary?.amount ? toRupees(staff.salary.amount) : '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (staff._id ? put(`/users/${staff._id}`, b) : post('/users', b)), { success: 'Staff saved', invalidate: ['users'], onSuccess: onClose });
  const toggleBranch = (id) => setF({ ...f, branchIds: f.branchIds.includes(id) ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id] });
  const submit = () => {
    const body = { name: f.name, email: f.email, phone: f.phone || undefined, role: f.role, branchIds: f.branchIds };
    if (f.role === 'trainer') body.ptCommissionPercent = Number(f.ptCommissionPercent || 0);
    if (canPayroll && f.salaryAmount !== undefined) body.salary = { type: f.salaryType || 'monthly', amount: toPaise(f.salaryAmount) };
    if (f.password) body.password = f.password;
    if (staff._id) body.isActive = f.isActive;
    save.mutate(body);
  };
  return (
    <Modal open onClose={onClose} title={staff._id ? 'Edit staff' : 'Add staff'} footer={<Button loading={save.isPending} onClick={submit}>Save</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Email (login)">
          <Input value={f.email} onChange={set('email')} type="email" />
        </Field>
        <Field label="Phone">
          <Input value={f.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={set('role')}>
            <option value="receptionist">Receptionist</option>
            <option value="trainer">Trainer</option>
            {isOwner && <option value="manager">Branch manager</option>}
            {isOwner && <option value="owner">Owner</option>}
          </Select>
        </Field>
        {canPayroll && (
          <>
            <Field label="Salary type">
              <Select value={f.salaryType} onChange={set('salaryType')}>
                <option value="monthly">Monthly</option>
                <option value="per-day">Per day</option>
              </Select>
            </Field>
            <Field label={f.salaryType === 'per-day' ? 'Per-day rate (₹)' : 'Monthly salary (₹)'} hint="Empty or 0 = not on payroll">
              <Input type="number" min="0" value={f.salaryAmount} onChange={set('salaryAmount')} />
            </Field>
          </>
        )}
        {f.role === 'trainer' && (
          <Field label="PT commission %" hint="Trainer's share of PT package price per session">
            <Input type="number" min="0" max="100" value={f.ptCommissionPercent ?? 0} onChange={set('ptCommissionPercent')} />
          </Field>
        )}
        <Field label={staff._id ? 'New password (optional)' : 'Password'} hint="At least 8 characters" className="sm:col-span-2">
          <Input value={f.password} onChange={set('password')} type="password" autoComplete="new-password" />
        </Field>
        {f.role !== 'owner' && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-medium text-slate-700">Branches</p>
            <div className="flex flex-wrap gap-3">
              {branches?.map((b) => (
                <label key={b._id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={f.branchIds.includes(b._id)} onChange={() => toggleBranch(b._id)} className="rounded text-brand-600" />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
        )}
        {staff._id && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Account active" />}
      </div>
    </Modal>
  );
}

function ChangePassword() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const logout = useAuth((s) => s.logout);
  const save = useAction((b) => post('/auth/change-password', b), { success: 'Password changed. Please sign in again.', onSuccess: () => logout() });
  return (
    <Card title="My password" className="max-w-md">
      <div className="space-y-3">
        <Field label="Current password">
          <Input type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <Input type="password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
        </Field>
        <Button loading={save.isPending} onClick={() => save.mutate(f)}>
          Change password
        </Button>
      </div>
    </Card>
  );
}

function Sessions() {
  const { data, refetch } = useQuery({ queryKey: ['sessions'], queryFn: () => get('/auth/sessions') });
  const revoke = useAction((id) => post(`/auth/sessions/${id}/revoke`), { success: 'Logged out on that device', onSuccess: () => refetch() });
  const others = useAction(() => post('/auth/sessions/revoke-others'), { success: 'Logged out everywhere else', onSuccess: () => refetch() });
  return (
    <Card
      title="Where you're logged in"
      padded={false}
      className="max-w-2xl"
      actions={
        data?.length > 1 && (
          <Button size="sm" variant="secondary" loading={others.isPending} onClick={() => others.mutate()}>
            Log out other devices
          </Button>
        )
      }
    >
      <Table
        rows={data}
        columns={[
          { key: 'ua', label: 'Device', className: 'max-w-xs truncate text-xs', render: (s) => s.userAgent || 'Unknown' },
          { key: 'ip', label: 'IP', render: (s) => s.ip || '—' },
          { key: 'at', label: 'Signed in', render: (s) => fmtDateTime(s.createdAt) },
          { key: 'x', label: '', render: (s) => (s.current ? <Badge status="allow">This device</Badge> : <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => revoke.mutate(s._id)}>Log out</Button>) },
        ]}
      />
    </Card>
  );
}

function AuditLog() {
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['audit', page], queryFn: () => get('/audit', { page }) });
  return (
    <Card title="Audit log" padded={false}>
      <Table
        rows={data?.items}
        columns={[
          { key: 'at', label: 'When', render: (a) => fmtDateTime(a.createdAt) },
          { key: 'who', label: 'Who', render: (a) => a.actorName || 'system' },
          { key: 'action', label: 'Action', render: (a) => <code className="text-xs">{a.action}</code> },
          { key: 'd', label: 'Details', className: 'max-w-md truncate text-xs text-slate-500', render: (a) => (a.details ? JSON.stringify(a.details) : '') },
        ]}
      />
      {data && data.pages > 1 && (
        <div className="flex justify-end gap-2 p-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Settings() {
  const can = useAuth((s) => s.can);
  const full = can('users.read');
  const [tab, setTab] = useState(full ? 'gym' : 'me');
  if (!full)
    return (
      <div>
        <PageHeader title="My account" subtitle="Your password, payslips and signed-in devices" />
        <div className="space-y-4">
          <ChangePassword />
          <MyPayslips />
          <Sessions />
        </div>
      </div>
    );
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'gym', label: 'Gym & entry rules' },
          { value: 'branches', label: 'Branches' },
          ...(can('users.read') ? [{ value: 'staff', label: 'Staff' }] : []),
          ...(can('audit.read') ? [{ value: 'audit', label: 'Audit log' }] : []),
          { value: 'me', label: 'My account' },
        ]}
      />
      {tab === 'gym' && <GymSettings />}
      {tab === 'branches' && <Branches />}
      {tab === 'staff' && <Staff />}
      {tab === 'audit' && <AuditLog />}
      {tab === 'me' && (
        <div className="space-y-4">
          <ChangePassword />
          <MyPayslips />
          <Sessions />
        </div>
      )}
    </div>
  );
}
