import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import clsx from 'clsx';
import { Plus, KeyRound, Wrench, Lock, AlarmClock } from 'lucide-react';
import { post, put } from '../lib/api';
import { useApi, useAction, useBranches } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, toPaise, toRupees, daysUntil } from '../lib/format';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Select, StatCard } from '../components/ui';
import MemberPicker from '../components/MemberPicker';

const MODES = ['cash', 'upi', 'card', 'bank'];
const SECTION_TEXT = { common: 'Common', men: 'Men', women: 'Women' };

function ModeSelect({ value, onChange }) {
  return (
    <Field label="Paid by">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {MODES.map((m) => (
          <option key={m} value={m}>
            {m.toUpperCase()}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function AddLockers({ onClose }) {
  const { data: branches } = useBranches();
  const current = useAuth((s) => s.branchId);
  const [f, setF] = useState({ branchId: current || '', prefix: 'L', from: 1, to: 20, section: 'common', fee: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const branchId = f.branchId || branches?.[0]?._id;
  const save = useAction(
    () => post('/lockers/bulk', { branchId, prefix: f.prefix, from: Number(f.from), to: Number(f.to), section: f.section, monthlyFee: toPaise(f.fee) }),
    { success: (d) => `${d.added} locker(s) added${d.skipped ? `, ${d.skipped} already existed` : ''}`, invalidate: ['lockers'], onSuccess: onClose },
  );
  const count = Math.max(0, Number(f.to) - Number(f.from) + 1);
  return (
    <Modal open onClose={onClose} title="Add lockers" footer={<Button loading={save.isPending} onClick={() => save.mutate()} disabled={!count}>Add {count} locker(s)</Button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        {branches?.length > 1 && (
          <Field label="Branch" className="sm:col-span-3">
            <Select value={branchId} onChange={set('branchId')}>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Prefix" hint="Printed before the number">
          <Input value={f.prefix} onChange={set('prefix')} maxLength={6} />
        </Field>
        <Field label="From number">
          <Input type="number" min="0" value={f.from} onChange={set('from')} />
        </Field>
        <Field label="To number">
          <Input type="number" min="0" value={f.to} onChange={set('to')} />
        </Field>
        <Field label="Section">
          <Select value={f.section} onChange={set('section')}>
            {Object.entries(SECTION_TEXT).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monthly rent (₹)" className="sm:col-span-2">
          <Input type="number" min="0" value={f.fee} onChange={set('fee')} placeholder="0 = free" />
        </Field>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Creates {f.prefix}
        {f.from} to {f.prefix}
        {f.to}. Numbers that already exist are skipped.
      </p>
    </Modal>
  );
}

function AllotForm({ locker, onClose }) {
  const [member, setMember] = useState(null);
  const [f, setF] = useState({ months: 1, rent: toRupees(locker.monthlyFee), deposit: '', mode: 'cash', reference: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'months' ? { rent: toRupees(locker.monthlyFee * Number(e.target.value)) } : {}) });
  const save = useAction(
    () => post(`/lockers/${locker._id}/allot`, { memberId: member._id, months: Number(f.months), rent: toPaise(f.rent), deposit: toPaise(f.deposit), mode: f.mode, reference: f.reference || undefined }),
    { success: (d) => `Locker ${locker.number} allotted${d.receiptNo ? ` · receipt ${d.receiptNo}` : ''}`, invalidate: ['lockers', 'dashboard'], onSuccess: onClose },
  );
  return (
    <div className="space-y-3">
      <Field label="Member">
        <MemberPicker value={member} onChange={setMember} autoFocus />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Months">
          <Select value={f.months} onChange={set('months')}>
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rent (₹)">
          <Input type="number" min="0" value={f.rent} onChange={set('rent')} />
        </Field>
        <Field label="Deposit (₹)" hint="Returned on release">
          <Input type="number" min="0" value={f.deposit} onChange={set('deposit')} />
        </Field>
        <ModeSelect value={f.mode} onChange={(mode) => setF({ ...f, mode })} />
        <Field label="Reference (optional)" className="sm:col-span-2">
          <Input value={f.reference} onChange={set('reference')} placeholder="UPI / card ref" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button loading={save.isPending} disabled={!member} onClick={() => save.mutate()}>
          Allot locker · collect {inr(toPaise(f.rent) + toPaise(f.deposit))}
        </Button>
      </div>
    </div>
  );
}

function InUse({ locker, onClose }) {
  const a = locker.allotmentId;
  const [mode, setMode] = useState(null); // 'extend' | 'release'
  const [f, setF] = useState({ months: 1, rent: toRupees(locker.monthlyFee), payMode: 'cash', depositReturned: toRupees(a.deposit), note: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'months' ? { rent: toRupees(locker.monthlyFee * Number(e.target.value)) } : {}) });
  const extend = useAction(() => post(`/lockers/allotments/${a._id}/extend`, { months: Number(f.months), rent: toPaise(f.rent), mode: f.payMode }), {
    success: (d) => `Extended till ${fmtDate(d.allotment.endDate)}`,
    invalidate: ['lockers', 'dashboard'],
    onSuccess: onClose,
  });
  const release = useAction(() => post(`/lockers/allotments/${a._id}/release`, { depositReturned: toPaise(f.depositReturned), mode: f.payMode, note: f.note || undefined }), {
    success: `Locker ${locker.number} is free now`,
    invalidate: ['lockers', 'dashboard'],
    onSuccess: onClose,
  });
  const left = daysUntil(a.endDate);
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <Link to={`/admin/members/${a.memberId?._id}`} className="font-semibold text-brand-700 hover:underline">
          {a.memberId?.name} #{a.memberId?.memberCode}
        </Link>
        <p className="text-slate-600">
          {fmtDate(a.startDate)} → {fmtDate(a.endDate)} ·{' '}
          <span className={clsx(left < 0 ? 'font-semibold text-rose-600' : left <= 3 && 'text-amber-600')}>{left < 0 ? `${-left} day(s) overdue` : `${left} day(s) left`}</span>
        </p>
        <p className="text-slate-600">Deposit held: {inr(a.deposit)}</p>
      </div>
      {!mode && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode('extend')}>Extend</Button>
          <Button variant="secondary" onClick={() => setMode('release')}>
            Release locker
          </Button>
        </div>
      )}
      {mode === 'extend' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Months">
            <Select value={f.months} onChange={set('months')}>
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rent (₹)">
            <Input type="number" min="0" value={f.rent} onChange={set('rent')} />
          </Field>
          <ModeSelect value={f.payMode} onChange={(payMode) => setF({ ...f, payMode })} />
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button loading={extend.isPending} onClick={() => extend.mutate()}>
              Extend · collect {inr(toPaise(f.rent))}
            </Button>
          </div>
        </div>
      )}
      {mode === 'release' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Deposit returned (₹)" hint={`Held: ${inr(a.deposit)}`}>
            <Input type="number" min="0" value={f.depositReturned} onChange={set('depositReturned')} />
          </Field>
          <ModeSelect value={f.payMode} onChange={(payMode) => setF({ ...f, payMode })} />
          <Field label="Note (optional)" className="sm:col-span-2">
            <Input value={f.note} onChange={set('note')} placeholder="e.g. key lost, ₹100 kept" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button variant="danger" loading={release.isPending} onClick={() => release.mutate()}>
              Release locker
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LockerModal({ locker, onClose }) {
  const can = useAuth((s) => s.can);
  const toggle = useAction(() => put(`/lockers/${locker._id}`, { maintenance: locker.status !== 'maintenance' }), {
    success: locker.status === 'maintenance' ? 'Locker is available again' : 'Marked for maintenance',
    invalidate: ['lockers'],
    onSuccess: onClose,
  });
  return (
    <Modal open onClose={onClose} title={`Locker ${locker.number} · ${SECTION_TEXT[locker.section]}`} size="lg">
      {locker.status === 'occupied' && <InUse locker={locker} onClose={onClose} />}
      {locker.status === 'available' && (can('lockers.write') ? <AllotForm locker={locker} onClose={onClose} /> : <p className="text-sm text-slate-500">Free.</p>)}
      {locker.status === 'maintenance' && <p className="text-sm text-slate-600">Under maintenance{locker.notes ? `: ${locker.notes}` : ''}. It cannot be allotted.</p>}
      {can('lockers.manage') && locker.status !== 'occupied' && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <Button size="sm" variant="ghost" loading={toggle.isPending} onClick={() => toggle.mutate()}>
            <Wrench className="size-4" /> {locker.status === 'maintenance' ? 'Mark as working' : 'Mark for maintenance'}
          </Button>
        </div>
      )}
    </Modal>
  );
}

export default function Lockers() {
  const can = useAuth((s) => s.can);
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || '');
  const [section, setSection] = useState('');
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const { data, isLoading } = useApi(['lockers', status, section], '/lockers', { status, section });
  if (isLoading || !data) return <PageLoader />;
  const c = data.counts;
  const total = c.available + c.occupied + c.maintenance;
  const filter = (s) => setStatus(status === s ? '' : s);
  return (
    <div>
      <PageHeader
        title="Lockers"
        subtitle="Tap a locker to allot, extend or release it"
        actions={can('lockers.manage') && <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add lockers</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Free" value={c.available} icon={KeyRound} tone="green" onClick={() => filter('available')} />
        <StatCard label="In use" value={c.occupied} icon={Lock} tone="brand" onClick={() => filter('occupied')} />
        <StatCard label="Overdue" value={c.overdue} hint="Paid period over" icon={AlarmClock} tone="red" onClick={() => filter('overdue')} />
        <StatCard label="Maintenance" value={c.maintenance} icon={Wrench} tone="amber" onClick={() => filter('maintenance')} />
      </div>
      <Card className="mt-4" padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Status">
            <option value="">All lockers</option>
            <option value="available">Free</option>
            <option value="occupied">In use</option>
            <option value="overdue">Overdue</option>
            <option value="maintenance">Maintenance</option>
          </Select>
          <Select value={section} onChange={(e) => setSection(e.target.value)} className="w-auto" aria-label="Section">
            <option value="">All sections</option>
            {Object.entries(SECTION_TEXT).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
          <span className="ml-auto flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><i className="size-3 rounded bg-emerald-200" /> Free</span>
            <span className="flex items-center gap-1"><i className="size-3 rounded bg-brand-200" /> In use</span>
            <span className="flex items-center gap-1"><i className="size-3 rounded bg-rose-200" /> Overdue</span>
            <span className="flex items-center gap-1"><i className="size-3 rounded bg-amber-200" /> Maintenance</span>
          </span>
        </div>
        {data.items.length ? (
          <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-5 lg:grid-cols-8">
            {data.items.map((l) => (
              <button
                key={l._id}
                onClick={() => setOpen(l)}
                className={clsx(
                  'flex min-h-20 flex-col items-start rounded-lg p-2 text-left ring-1 transition hover:shadow-sm',
                  l.overdue ? 'bg-rose-50 ring-rose-200' : { available: 'bg-emerald-50 ring-emerald-200', occupied: 'bg-brand-50 ring-brand-200', maintenance: 'bg-amber-50 ring-amber-200' }[l.status],
                )}
              >
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
                  <KeyRound className="size-3.5 text-slate-400" />
                  {l.number}
                </span>
                {l.allotmentId ? (
                  <>
                    <span className="w-full truncate text-xs text-slate-700">{l.allotmentId.memberId?.name}</span>
                    <span className={clsx('text-[11px]', l.overdue ? 'font-semibold text-rose-600' : 'text-slate-500')}>{l.overdue ? 'Overdue' : `till ${fmtDate(l.allotmentId.endDate)}`}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">{l.status === 'maintenance' ? 'Maintenance' : `Free${l.monthlyFee ? ` · ${inr(l.monthlyFee)}/mo` : ''}`}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title={total ? 'No locker matches this filter' : 'No lockers yet'}>
            {!total && can('lockers.manage') && (
              <Button className="mt-3" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Add lockers
              </Button>
            )}
          </EmptyState>
        )}
      </Card>
      {open && <LockerModal locker={open} onClose={() => setOpen(null)} />}
      {adding && <AddLockers onClose={() => setAdding(false)} />}
    </div>
  );
}
