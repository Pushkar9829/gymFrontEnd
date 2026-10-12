import { useState } from 'react';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { Download, Lock, LockOpen, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { post, openFile } from '../lib/api';
import { useAction, useApi, useBranches, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, fmtDateTime, toPaise, toRupees, ymd } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Pagination, Select, StatCard, Table, Tabs, Textarea, Toggle } from '../components/ui';

const MODE_TEXT = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank', online: 'Online' };
const NOTES = [500, 200, 100, 50, 20, 10];

function Difference({ value }) {
  if (!value) return <Badge status="active">Matched</Badge>;
  return value < 0 ? <Badge status="deny">Short {inr(-value, { decimals: true })}</Badge> : <Badge status="contacted">Excess {inr(value, { decimals: true })}</Badge>;
}

function ReopenModal({ closing, onClose }) {
  const [reason, setReason] = useState('');
  const reopen = useAction(() => post(`/cash/${closing._id}/reopen`, { reason: reason.trim() }), {
    success: 'Day reopened. Count again and close it.',
    invalidate: ['cash', 'dashboard'],
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Reopen ${fmtDate(closing.day)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={reopen.isPending} onClick={() => reopen.mutate()}>
            Reopen day
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">The closing stays in the history. Staff can count and close the day again.</p>
      <Field label="Reason">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

/** Count form: opening float, counted cash (total or by notes), note, statement totals. */
function CloseForm({ data, branchId }) {
  const reopened = data.closing?.status === 'reopened' ? data.closing : null;
  const [opening, setOpening] = useState(String(toRupees(reopened ? reopened.openingFloat : data.opening.suggested)));
  const [byNotes, setByNotes] = useState(false);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState({});
  const [note, setNote] = useState('');
  const [floatKept, setFloatKept] = useState('');
  const [statement, setStatement] = useState({});
  const byMode = data.figures.byMode;
  const cashIn = byMode.cash?.in || 0;
  const cashOut = byMode.cash?.out || 0;
  const expected = toPaise(opening) + cashIn - cashOut;
  const notesTotal = NOTES.reduce((s, n) => s + (Number(notes[`n${n}`]) || 0) * n * 100, 0) + toPaise(notes.coins);
  const countedPaise = byNotes ? notesTotal : toPaise(counted);
  const entered = byNotes ? notesTotal > 0 || Object.values(notes).some((v) => v !== '' && v != null) : counted !== '';
  const diff = countedPaise - expected;
  const close = useAction(
    () =>
      post('/cash/close', {
        branchId,
        day: data.day,
        openingFloat: toPaise(opening),
        ...(byNotes
          ? { denominations: { ...Object.fromEntries(NOTES.map((n) => [`n${n}`, Number(notes[`n${n}`]) || 0])), coins: toPaise(notes.coins) } }
          : { countedCash: toPaise(counted) }),
        floatKept: toPaise(floatKept),
        note: note.trim() || undefined,
        statement: Object.fromEntries(Object.entries(statement).filter(([, v]) => v !== '').map(([k, v]) => [k, toPaise(v)])),
      }),
    {
      invalidate: ['cash', 'dashboard'],
      // Only a matched drawer is a plain success; short or excess cash is a warning.
      onSuccess: (c) =>
        c.difference
          ? toast.warning(`Day closed. Cash ${c.difference < 0 ? 'short' : 'excess'} by ${inr(Math.abs(c.difference), { decimals: true })}`)
          : toast.success('Day closed. Cash matched.'),
    },
  );
  const nonCash = ['upi', 'card', 'bank', 'online'].filter((m) => byMode[m]?.in || byMode[m]?.out);
  return (
    <Card title={reopened ? 'Count again and close' : 'Count the drawer'}>
      {reopened && (
        <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
          Reopened by {reopened.reopens.at(-1)?.byName}: {reopened.reopens.at(-1)?.reason}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Opening float (₹)" hint={data.opening.fromDay ? `Kept in the drawer on ${fmtDate(data.opening.fromDay)}` : 'Cash in the drawer when the day started'}>
          <Input type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </Field>
        <div className="flex items-end pb-2">
          <Toggle checked={byNotes} onChange={setByNotes} label="Count by notes" />
        </div>
        {byNotes ? (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
            {NOTES.map((n) => (
              <Field key={n} label={`₹${n} notes`}>
                <Input type="number" min="0" value={notes[`n${n}`] ?? ''} onChange={(e) => setNotes({ ...notes, [`n${n}`]: e.target.value })} />
              </Field>
            ))}
            <Field label="Coins (₹)">
              <Input type="number" min="0" step="0.01" value={notes.coins ?? ''} onChange={(e) => setNotes({ ...notes, coins: e.target.value })} />
            </Field>
            <p className="col-span-2 self-end pb-2 text-sm text-slate-600 sm:col-span-1">
              Total <b>{inr(notesTotal, { decimals: true })}</b>
            </p>
          </div>
        ) : (
          <Field label="Cash counted (₹)" className="sm:col-span-2">
            <Input type="number" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </Field>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
        <div>
          <p className="text-slate-500">Expected</p>
          <p className="font-semibold">{inr(expected, { decimals: true })}</p>
        </div>
        <div>
          <p className="text-slate-500">Counted</p>
          <p className="font-semibold">{entered ? inr(countedPaise, { decimals: true }) : '—'}</p>
        </div>
        <div>
          <p className="text-slate-500">Difference</p>
          <div className="mt-0.5">{entered ? <Difference value={diff} /> : '—'}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={entered && diff !== 0 ? 'Note (required)' : 'Note'} required={entered && diff !== 0} className="sm:col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={entered && diff < 0 ? 'Why is cash short?' : entered && diff > 0 ? 'Why is there extra cash?' : 'Anything to note'} />
        </Field>
        <Field label="Keep as float for tomorrow (₹)" hint="Left in the drawer; becomes tomorrow's opening float">
          <Input type="number" min="0" value={floatKept} onChange={(e) => setFloatKept(e.target.value)} />
        </Field>
      </div>
      {nonCash.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Match with the bank / UPI / card statement (optional)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {nonCash.map((m) => {
              const net = (byMode[m]?.in || 0) - (byMode[m]?.out || 0);
              const d = statement[m] !== undefined && statement[m] !== '' ? toPaise(statement[m]) - net : null;
              return (
                <Field key={m} label={`${MODE_TEXT[m]} as per statement (₹)`} hint={`System: ${inr(net, { decimals: true })}${d ? ` · difference ${inr(d, { decimals: true })}` : d === 0 ? ' · matched' : ''}`}>
                  <Input type="number" min="0" step="0.01" value={statement[m] ?? ''} onChange={(e) => setStatement({ ...statement, [m]: e.target.value })} />
                </Field>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button loading={close.isPending} disabled={!entered || (diff !== 0 && note.trim().length < 2)} onClick={() => close.mutate()}>
          <Lock className="size-4" /> Close day
        </Button>
      </div>
    </Card>
  );
}

function ClosedSummary({ data }) {
  const c = data.closing;
  const [reopening, setReopening] = useState(false);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Lock className="size-4 text-emerald-600" /> Day closed
        </span>
      }
      actions={
        data.canReopen && (
          <Button size="sm" variant="secondary" onClick={() => setReopening(true)}>
            <LockOpen className="size-4" /> Reopen
          </Button>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Expected</dt>
          <dd className="font-semibold">{inr(c.expectedCash, { decimals: true })}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Counted</dt>
          <dd className="font-semibold">{inr(c.countedCash, { decimals: true })}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Difference</dt>
          <dd className="mt-0.5">
            <Difference value={c.difference} />
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Float kept</dt>
          <dd className="font-semibold">{inr(c.floatKept, { decimals: true })}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-slate-600">
        Closed by {c.closedBy?.name} on {fmtDateTime(c.closedAt)}
        {c.note ? ` · “${c.note}”` : ''}
      </p>
      {data.changedSinceClose && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Money was recorded after closing:{' '}
          {Object.entries(data.changedSinceClose)
            .filter(([, v]) => v)
            .map(([m, v]) => `${MODE_TEXT[m]} ${v > 0 ? '+' : ''}${inr(v, { decimals: true })}`)
            .join(', ')}
          . {data.canReopen ? 'Reopen the day to recount.' : 'Tell the owner or manager.'}
        </p>
      )}
      {reopening && <ReopenModal closing={c} onClose={() => setReopening(false)} />}
    </Card>
  );
}

function DayView({ branchId, day }) {
  const { data, isLoading, error } = useApi(['cash', 'day', branchId, day], '/cash/day', { branchId, day });
  if (error) return <EmptyState title="Could not load this day">{error.response?.data?.message}</EmptyState>;
  if (isLoading || !data) return <PageLoader />;
  const closed = data.closing?.status === 'closed';
  const opening = closed ? data.closing.openingFloat : data.opening.suggested;
  const byMode = data.figures.byMode;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Opening float" value={inr(opening)} hint={closed ? undefined : 'Suggested; change it below'} tone="slate" />
        <StatCard label="Cash in" value={inr(data.cashIn)} tone="green" />
        <StatCard label="Cash out" value={inr(data.cashOut)} hint="Refunds, expenses, deposits returned" tone="red" />
        <StatCard label="Expected in drawer" value={inr(opening + data.cashIn - data.cashOut)} tone="brand" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Recorded on ${fmtDate(data.day)}${data.branch ? ` · ${data.branch.name}` : ''}`} padded={false}>
          <Table
            rowKey="k"
            rows={data.figures.sources.map((s) => ({ ...s, k: `${s.key}:${s.mode}` }))}
            empty={<EmptyState title="Nothing recorded yet">Payments, shop sales, locker charges and expenses of the day show here.</EmptyState>}
            columns={[
              { key: 'label', label: 'From' },
              { key: 'mode', label: 'Mode', render: (s) => MODE_TEXT[s.mode] || s.mode },
              { key: 'in', label: 'In', render: (s) => (s.in ? inr(s.in, { decimals: true }) : '—') },
              { key: 'out', label: 'Out', render: (s) => (s.out ? <span className="text-rose-600">{inr(s.out, { decimals: true })}</span> : '—') },
            ]}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-3 text-sm">
            {Object.entries(byMode)
              .filter(([, t]) => t.in || t.out)
              .map(([m, t]) => (
                <span key={m}>
                  {MODE_TEXT[m]}: <b>{inr(t.in - t.out, { decimals: true })}</b>
                </span>
              ))}
          </div>
        </Card>
        <div className="space-y-4">
          {closed ? <ClosedSummary data={data} /> : <CloseForm key={`${data.day}:${data.closing?._id || 'new'}:${data.closing?.closeCount || 0}`} data={data} branchId={branchId} />}
          {closed && data.statement.some((s) => s.statement != null) && (
            <Card title="Statement match" padded={false}>
              <Table
                rowKey="mode"
                rows={data.statement.filter((s) => s.statement != null)}
                columns={[
                  { key: 'mode', label: 'Mode', render: (s) => MODE_TEXT[s.mode] },
                  { key: 'system', label: 'System', render: (s) => inr(s.system, { decimals: true }) },
                  { key: 'statement', label: 'Statement', render: (s) => inr(s.statement, { decimals: true }) },
                  { key: 'd', label: 'Difference', render: (s) => (s.difference ? <span className="text-rose-600">{inr(s.difference, { decimals: true })}</span> : 'Matched') },
                ]}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function History({ onOpen }) {
  const [from, setFrom] = useState(ymd(dayjs().subtract(30, 'day')));
  const [to, setTo] = useState(ymd());
  const [result, setResult] = useState('');
  const [page, setPage] = useState(1);
  const branchId = useAuth((s) => s.branchId);
  const { data } = useApi(['cash', 'closings', from, to, result, page], '/cash/closings', { from, to, result, page });
  const qs = new URLSearchParams({ from, to, ...(result && { result }), ...(branchId && { branchId }), export: 'xlsx' });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Short in total" value={inr(-(data?.summary?.short || 0))} tone="red" />
        <StatCard label="Excess in total" value={inr(data?.summary?.excess)} tone="amber" />
        <StatCard label="Days short" value={data?.summary?.shortDays ?? 0} tone="slate" />
      </div>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className="w-auto" />
          <span className="text-slate-400">to</span>
          <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className="w-auto" />
          <Select value={result} onChange={(e) => (setResult(e.target.value), setPage(1))} className="w-auto" aria-label="Result">
            <option value="">All results</option>
            <option value="short">Short</option>
            <option value="excess">Excess</option>
            <option value="matched">Matched</option>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => openFile(`/cash/closings?${qs}`, { download: `day-closings-${from}-to-${to}.xlsx` })}>
            <Download className="size-4" /> Excel
          </Button>
        </div>
        <Table
          rows={data?.items}
          onRowClick={onOpen}
          empty={<EmptyState title="No closings in this period">Days appear here once reception closes them.</EmptyState>}
          columns={[
            { key: 'day', label: 'Day', render: (c) => fmtDate(c.day) },
            { key: 'b', label: 'Branch', className: 'hidden sm:table-cell', render: (c) => c.branchId?.name },
            { key: 'e', label: 'Expected', render: (c) => inr(c.expectedCash) },
            { key: 'c', label: 'Counted', render: (c) => inr(c.countedCash) },
            { key: 'd', label: 'Difference', render: (c) => <Difference value={c.difference} /> },
            { key: 's', label: 'Status', render: (c) => <Badge status={c.status === 'closed' ? 'active' : 'contacted'}>{c.status === 'closed' ? 'Closed' : 'Reopened'}</Badge> },
            { key: 'by', label: 'Closed by', className: 'hidden md:table-cell', render: (c) => c.closedBy?.name },
            { key: 'n', label: 'Note', className: 'hidden lg:table-cell max-w-64 truncate', render: (c) => c.note || '—' },
          ]}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>
    </div>
  );
}

export default function CashClosing() {
  const can = useAuth((s) => s.can);
  const viewBranch = useAuth((s) => s.branchId);
  const defaultBranch = useDefaultBranchId();
  const { data: branches } = useBranches();
  const [picked, setPicked] = useState('');
  const [tab, setTab] = useState('day');
  const [day, setDay] = useState(ymd());
  const manage = can('cash.manage');
  const branchId = picked || viewBranch || defaultBranch;
  return (
    <div>
      <PageHeader title="Day closing" subtitle="Count the cash drawer at the end of the day and match it with what the system recorded" />
      {manage && (
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'day', label: 'Close day' },
            { value: 'history', label: 'History' },
          ]}
        />
      )}
      {tab === 'day' && (
        <>
          <div className={clsx('mb-4 flex flex-wrap items-center gap-2', !(manage || branches?.length > 1) && 'hidden')}>
            {branches?.length > 1 && (
              <Select value={branchId} onChange={(e) => setPicked(e.target.value)} className="w-auto" aria-label="Branch">
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
            {manage && <Input type="date" value={day} max={ymd()} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-auto" />}
          </div>
          {branchId ? <DayView branchId={branchId} day={manage ? day : ymd()} /> : <PageLoader />}
        </>
      )}
      {tab === 'history' && manage && (
        <History
          onOpen={(c) => {
            setPicked(c.branchId?._id || '');
            setDay(c.day);
            setTab('day');
          }}
        />
      )}
    </div>
  );
}
