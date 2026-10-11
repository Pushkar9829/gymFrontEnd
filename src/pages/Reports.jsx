import { useState } from 'react';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useApi } from '../lib/hooks';
import { openFile } from '../lib/api';
import { useAuth } from '../store/auth';
import { inr, fmtDate, ymd } from '../lib/format';
import { Button, Card, EmptyState, Input, PageHeader, StatCard, Table, Tabs } from '../components/ui';

const rupees = (v) => Math.round(v / 100);
const DENY_LABEL = {
  EXPIRED: 'Membership expired',
  FROZEN: 'Frozen',
  NO_MEMBERSHIP: 'No membership',
  NOT_STARTED: 'Not started yet',
  BLOCKED: 'Blocked',
  CANCELLED: 'Cancelled',
  DUES: 'Dues pending',
  DEVICE_DENIED: 'Device refused',
  UNKNOWN_USER: 'Unknown finger/ID',
};

function Range({ from, to, setFrom, setTo }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
      <span className="text-slate-400">to</span>
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      {[
        ['This month', dayjs().startOf('month'), dayjs()],
        ['Last month', dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
        ['Last 90 days', dayjs().subtract(89, 'day'), dayjs()],
      ].map(([label, a, b]) => (
        <Button key={label} size="sm" variant="ghost" onClick={() => (setFrom(ymd(a)), setTo(ymd(b)))}>
          {label}
        </Button>
      ))}
    </div>
  );
}

