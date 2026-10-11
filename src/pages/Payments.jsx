import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, FileText } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { openFile } from '../lib/api';
import { useAuth } from '../store/auth';
import { inr, fmtDateTime, ymd, PAYMENT_MODES } from '../lib/format';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Pagination, Select, Spinner, StatCard, Table } from '../components/ui';
import dayjs from 'dayjs';

export default function Payments() {
  const [from, setFrom] = useState(ymd(dayjs().startOf('month')));
  const [to, setTo] = useState(ymd());
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const branchId = useAuth((s) => s.branchId);
  const navigate = useNavigate();
  const { data, isLoading } = useApi('payments', '/payments', { from, to, mode, page });

  const qs = new URLSearchParams({ from, to, ...(mode && { mode }), ...(branchId && { branchId }), export: 'xlsx' });

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="All collections and refunds"
        actions={
          <Button variant="secondary" onClick={() => openFile(`/payments?${qs}`, { download: `payments-${from}-to-${to}.xlsx` })}>
            <Download className="size-4" /> Export Excel
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Collected" value={inr(data?.summary?.collected)} tone="green" />
        <StatCard label="Refunded" value={inr(data?.summary?.refunded)} tone="red" />
        <StatCard label="Net" value={inr((data?.summary?.collected || 0) - (data?.summary?.refunded || 0))} />
      </div>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className="w-auto" />
          <span className="text-slate-400">to</span>
          <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className="w-auto" />
          <Select value={mode} onChange={(e) => (setMode(e.target.value), setPage(1))} className="w-auto">
            <option value="">All modes</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        {isLoading ? (
          <div className="p-6">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              rows={data?.items}
              onRowClick={(p) => navigate(`/admin/members/${p.memberId?._id}`)}
              empty={<EmptyState title="No payments in this period" />}
              columns={[
                { key: 'receiptNo', label: 'Receipt' },
                { key: 'paidAt', label: 'Date', render: (p) => fmtDateTime(p.paidAt) },
                { key: 'member', label: 'Member', render: (p) => (p.memberId ? `${p.memberId.name} (#${p.memberId.memberCode})` : '—') },
                { key: 'type', label: 'Type', render: (p) => <Badge status={p.type === 'refund' ? 'deny' : 'allow'}>{p.type}</Badge> },
                { key: 'mode', label: 'Mode', render: (p) => p.mode.toUpperCase() },
                { key: 'amount', label: 'Amount', render: (p) => <b className={p.type === 'refund' ? 'text-rose-600' : ''}>{p.type === 'refund' ? '-' : ''}{inr(p.amount)}</b> },
                { key: 'by', label: 'Received by', className: 'hidden md:table-cell', render: (p) => p.receivedBy?.name || '—' },
                {
                  key: 'pdf',
                  label: '',
                  render: (p) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFile(`/payments/${p._id}/receipt.pdf`);
                      }}
                    >
                      <FileText className="size-4" />
                    </Button>
                  ),
                },
              ]}
            />
            <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
