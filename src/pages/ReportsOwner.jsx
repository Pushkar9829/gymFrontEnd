import { useState } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import { Download, Send, FileSpreadsheet } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { post, openFile } from '../lib/api';
import { useAction, useApi } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate } from '../lib/format';
import { Button, Card, EmptyState, Select, StatCard, Table } from '../components/ui';

const MODES = ['cash', 'upi', 'card', 'bank', 'online'];
const pct = (v) => (v == null ? '—' : `${v}%`);
const useBranchQs = () => {
  const branchId = useAuth((s) => s.branchId);
  return branchId ? `&branchId=${branchId}` : '';
};

export function StaffReport({ from, to }) {
  const { data } = useApi('report-staff', '/reports/staff', { from, to });
  const bq = useBranchQs();
  return (
    <div className="space-y-4">
      <Card
        title="Front desk"
        padded={false}
        actions={
          <Button size="sm" variant="ghost" onClick={() => openFile(`/reports/staff?export=xlsx&from=${from}&to=${to}${bq}`, { download: `staff-performance-${from}-to-${to}.xlsx` })}>
            <Download className="size-4" /> Excel
          </Button>
        }
      >
        <Table
          rowKey="name"
          rows={data?.staff}
          empty={<EmptyState title="No staff activity in this period" />}
          columns={[
            { key: 'name', label: 'Staff', render: (r) => <span><b>{r.name}</b>{r.role && <span className="ml-1 text-xs text-slate-500 capitalize">{r.role}</span>}</span> },
            {
              key: 'p',
              label: 'Collected',
              render: (r) => (
                <span title={MODES.filter((m) => r.payments.byMode[m]).map((m) => `${m.toUpperCase()} ${inr(r.payments.byMode[m])}`).join(' · ')}>
                  {inr(r.payments.amount)} <span className="text-xs text-slate-500">({r.payments.count})</span>
                </span>
              ),
            },
            { key: 'modes', label: 'By mode', className: 'hidden xl:table-cell', render: (r) => MODES.filter((m) => r.payments.byMode[m]).map((m) => `${m.toUpperCase()} ${inr(r.payments.byMode[m])}`).join(' · ') || '—' },
            { key: 'n', label: 'New', render: (r) => r.newMemberships },
            { key: 'rn', label: 'Renewals', render: (r) => r.renewals },
            { key: 'pt', label: 'PT sold', render: (r) => r.ptSold },
            { key: 's', label: 'Shop', render: (r) => (r.shopSales ? `${r.shopSales} · ${inr(r.shopAmount)}` : '—') },
            { key: 'l', label: 'Leads', render: (r) => (r.leads ? `${r.converted}/${r.leads} (${pct(r.conversion)})` : '—') },
            { key: 'd', label: 'Discounts given', render: (r) => (r.discounts ? inr(r.discounts) : '—') },
          ]}
        />
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          Payments are credited to who received them; memberships, PT and shop sales to who sold them; leads to who they are assigned to. Older records (and online payments) without a name show as “Not recorded”.
        </p>
      </Card>
      <Card title="Trainers" padded={false}>
        <Table
          rowKey="name"
          rows={data?.trainers}
          empty={<EmptyState title="No trainers yet">Add trainers in Settings → Staff.</EmptyState>}
          columns={[
            { key: 'name', label: 'Trainer', render: (r) => <b>{r.name}</b> },
            { key: 's', label: 'PT sessions', render: (r) => `${r.sessions}${r.noShows ? ` (+${r.noShows} no-show)` : ''}` },
            { key: 'a', label: 'Active PT clients', render: (r) => r.activeClients },
            { key: 'r', label: 'PT renewals', render: (r) => (r.ptEnded ? `${r.ptRenewed}/${r.ptEnded} (${pct(r.renewalRate)})` : '—') },
            { key: 'c', label: 'Classes', render: (r) => r.classes },
            { key: 'at', label: 'Class attendance', render: (r) => pct(r.attendance) },
            { key: 'cm', label: 'Commission', render: (r) => inr(r.commission) },
          ]}
        />
      </Card>
    </div>
  );
}