function Finance({ from, to }) {
  const { data: col } = useApi('report-collections', '/reports/collections', { from, to });
  const { data: pnl } = useApi('report-pnl', '/reports/pnl', { from, to });
  const branchId = useAuth((s) => s.branchId);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Collected" value={inr(pnl?.collected)} tone="green" />
        <StatCard label="Refunds" value={inr(pnl?.refunded)} tone="amber" />
        <StatCard label="Shop profit" value={inr(pnl?.shopProfit)} hint={`Sales ${inr(pnl?.shopSales)}`} tone="indigo" />
        <StatCard label="Expenses" value={inr(pnl?.expenses)} tone="red" />
        <StatCard label="Profit" value={inr(pnl?.profit)} tone={pnl?.profit >= 0 ? 'brand' : 'red'} />
      </div>
      <Card
        title="Collections by day"
        actions={
          <Button size="sm" variant="ghost" onClick={() => openFile(`/reports/collections?export=xlsx&from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ''}`, { download: 'collections.xlsx' })}>
            <Download className="size-4" /> Excel
          </Button>
        }
      >
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={(col?.byDay || []).map((d) => ({ day: dayjs(d._id).format('DD MMM'), Collected: rupees(d.collected), Refunded: rupees(d.refunded) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
              <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
              <Legend />
              <Bar dataKey="Collected" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Refunded" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By payment mode" padded={false}>
          <Table rowKey="_id" rows={col?.byMode} columns={[{ key: '_id', label: 'Mode', render: (r) => r._id.toUpperCase() }, { key: 'count', label: 'Payments' }, { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) }]} />
        </Card>
        <Card title="Expenses by category" padded={false}>
          <Table rowKey="_id" rows={pnl?.expensesByCategory} columns={[{ key: '_id', label: 'Category', render: (r) => <span className="capitalize">{r._id}</span> }, { key: 'amount', label: 'Amount', render: (r) => inr(r.amount) }]} />
        </Card>
      </div>
    </div>
  );
}

function Dues() {
  const { data } = useApi('report-dues', '/reports/dues');
  const branchId = useAuth((s) => s.branchId);
  return (
    <Card
      title={`Pending dues · ${inr(data?.total)}`}
      padded={false}
      actions={
        <Button size="sm" variant="ghost" onClick={() => openFile(`/reports/dues?export=xlsx${branchId ? `&branchId=${branchId}` : ''}`, { download: 'dues.xlsx' })}>
          <Download className="size-4" /> Excel
        </Button>
      }
    >
      <Table
        rows={data?.items}
        empty={<EmptyState title="No pending dues 🎉" />}
        columns={[
          { key: 'm', label: 'Member', render: (s) => `${s.memberId?.name} (#${s.memberId?.memberCode})` },
          { key: 'phone', label: 'Phone', render: (s) => s.memberId?.phone },
          { key: 'plan', label: 'Plan', render: (s) => s.plan?.name },
          { key: 'total', label: 'Total', render: (s) => inr(s.totalAmount) },
          { key: 'paid', label: 'Paid', render: (s) => inr(s.paidAmount) },
          { key: 'due', label: 'Due', render: (s) => <b className="text-rose-600">{inr(s.dueAmount)}</b> },
        ]}
      />
    </Card>
  );
}

function Memberships() {
  const [days, setDays] = useState(7);
  const { data } = useApi('report-memberships', '/reports/memberships', { days });
  const cols = [
    { key: 'name', label: 'Member', render: (m) => `${m.name} (#${m.memberCode})` },
    { key: 'phone', label: 'Phone' },
    { key: 'plan', label: 'Plan', render: (m) => m.currentPlanName || '—' },
    { key: 'end', label: 'End date', render: (m) => fmtDate(m.membershipEnd) },
    { key: 'due', label: 'Due', render: (m) => (m.dueAmount ? inr(m.dueAmount) : '—') },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        Window:
        {[7, 15, 30].map((d) => (
          <Button key={d} size="sm" variant={d === days ? 'primary' : 'secondary'} onClick={() => setDays(d)}>
            {d} days
          </Button>
        ))}
      </div>
      <Card title={`Expiring in the next ${days} days (${data?.expiring?.length ?? 0})`} padded={false}>
        <Table rows={data?.expiring} columns={cols} empty={<EmptyState title="None" />} />
      </Card>
      <Card title={`Expired in the last ${days} days (${data?.recentlyExpired?.length ?? 0})`} padded={false}>
        <Table rows={data?.recentlyExpired} columns={cols} empty={<EmptyState title="None" />} />
      </Card>
    </div>
  );
}

function AttendanceReport({ from, to }) {
  const { data } = useApi('report-attendance', '/reports/attendance', { from, to });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Busiest hours">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={(data?.byHour || []).map((h) => ({ hour: `${String(h._id).padStart(2, '0')}:00`, Visits: h.count }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip />
              <Bar dataKey="Visits" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Denied entries by reason" padded={false}>
        <Table rowKey="_id" rows={data?.deniedByReason} empty={<EmptyState title="No denied entries" />} columns={[{ key: '_id', label: 'Reason', render: (r) => DENY_LABEL[r._id] || r._id }, { key: 'count', label: 'Count' }]} />
      </Card>
    </div>
  );
}

function LeadsReport({ from, to }) {
  const { data } = useApi('report-leads', '/reports/leads', { from, to });
  return (
    <Card title="Lead conversion by source" padded={false}>
      <Table
        rowKey="source"
        rows={data}
        empty={<EmptyState title="No leads in this period" />}
        columns={[
          { key: 'source', label: 'Source', render: (r) => <span className="capitalize">{r.source}</span> },
          { key: 'total', label: 'Leads' },
          { key: 'converted', label: 'Converted' },
          { key: 'conversionRate', label: 'Conversion', render: (r) => `${r.conversionRate}%` },
        ]}
      />
    </Card>
  );
}

function Branches({ from, to }) {
  const { data } = useApi('report-branches', '/reports/branches', { from, to, branchId: '' });
  return (
    <Card title="Branch comparison" padded={false}>
      <Table
        rowKey="branchId"
        rows={data?.rows}
        empty={<EmptyState title="No branches" />}
        columns={[
          { key: 'name', label: 'Branch', render: (r) => <b>{r.name}</b> },
          { key: 'a', label: 'Active members', render: (r) => r.activeMembers },
          { key: 'n', label: 'New', render: (r) => r.newMembers },
          { key: 'v', label: 'Visits', render: (r) => r.visits },
          { key: 'c', label: 'Collected', render: (r) => inr(r.collected) },
          { key: 'e', label: 'Expenses', render: (r) => inr(r.expenses) },
          { key: 'p', label: 'Profit', render: (r) => <span className={r.profit < 0 ? 'text-rose-600' : 'text-emerald-700'}>{inr(r.profit)}</span> },
          { key: 'd', label: 'Dues', render: (r) => inr(r.dues) },
        ]}
      />
    </Card>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('finance');
  const [from, setFrom] = useState(ymd(dayjs().startOf('month')));
  const [to, setTo] = useState(ymd());
  const ranged = ['finance', 'attendance', 'leads', 'branches'].includes(tab);
  return (
    <div>
      <PageHeader title="Reports" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'finance', label: 'Income & P&L' },
          { value: 'dues', label: 'Dues' },
          { value: 'memberships', label: 'Expiring / expired' },
          { value: 'attendance', label: 'Attendance' },
          { value: 'leads', label: 'Leads' },
          { value: 'branches', label: 'Branches' },
        ]}
      />
      {ranged && <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />}
      {tab === 'finance' && <Finance from={from} to={to} />}
      {tab === 'dues' && <Dues />}
      {tab === 'memberships' && <Memberships />}
      {tab === 'attendance' && <AttendanceReport from={from} to={to} />}
      {tab === 'leads' && <LeadsReport from={from} to={to} />}
      {tab === 'branches' && <Branches from={from} to={to} />}
    </div>
  );
}
