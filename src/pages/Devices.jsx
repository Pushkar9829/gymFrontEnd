import { useState } from 'react';
import { Plus, RefreshCw, Fingerprint, Power, Pencil, ListChecks, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { post, put } from '../lib/api';
import { useApi, useAction, useBranches, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { fmtDateTime, fromNow } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Pagination, Select, Table, Toggle } from '../components/ui';

const API_HOST = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).host : window.location.host;

function DeviceForm({ device, onClose }) {
  const { data: branches } = useBranches();
  const defaultBranch = useDefaultBranchId();
  const [f, setF] = useState(
    device
      ? { ...device, branchId: device.branchId?._id || device.branchId, allowedIps: (device.allowedIps || []).join(', ') }
      : { name: '', serialNo: '', branchId: defaultBranch, location: 'entry', dialect: 'security', doorId: 1, allowedGroup: 1, blockedGroup: 99, allowedIps: '', isActive: true },
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (device ? put(`/devices/${device._id}`, b) : post('/devices', b)), {
    success: device ? 'Device updated' : 'Device added. All members of the branch are being sent to it.',
    invalidate: ['devices', 'dashboard'],
    onSuccess: onClose,
  });
  const submit = () =>
    save.mutate({
      name: f.name,
      serialNo: f.serialNo.trim(),
      branchId: f.branchId,
      location: f.location,
      dialect: f.dialect,
      doorId: Number(f.doorId),
      allowedGroup: Number(f.allowedGroup),
      blockedGroup: Number(f.blockedGroup),
      allowedIps: f.allowedIps ? f.allowedIps.split(',').map((s) => s.trim()).filter(Boolean) : [],
      isActive: f.isActive,
    });
  return (
    <Modal
      open
      onClose={onClose}
      title={device ? 'Edit device' : 'Add biometric device'}
      size="lg"
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
        <Field label="Name" required>
          <Input value={f.name} onChange={set('name')} placeholder="Main entrance" />
        </Field>
        <Field label="Serial number (SN)" required hint="Shown in the device menu: System info → Device info">
          <Input value={f.serialNo} onChange={set('serialNo')} disabled={!!device} className="font-mono" />
        </Field>
        <Field label="Branch">
          <Select value={f.branchId} onChange={set('branchId')}>
            {branches?.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Position">
          <Select value={f.location} onChange={set('location')}>
            <option value="entry">Entry door</option>
            <option value="exit">Exit door (marks check-out)</option>
            <option value="both">Entry + exit</option>
          </Select>
        </Field>
        <Field label="Firmware type" hint="Access-control models (SpeedFace, ProFace, inBio) = Security PUSH">
          <Select value={f.dialect} onChange={set('dialect')}>
            <option value="security">Access control (Security PUSH) — recommended</option>
            <option value="attendance">Attendance terminal (iclock push)</option>
          </Select>
        </Field>
        {f.dialect === 'security' ? (
          <Field label="Door number">
            <Input type="number" min="1" value={f.doorId} onChange={set('doorId')} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Allowed group">
              <Input type="number" min="1" value={f.allowedGroup} onChange={set('allowedGroup')} />
            </Field>
            <Field label="Blocked group" hint="Group with no access time">
              <Input type="number" min="1" value={f.blockedGroup} onChange={set('blockedGroup')} />
            </Field>
          </div>
        )}
        <Field label="Allowed IPs (optional)" hint="Gym's static public IP. Empty = any." className="sm:col-span-2">
          <Input value={f.allowedIps} onChange={set('allowedIps')} placeholder="49.36.10.20" />
        </Field>
        {device && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />}
      </div>
    </Modal>
  );
}

function Commands({ device, onClose }) {
  const [page, setPage] = useState(1);
  const { data } = useApi(['devices', device._id, 'commands'], `/devices/${device._id}/commands`, { page }, { refetchInterval: 10000 });
  return (
    <Modal open onClose={onClose} title={`Command queue · ${device.name}`} size="xl">
      <Table
        rows={data?.items}
        empty={<EmptyState title="No commands" />}
        columns={[
          { key: 'cmdId', label: '#' },
          { key: 'm', label: 'Member', render: (c) => (c.memberId ? `${c.memberId.name} (#${c.memberId.memberCode})` : c.kind) },
          { key: 'cmd', label: 'Command', className: 'max-w-md truncate font-mono text-xs', render: (c) => c.command.replace(/\t/g, ' ') },
          { key: 'status', label: 'Status', render: (c) => <Badge status={{ done: 'allow', failed: 'deny', superseded: 'cancelled' }[c.status] || 'upcoming'}>{c.status}</Badge> },
          { key: 'at', label: 'Updated', render: (c) => fmtDateTime(c.doneAt || c.sentAt || c.createdAt) },
        ]}
      />
      <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
    </Modal>
  );
}

export default function Devices() {
  const { data, isLoading } = useApi('devices', '/devices', {}, { refetchInterval: 15000 });
  const [editing, setEditing] = useState(null);
  const [queue, setQueue] = useState(null);
  const can = useAuth((s) => s.can);
  const sync = useAction((id) => post(`/devices/${id}/sync`), { success: (d) => `Full re-sync queued for ${d.membersQueued} member(s)`, invalidate: ['devices'] });
  const reboot = useAction((id) => post(`/devices/${id}/reboot`), { success: 'Reboot command queued' });
  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Biometric devices"
        subtitle="Members are enabled on the device only while their membership is valid. Expired, frozen, cancelled or blocked members cannot open the door."
        actions={
          can('devices.write') && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Add device
            </Button>
          )
        }
      />

      <Card className="mb-4" title="Device setup (once per device)">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>On the device: Menu → Communication → Cloud Server Setting (ADMS).</li>
          <li>
            Server address:{' '}
            <button
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800"
              onClick={() => navigator.clipboard?.writeText(API_HOST).then(() => toast.success('Copied'))}
            >
              {API_HOST} <Copy className="size-3" />
            </button>{' '}
            · Port 443 · HTTPS on · Proxy off.
          </li>
          <li>Add the device here with its serial number. It turns <b>Online</b> within a minute.</li>
          <li>Open a member → Biometric tab → record consent, then enrol the finger/face on the device using the member code as the user ID.</li>
        </ol>
      </Card>

      {!data?.length ? (
        <Card>
          <EmptyState icon={Fingerprint} title="No devices yet">Add your first biometric device to start automatic entry control.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((d) => (
            <Card key={d._id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <Fingerprint className="size-5 text-brand-700" /> {d.name}
                  </p>
                  <p className="font-mono text-xs text-slate-500">SN {d.serialNo}</p>
                  <p className="text-sm text-slate-500">
                    {d.branchId?.name} · {d.location} · {d.dialect === 'security' ? 'Access control' : 'Attendance'}
                  </p>
                </div>
                <Badge status={!d.isActive ? 'cancelled' : d.online ? 'allow' : 'deny'}>{!d.isActive ? 'Inactive' : d.online ? 'Online' : 'Offline'}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-xs text-slate-500">Last seen</dt>
                  <dd className="font-medium">{fromNow(d.lastSeenAt)}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-xs text-slate-500">Pending</dt>
                  <dd className="font-medium">{d.pendingCommands}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-xs text-slate-500">Failed</dt>
                  <dd className={d.failedCommands ? 'font-medium text-rose-600' : 'font-medium'}>{d.failedCommands}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setQueue(d)}>
                  <ListChecks className="size-3.5" /> Queue
                </Button>
                {can('devices.write') && (
                  <>
                    <Button size="sm" variant="secondary" loading={sync.isPending && sync.variables === d._id} onClick={() => sync.mutate(d._id)}>
                      <RefreshCw className="size-3.5" /> Full re-sync
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(d)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.confirm('Reboot this device?') && reboot.mutate(d._id)}>
                      <Power className="size-3.5" /> Reboot
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <DeviceForm device={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {queue && <Commands device={queue} onClose={() => setQueue(null)} />}
    </div>
  );
}