function RiskTable({ rows, reason, empty }) {
  const remind = useAction(({ memberId }) => post('/reports/retention/remind', { memberId, reason }), { success: (_d, v) => `Reminder sent to ${v.name}` });
  return (
    <Table
      rows={rows}
      empty={<EmptyState title={empty} />}
      columns={[
        { key: 'm', label: 'Member', render: (m) => <Link to={`/admin/members/${m._id}`} className="font-medium text-brand-700 hover:underline">{m.name} #{m.memberCode}</Link> },
        { key: 'phone', label: 'Phone' },
        { key: 'plan', label: 'Plan', className: 'hidden md:table-cell', render: (m) => m.currentPlanName || '—' },
        { key: 'end', label: 'End date', render: (m) => fmtDate(m.membershipEnd) },
        { key: 'v', label: 'Last visit', render: (m) => (m.lastVisitAt ? `${fmtDate(m.lastVisitAt)}${m.daysAway != null ? ` (${m.daysAway}d)` : ''}` : 'Never') },
        {
          key: 'x',
          label: '',
          render: (m) => (
            <Button size="sm" variant="secondary" loading={remind.isPending && remind.variables?.memberId === m._id} onClick={() => remind.mutate({ memberId: m._id, name: m.name })}>
              <Send className="size-4" /> Send reminder
            </Button>
          ),
        },
      ]}
    />
  );
}

export function RetentionReport() {
  const [months, setMonths] = useState(6);
  const [days, setDays] = useState(14);
  const { data } = useApi('report-retention', '/reports/retention', { months, inactiveDays: days });
  const bq = useBranchQs();
  const t = data?.totals;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="w-auto" aria-label="Months">
          {[6, 12].map((m) => (
            <option key={m} value={m}>
              Last {m} months
            </option>
          ))}
        </Select>
        <span className="text-slate-500">Renewal window: {data?.graceDays ?? '…'} days after the end date (Settings)</span>
        <Button size="sm" variant="ghost" onClick={() => openFile(`/reports/retention?export=xlsx&months=${months}&inactiveDays=${days}${bq}`, { download: 'retention.xlsx' })}>
          <Download className="size-4" /> Excel
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Retention" value={pct(t?.retention)} tone="green" />
        <StatCard label="Churn" value={pct(t?.churn)} tone="red" />
        <StatCard label="Renewed" value={t?.renewed ?? 0} hint={`of ${t?.ended ?? 0} memberships ended`} tone="brand" />
        <StatCard label="Lost" value={t?.lost ?? 0} hint={t?.pending ? `${t.pending} still in the renewal window` : undefined} tone="amber" />
      </div>
      <Card title="Renewals by month">
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={(data?.months || []).map((m) => ({ month: dayjs(`${m.month}-01`).format('MMM YY'), Renewed: m.renewed, Lost: m.lost, Pending: m.pending, 'Retention %': m.retention }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="n" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="n" dataKey="Renewed" stackId="a" fill="#0f766e" />
              <Bar yAxisId="n" dataKey="Lost" stackId="a" fill="#f43f5e" />
              <Bar yAxisId="n" dataKey="Pending" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="Retention %" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="By month" padded={false}>
        <Table
          rowKey="month"
          rows={data?.months}
          columns={[
            { key: 'label', label: 'Month' },
            { key: 'ended', label: 'Ended' },
            { key: 'renewed', label: 'Renewed' },
            { key: 'lost', label: 'Lost' },
            { key: 'pending', label: 'Can still renew' },
            { key: 'retention', label: 'Retention', render: (m) => pct(m.retention) },
            { key: 'churn', label: 'Churn', render: (m) => pct(m.churn) },
          ]}
        />
      </Card>
      <Card
        title={`At risk: no visit in ${days}+ days (${data?.atRisk?.inactive?.length ?? 0})`}
        padded={false}
        actions={
          <span className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <Button key={d} size="sm" variant={d === days ? 'primary' : 'secondary'} onClick={() => setDays(d)}>
                {d}d
              </Button>
            ))}
          </span>
        }
      >
        <RiskTable rows={data?.atRisk?.inactive} reason="inactive" empty="Every active member visited recently" />
      </Card>
      <Card title={`At risk: ending in 7 days, not renewed (${data?.atRisk?.expiring?.length ?? 0})`} padded={false}>
        <RiskTable rows={data?.atRisk?.expiring} reason="expiring" empty="No memberships ending in the next 7 days" />
      </Card>
      <p className="text-xs text-slate-500">Reminders go by SMS / WhatsApp when they are switched on in Settings, at most once a day per member.</p>
    </div>
  );
}

