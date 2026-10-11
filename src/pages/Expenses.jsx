import { useState } from 'react';
import { Plus, Trash2, Download } from 'lucide-react';
import dayjs from 'dayjs';
import { del, post, openFile } from '../lib/api';
import { useApi, useAction, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate, toPaise, ymd } from '../lib/format';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, StatCard, Table } from '../components/ui';

const CATEGORIES = ['rent', 'electricity', 'salary', 'maintenance', 'equipment', 'marketing', 'water', 'internet', 'cleaning', 'other'];

function ExpenseForm({ onClose }) {
  const branchId = useDefaultBranchId();
  const [f, setF] = useState({ category: 'rent', amount: '', date: ymd(), mode: 'cash', note: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => post('/expenses', b), { success: 'Expense added', invalidate: ['expenses', 'dashboard'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="Add expense"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate({ ...f, branchId, amount: toPaise(f.amount) })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select value={f.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₹)" required>
          <Input type="number" min="0" value={f.amount} onChange={set('amount')} autoFocus />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} max={ymd()} onChange={set('date')} />
        </Field>
        <Field label="Paid via">
          <Select value={f.mode} onChange={set('mode')}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
          </Select>
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <Input value={f.note} onChange={set('note')} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const [from, setFrom] = useState(ymd(dayjs().startOf('month')));
  const [to, setTo] = useState(ymd());
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { can, branchId } = useAuth();
  const { data, isLoading } = useApi('expenses', '/expenses', { from, to, category, page });
  const remove = useAction((id) => del(`/expenses/${id}`), { success: 'Deleted', invalidate: ['expenses'] });
  const qs = new URLSearchParams({ from, to, ...(category && { category }), ...(branchId && { branchId }), export: 'xlsx' });

  return (
    <div>
      <PageHeader
        title="Expenses"
        actions={
          <>
            <Button variant="secondary" onClick={() => openFile(`/expenses?${qs}`, { download: 'expenses.xlsx' })}>
              <Download className="size-4" /> Excel
            </Button>
            {can('expenses.write') && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Add expense
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={inr(data?.summary?.total)} tone="red" />
        {data?.summary?.byCategory?.slice(0, 3).map((c) => (
          <StatCard key={c._id} label={c._id} value={inr(c.amount)} tone="slate" />
        ))}
      </div>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className="w-auto" />
          <span className="text-slate-400">to</span>
          <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className="w-auto" />
          <Select value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))} className="w-auto capitalize">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
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
              empty={<EmptyState title="No expenses in this period" />}
              columns={[
                { key: 'date', label: 'Date', render: (e) => fmtDate(e.date) },
                { key: 'category', label: 'Category', render: (e) => <span className="capitalize">{e.category}</span> },
                { key: 'amount', label: 'Amount', render: (e) => <b>{inr(e.amount)}</b> },
                { key: 'mode', label: 'Mode', render: (e) => e.mode?.toUpperCase() },
                { key: 'note', label: 'Note', className: 'whitespace-normal', render: (e) => e.note || '—' },
                { key: 'by', label: 'Added by', className: 'hidden md:table-cell', render: (e) => e.createdBy?.name || '—' },
                {
                  key: 'x',
                  label: '',
                  render: (e) =>
                    can('expenses.write') && (
                      <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => window.confirm('Delete this expense?') && remove.mutate(e._id)} aria-label="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    ),
                },
              ]}
            />
            <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
          </>
        )}
      </Card>
      {creating && <ExpenseForm onClose={() => setCreating(false)} />}
    </div>
  );
}
