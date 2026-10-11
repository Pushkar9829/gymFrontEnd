import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Building2, Download } from 'lucide-react';
import { get, post, put, openFile } from '../lib/api';
import { useAction } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, fmtDate } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, StatCard, Table, Toggle } from '../components/ui';

function CompanyForm({ company, onClose }) {
  const [f, setF] = useState(company || { name: '', gstin: '', contactName: '', phone: '', email: '', address: '', discountPercent: 10, billTo: 'member', isActive: true });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (company ? put(`/companies/${company._id}`, b) : post('/companies', b)), { success: 'Company saved', invalidate: ['companies'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={company ? 'Edit company' : 'New corporate tie-up'}
      footer={
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({ name: f.name, gstin: f.gstin || '', contactName: f.contactName || undefined, phone: f.phone || undefined, email: f.email || '', address: f.address || undefined, discountPercent: Number(f.discountPercent) || 0, billTo: f.billTo, isActive: f.isActive })
          }
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name" className="sm:col-span-2">
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Employee discount %">
          <Input type="number" min="0" max="100" value={f.discountPercent} onChange={set('discountPercent')} />
        </Field>
        <Field label="Invoice to" hint="Company: invoices in the company's name for its GST credit">
          <Select value={f.billTo} onChange={set('billTo')}>
            <option value="member">Employee pays</option>
            <option value="company">Company pays</option>
          </Select>
        </Field>
        <Field label="GSTIN">
          <Input value={f.gstin || ''} onChange={set('gstin')} className="uppercase" />
        </Field>
        <Field label="Contact person">
          <Input value={f.contactName || ''} onChange={set('contactName')} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Email">
          <Input value={f.email || ''} onChange={set('email')} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={f.address || ''} onChange={set('address')} />
        </Field>
        {company && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />}
      </div>
    </Modal>
  );
}

function Statement({ company, onClose }) {
  const { data } = useQuery({ queryKey: ['companies', company._id, 'statement'], queryFn: () => get(`/companies/${company._id}/statement`) });
  return (
    <Modal open onClose={onClose} title={`${company.name} · statement`} size="xl">
      <div className="mb-3 grid grid-cols-3 gap-3">
        <StatCard label="Billed to company" value={inr(data?.totals?.billed)} />
        <StatCard label="Paid" value={inr(data?.totals?.paid)} tone="green" />
        <StatCard label="Due" value={inr(data?.totals?.due)} tone="red" />
      </div>
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => openFile(`/companies/${company._id}/statement?export=xlsx`, { download: `${company.name}-statement.xlsx` })}>
          <Download className="size-4" /> Excel
        </Button>
      </div>
      <Table
        rows={data?.subscriptions}
        empty={<EmptyState title="No active memberships" />}
        columns={[
          { key: 'm', label: 'Employee', render: (s) => `${s.memberId?.name} (#${s.memberId?.memberCode})` },
          { key: 'p', label: 'Plan', render: (s) => s.plan?.name },
          { key: 'd', label: 'Period', render: (s) => `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}` },
          { key: 'b', label: 'Billed to', render: (s) => s.billTo },
          { key: 't', label: 'Total', render: (s) => inr(s.totalAmount) },
          { key: 'due', label: 'Due', render: (s) => (s.dueAmount ? <span className="text-rose-600">{inr(s.dueAmount)}</span> : '—') },
        ]}
      />
    </Modal>
  );
}

export default function Companies() {
  const can = useAuth((s) => s.can);
  const [modal, setModal] = useState(null);
  const { data } = useQuery({ queryKey: ['companies'], queryFn: () => get('/companies') });
  return (
    <Card
      title="Corporate tie-ups"
      padded={false}
      actions={can('plans.write') && <Button size="sm" onClick={() => setModal({ type: 'edit' })}><Plus className="size-4" /> Company</Button>}
    >
      <Table
        rows={data}
        empty={<EmptyState icon={Building2} title="No companies yet">Link members to a company to apply its discount automatically.<div>{can('plans.write') && (<Button size="sm" className="mt-3" onClick={() => setModal({ type: 'edit' })}><Plus className="size-4" /> Add company</Button>)}</div></EmptyState>}
        columns={[
          { key: 'n', label: 'Company', render: (c) => <b>{c.name}</b> },
          { key: 'd', label: 'Discount', render: (c) => `${c.discountPercent}%` },
          { key: 'b', label: 'Pays', render: (c) => (c.billTo === 'company' ? 'Company' : 'Employee') },
          { key: 'm', label: 'Members', render: (c) => c.members },
          { key: 's', label: '', render: (c) => !c.isActive && <Badge status="cancelled">Inactive</Badge> },
          {
            key: 'a',
            label: '',
            render: (c) => (
              <div className="flex gap-1">
                {can('payments.read') && (
                  <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'statement', c })}>
                    Statement
                  </Button>
                )}
                {can('plans.write') && (
                  <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'edit', c })} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      {modal?.type === 'edit' && <CompanyForm company={modal.c} onClose={() => setModal(null)} />}
      {modal?.type === 'statement' && <Statement company={modal.c} onClose={() => setModal(null)} />}
    </Card>
  );
}