const MONTHS = Array.from({ length: 13 }, (_, i) => dayjs().subtract(i, 'month'));

export function GstReport() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const { data } = useApi('report-gstr1', '/reports/gstr1', { month });
  const { data: tally } = useApi('report-tally', '/reports/tally', { month });
  const bq = useBranchQs();
  const t = data?.totals;
  const file = (path, ext) => openFile(`/reports/${path}?month=${month}&export=${ext}${bq}`, { download: `${path === 'gstr1' ? 'GSTR1' : 'tally'}-${month}.${ext}` });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label="Month">
          {MONTHS.map((m) => (
            <option key={m.format('YYYY-MM')} value={m.format('YYYY-MM')}>
              {m.format('MMMM YYYY')}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={() => file('gstr1', 'xlsx')}>
          <FileSpreadsheet className="size-4" /> GSTR-1 (Excel)
        </Button>
        <Button size="sm" variant="secondary" onClick={() => file('tally', 'xlsx')}>
          <Download className="size-4" /> Tally (Excel)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => file('tally', 'csv')}>
          Tally (CSV)
        </Button>
      </div>
      {data && !data.gstin && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          The gym GSTIN is not set. Add it in <Link to="/admin/settings" className="font-medium underline">Settings</Link> so the state (CGST/SGST vs IGST) is worked out correctly.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Taxable value" value={inr(t?.taxable)} hint={`${t?.documents ?? 0} invoices / bills`} tone="brand" />
        <StatCard label="CGST + SGST" value={inr((t?.cgst || 0) + (t?.sgst || 0))} hint={`CGST ${inr(t?.cgst)} · SGST ${inr(t?.sgst)}`} tone="green" />
        <StatCard label="IGST" value={inr(t?.igst)} hint={`${data?.b2b ?? 0} B2B invoice(s)`} tone="indigo" />
        <StatCard label="Refunds" value={inr(data?.refunds?.amount)} hint={`${data?.refunds?.count ?? 0} in the month`} tone="amber" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="HSN / SAC summary" padded={false}>
          <Table
            rowKey="k"
            rows={data?.hsn?.map((h) => ({ ...h, k: `${h.hsn}|${h.rate}` }))}
            empty={<EmptyState title="No invoices in this month" />}
            columns={[
              { key: 'hsn', label: 'HSN/SAC', render: (h) => h.hsn || <span className="text-amber-600">Not set</span> },
              { key: 'desc', label: 'Description', className: 'hidden sm:table-cell' },
              { key: 'rate', label: 'Rate', render: (h) => `${h.rate}%` },
              { key: 'taxable', label: 'Taxable', render: (h) => inr(h.taxable, { decimals: true }) },
              { key: 'tax', label: 'Tax', render: (h) => inr(h.igst + h.cgst + h.sgst, { decimals: true }) },
            ]}
          />
        </Card>
        <Card title="Tally sales register" padded={false}>
          <Table
            rowKey="ledger"
            rows={tally?.byLedger}
            empty={<EmptyState title="No sales in this month" />}
            columns={[
              { key: 'ledger', label: 'Ledger' },
              { key: 'count', label: 'Vouchers' },
              { key: 'taxable', label: 'Taxable', render: (l) => inr(l.taxable, { decimals: true }) },
              { key: 'tax', label: 'GST', render: (l) => inr(l.tax, { decimals: true }) },
              { key: 'total', label: 'Total', render: (l) => inr(l.total, { decimals: true }) },
            ]}
          />
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Receipts sheet: {tally?.receipts ?? 0} entries, {inr(tally?.received, { decimals: true })} net received.</p>
        </Card>
      </div>
      {data?.notes && (
        <Card title="Notes for your accountant">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
