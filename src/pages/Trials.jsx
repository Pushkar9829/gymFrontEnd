import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Ticket, UserCheck, Ban } from 'lucide-react';
import { get, post } from '../lib/api';
import { useApi, useAction, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, toPaise, ymd, PAYMENT_MODES } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Toggle } from '../components/ui';

export const TRIAL_STATUS_TEXT = { active: 'Active', upcoming: 'Upcoming', ended: 'Ended', converted: 'Joined' };
const TRIAL_BADGE = { active: 'active', upcoming: 'upcoming', ended: 'ended', converted: 'converted' };
export const TrialBadge = ({ status }) => <Badge status={TRIAL_BADGE[status] || 'none'}>{TRIAL_STATUS_TEXT[status] || 'Trial'}</Badge>;

const validPhone = (p) => /^\+?\d{10,13}$/.test(String(p || '').trim());

/** Issue a trial / guest pass to a lead (prefilled) or a walk-in. */
export function IssueTrialModal({ lead, onClose, onIssued }) {
  const can = useAuth((s) => s.can);
  const branchId = useDefaultBranchId();
  const { data: gym } = useQuery({ queryKey: ['settings'], queryFn: () => get('/settings') });
  const cfg = { enabled: true, defaultDays: 1, maxDays: 3, repeatDays: 90, ...(gym?.settings?.trial || {}) };
  const [f, setF] = useState({ name: '', phone: '', email: '', days: '', startDate: ymd(), fee: '', mode: 'cash', reference: '', override: false, overrideReason: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const phone = lead ? lead.phone : f.phone.trim();
  const { data: check } = useQuery({ queryKey: ['trial-check', phone], queryFn: () => get('/trials/check', { phone }), enabled: validPhone(phone) });
  const days = Number(f.days || cfg.defaultDays);
  const save = useAction((b) => post('/trials', b), {
    success: (d) => `Trial pass issued till ${fmtDate(d.member.trial.to)}`,
    invalidate: ['trials', 'leads', 'dashboard', 'payments'],
    onSuccess: (d) => {
      onClose();
      onIssued?.(d);
    },
  });
  const blocked = Boolean(check?.nextAllowedOn);
  const canOverride = can('trials.override');
  const submit = () =>
    save.mutate({
      ...(lead ? { leadId: lead._id } : { branchId, name: f.name, phone: f.phone.trim(), email: f.email }),
      days,
      startDate: f.startDate || undefined,
      fee: toPaise(f.fee),
      mode: f.mode,
      reference: f.reference || undefined,
      override: blocked && f.override,
      overrideReason: blocked && f.override ? f.overrideReason || undefined : undefined,
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={lead ? `Trial pass · ${lead.name}` : 'Issue trial pass'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!cfg.enabled || Boolean(check?.member) || (blocked && !(canOverride && f.override))} onClick={submit}>
            Issue pass
          </Button>
        </>
      }
    >
      {!cfg.enabled && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Trial passes are switched off in Settings.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {lead ? (
          <p className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2">
            <b>{lead.name}</b> · {lead.phone}
            {lead.email ? ` · ${lead.email}` : ''}
          </p>
        ) : (
          <>
            <Field label="Name" required>
              <Input value={f.name} onChange={set('name')} autoFocus />
            </Field>
            <Field label="Phone" required>
              <Input value={f.phone} onChange={set('phone')} inputMode="tel" />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input value={f.email} onChange={set('email')} type="email" />
            </Field>
          </>
        )}
        <Field label="Days">
          <Select value={days} onChange={set('days')}>
            {Array.from({ length: cfg.maxDays }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d} day{d > 1 ? 's' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starts on">
          <Input type="date" min={ymd()} value={f.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="Fee (₹)" hint="Leave empty for a free trial">
          <Input type="number" min="0" step="1" value={f.fee} onChange={set('fee')} placeholder="0" />
        </Field>
        {Number(f.fee) > 0 && (
          <Field label="Paid by">
            <Select value={f.mode} onChange={set('mode')}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      {check?.member && (
        <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {check.member.name} (#{check.member.memberCode}) is already a member with this phone number.
        </p>
      )}
      {blocked && (
        <div className="mt-3 space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <p>
            A trial was given to this number on {fmtDate(check.lastTrialAt)}. Next trial allowed from {fmtDate(check.nextAllowedOn)}.
          </p>
          {canOverride ? (
            <>
              <Toggle checked={f.override} onChange={(v) => setF({ ...f, override: v })} label="Give another trial anyway" />
              {f.override && <Input value={f.overrideReason} onChange={set('overrideReason')} placeholder="Reason (optional)" />}
            </>
          ) : (
            <p>Only the owner or a manager can give another trial so soon.</p>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        The visitor can enter on {days === 1 ? 'that day' : `these ${days} days`} at the desk (search, QR, code) and on the biometric device. Entry stops automatically after the last day.
      </p>
    </Modal>
  );
}

function Confirm({ title, children, confirmLabel, danger, loading, onConfirm, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{children}</p>
    </Modal>
  );
}

/** Convert / end buttons with their confirmations. Used on the list and on the member page. */
export function TrialActions({ trial, size = 'sm', onConverted }) {
  const can = useAuth((s) => s.can);
  const navigate = useNavigate();
  const [ask, setAsk] = useState(null);
  const status = trial.status || (trial.isTrial ? 'active' : 'converted');
  const convert = useAction(() => post(`/trials/${trial._id}/convert`), {
    success: `${trial.name} is a member now. Add a membership.`,
    invalidate: ['trials', 'members', 'member', 'leads', 'dashboard'],
    onSuccess: () => {
      setAsk(null);
      if (onConverted) onConverted();
      else navigate(`/admin/members/${trial._id}?add=membership`);
    },
  });
  const end = useAction(() => post(`/trials/${trial._id}/end`), { success: 'Trial ended. Entry stopped.', invalidate: ['trials', 'member', 'dashboard'], onSuccess: () => setAsk(null) });
  if (!can('trials.write') || status === 'converted') return null;
  return (
    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {can('members.write') && (
        <Button size={size} variant="success" onClick={() => setAsk('convert')}>
          <UserCheck className="size-3.5" /> Convert to member
        </Button>
      )}
      {['active', 'upcoming'].includes(status) && (
        <Button size={size} variant="ghost" className="text-rose-600" onClick={() => setAsk('end')}>
          <Ban className="size-3.5" /> End trial
        </Button>
      )}
      {ask === 'convert' && (
        <Confirm title="Convert to member?" confirmLabel="Convert" loading={convert.isPending} onConfirm={() => convert.mutate()} onClose={() => setAsk(null)}>
          {trial.name} keeps the same member code and visit history. The trial is closed; add a membership next to give entry.
        </Confirm>
      )}
      {ask === 'end' && (
        <Confirm title="End trial now?" confirmLabel="End trial" danger loading={end.isPending} onConfirm={() => end.mutate()} onClose={() => setAsk(null)}>
          {trial.name} will not be able to enter from now on, at the desk or on the device.
        </Confirm>
      )}
    </div>
  );
}

export default function Trials() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('status') || 'active';
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [issuing, setIssuing] = useState(false);
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const { data, isLoading } = useApi('trials', '/trials', { status: tab, page, search });
  const c = data?.counts || {};

  return (
    <div>
      <PageHeader
        title="Trial passes"
        subtitle="Free or paid 1-3 day passes for leads and walk-ins. Not counted as members."
        actions={
          can('trials.write') && (
            <Button onClick={() => setIssuing(true)}>
              <Plus className="size-4" /> Issue trial
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => (setPage(1), setParams(v === 'active' ? {} : { status: v }))}
        tabs={[
          { value: 'active', label: 'Active', count: c.active },
          { value: 'upcoming', label: 'Upcoming', count: c.upcoming },
          { value: 'ended', label: 'Ended', count: c.ended },
          { value: 'converted', label: 'Joined', count: c.converted },
          { value: 'all', label: 'All' },
        ]}
      />
      <Card padded={false}>
        <form
          className="relative border-b border-slate-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <Search className="pointer-events-none absolute top-5.5 left-6 size-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or code" className="pl-9" />
        </form>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              rows={data?.items}
              onRowClick={(t) => navigate(`/admin/members/${t._id}`)}
              empty={
                <EmptyState title={tab === 'active' ? 'No one on a trial today' : 'No trial passes here'} icon={Ticket}>
                  {can('trials.write') && (
                    <Button size="sm" className="mt-3" onClick={() => setIssuing(true)}>
                      <Plus className="size-4" /> Issue trial
                    </Button>
                  )}
                </EmptyState>
              }
              columns={[
                {
                  key: 'name',
                  label: 'Visitor',
                  render: (t) => (
                    <div>
                      <p className="font-medium text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        #{t.memberCode} · {t.phone}
                      </p>
                    </div>
                  ),
                },
                { key: 'pass', label: 'Pass', render: (t) => (t.trial?.from ? `${fmtDate(t.trial.from)} – ${fmtDate(t.trial.to)}` : '—') },
                { key: 'visits', label: 'Visits', render: (t) => t.visits },
                { key: 'fee', label: 'Fee', render: (t) => (t.trial?.fee ? inr(t.trial.fee) : 'Free') },
                { key: 'status', label: 'Status', render: (t) => <TrialBadge status={t.status} /> },
                { key: 'by', label: 'Given by', className: 'hidden md:table-cell', render: (t) => t.trial?.issuedBy?.name || '—' },
                { key: 'a', label: '', render: (t) => <TrialActions trial={t} /> },
              ]}
            />
            <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
          </>
        )}
      </Card>
      {issuing && <IssueTrialModal onClose={() => setIssuing(false)} />}
    </div>
  );
}
