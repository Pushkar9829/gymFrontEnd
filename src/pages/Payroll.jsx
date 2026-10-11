import { useState } from 'react';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, FileText, Plus, Trash2 } from 'lucide-react';
import { get, post, put, openFile } from '../lib/api';
import { useAction } from '../lib/hooks';
import { inr, toPaise, toRupees, fmtDate } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Table } from '../components/ui';

const STATUS = { draft: 'upcoming', finalized: 'active', paid: 'allow' };

function Lines({ label, lines, onChange }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>
      {lines.map((l, i) => (
        <div key={i} className="mb-1 flex gap-2">
          <Input value={l.label} placeholder="Description" onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input type="number" min="0" className="w-32" value={l.amount} placeholder="₹" onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
          <button className="text-slate-400 hover:text-rose-600" onClick={() => onChange(lines.filter((_, j) => j !== i))} aria-label="Remove">
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...lines, { label: '', amount: '' }])}>
        <Plus className="size-4" /> Add
      </Button>
    </div>
  );
}

function EditPayslip({ slip, onClose }) {
  const toForm = (ls) => (ls || []).map((l) => ({ label: l.label, amount: toRupees(l.amount) }));
  const [additions, setAdditions] = useState(toForm(slip.additions));
  const [deductions, setDeductions] = useState(toForm(slip.deductions));
  const [leave, setLeave] = useState(slip.paidLeaveDays || 0);
  const toApi = (ls) => ls.filter((l) => l.label.trim() && Number(l.amount) >= 0).map((l) => ({ label: l.label.trim(), amount: toPaise(l.amount) }));
  const save = useAction((b) => put(`/payroll/${slip._id}`, b), { success: 'Payslip updated', invalidate: ['payroll'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit payslip · ${slip.userId?.name}`}
      footer={<Button loading={save.isPending} onClick={() => save.mutate({ paidLeaveDays: Number(leave) || 0, additions: toApi(additions), deductions: toApi(deductions) })}>Save</Button>}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Present {slip.daysPresent} of {slip.workingDays} working days. Base pay is recalculated when you change paid leave.
        </p>
        <Field label="Paid leave days">
          <Input type="number" min="0" max="31" value={leave} onChange={(e) => setLeave(e.target.value)} className="w-32" />
        </Field>
        <Lines label="Additions (bonus, overtime…)" lines={additions} onChange={setAdditions} />
        <Lines label="Deductions (advance, PF, ESI, TDS…)" lines={deductions} onChange={setDeductions} />
      </div>
    </Modal>
  );
}

function PayModal({ slip, onClose }) {
  const [mode, setMode] = useState('bank');
  const [reference, setReference] = useState('');
  const pay = useAction(() => post(`/payroll/${slip._id}/pay`, { mode, reference: reference || undefined }), {
    success: 'Marked as paid and added to expenses',
    invalidate: ['payroll', 'expenses'],
    onSuccess: onClose,
  });
  return (
    <Modal open onClose={onClose} title={`Pay ${inr(slip.netPay)} to ${slip.userId?.name}`} size="sm" footer={<Button loading={pay.isPending} onClick={() => pay.mutate()}>Mark as paid</Button>}>
      <div className="space-y-3">
        <Field label="Paid via">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="bank">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
          </Select>
        </Field>
        <Field label="Reference / UTR">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">A salary expense is recorded automatically, so it shows in Profit & Loss.</p>
      </div>
    </Modal>
  );
}

export default function Payroll() {
  const [month, setMonth] = useState(dayjs().subtract(1, 'month').format('YYYY-MM'));
  const [modal, setModal] = useState(null);
  const { data } = useQuery({ queryKey: ['payroll', month], queryFn: () => get('/payroll', { month }) });
  const generate = useAction(() => post('/payroll/generate', { month }), {
    success: (r) => `Payroll ready: ${r.created} new, ${r.updated} refreshed${r.locked ? `, ${r.locked} already finalized` : ''}`,
    invalidate: ['payroll'],
  });
  const finalize = useAction((id) => post(`/payroll/${id}/finalize`), { success: 'Finalized', invalidate: ['payroll'] });
  const reopen = useAction((id) => post(`/payroll/${id}/reopen`), { success: 'Back to draft', invalidate: ['payroll'] });

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Salaries from staff attendance (Attendance → Staff) and PT commission. Set each person's salary in Settings → Staff."
        actions={
          <>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
            <Button loading={generate.isPending} onClick={() => generate.mutate()}>
              <RefreshCw className="size-4" /> {data?.items?.length ? 'Recalculate drafts' : 'Generate payroll'}
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Gross" value={inr(data?.totals?.gross)} />
        <StatCard label="Net payable" value={inr(data?.totals?.net)} tone="amber" />
        <StatCard label="Paid" value={inr(data?.totals?.paid)} tone="green" />
      </div>
      <Card padded={false}>
        <Table
          rows={data?.items}
          empty={<EmptyState title={`No payroll for ${dayjs(`${month}-01`).format('MMMM YYYY')}`}>Click “Generate payroll”. Staff without a salary are skipped.</EmptyState>}
          columns={[
            { key: 'u', label: 'Staff', render: (p) => <b>{p.userId?.name}</b> },
            { key: 'days', label: 'Days', render: (p) => `${p.daysPresent}${p.paidLeaveDays ? `+${p.paidLeaveDays}` : ''}/${p.workingDays}` },
            { key: 'base', label: 'Base', render: (p) => inr(p.basePay) },
            { key: 'pt', label: 'PT', render: (p) => (p.ptCommission ? inr(p.ptCommission) : '—') },
            { key: 'net', label: 'Net pay', render: (p) => <b>{inr(p.netPay)}</b> },
            { key: 'st', label: 'Status', render: (p) => <Badge status={STATUS[p.status]}>{p.status}{p.paidAt ? ` ${fmtDate(p.paidAt)}` : ''}</Badge> },
            {
              key: 'a',
              label: '',
              render: (p) => (
                <div className="flex gap-1">
                  {p.status === 'draft' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'edit', p })}>
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => finalize.mutate(p._id)}>
                        Finalize
                      </Button>
                    </>
                  )}
                  {p.status === 'finalized' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => reopen.mutate(p._id)}>
                        Reopen
                      </Button>
                      <Button size="sm" onClick={() => setModal({ type: 'pay', p })}>
                        Pay
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openFile(`/payroll/${p._id}/pdf`)} aria-label="Payslip PDF">
                    <FileText className="size-4" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {modal?.type === 'edit' && <EditPayslip slip={modal.p} onClose={() => setModal(null)} />}
      {modal?.type === 'pay' && <PayModal slip={modal.p} onClose={() => setModal(null)} />}
    </div>
  );
}

/** "My payslips" for any staff member (My account tab). */
export function MyPayslips() {
  const { data } = useQuery({ queryKey: ['payroll', 'mine'], queryFn: () => get('/payroll/mine') });
  if (!data?.length) return null;
  return (
    <Card title="My payslips" padded={false} className="max-w-2xl">
      <Table
        rows={data}
        columns={[
          { key: 'm', label: 'Month', render: (p) => dayjs(`${p.month}-01`).format('MMMM YYYY') },
          { key: 'n', label: 'Net pay', render: (p) => inr(p.netPay) },
          { key: 's', label: 'Status', render: (p) => <Badge status={STATUS[p.status]}>{p.status}</Badge> },
          { key: 'pdf', label: '', render: (p) => <Button size="sm" variant="ghost" onClick={() => openFile(`/payroll/mine/${p._id}/pdf`)}><FileText className="size-4" /></Button> },
        ]}
      />
    </Card>
  );
}
