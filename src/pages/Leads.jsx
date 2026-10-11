import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Phone, MessageSquare, UserCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { get, post, put } from '../lib/api';
import { useApi, useAction, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { fmtDate, fmtDateTime, ymd } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Table, Tabs, Textarea } from '../components/ui';

const SOURCES = ['walk-in', 'phone', 'website', 'instagram', 'facebook', 'referral', 'other'];

function LeadForm({ onClose }) {
  const branchId = useDefaultBranchId();
  const [f, setF] = useState({ name: '', phone: '', email: '', source: 'walk-in', notes: '', nextFollowUpAt: ymd() });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => post('/leads', b), { success: 'Lead added', invalidate: ['leads', 'dashboard'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="New enquiry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate({ ...f, branchId, nextFollowUpAt: f.nextFollowUpAt || null })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={f.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Phone" required>
          <Input value={f.phone} onChange={set('phone')} inputMode="tel" />
        </Field>
        <Field label="Email">
          <Input value={f.email} onChange={set('email')} type="email" />
        </Field>
        <Field label="Source">
          <Select value={f.source} onChange={set('source')}>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Next follow-up">
          <Input type="date" value={f.nextFollowUpAt} onChange={set('nextFollowUpAt')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={set('notes')} placeholder="Interested in quarterly plan, evening batch…" />
        </Field>
      </div>
    </Modal>
  );
}

function LeadDrawer({ id, onClose }) {
  const navigate = useNavigate();
  const { data: lead } = useQuery({ queryKey: ['leads', id], queryFn: () => get(`/leads/${id}`) });
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState('');
  const follow = useAction((b) => post(`/leads/${id}/follow-ups`, b), {
    success: 'Follow-up saved',
    invalidate: ['leads', 'dashboard'],
    onSuccess: () => (setNote(''), setNext(''), setStatus('')),
  });
  const convert = useAction(() => post(`/leads/${id}/convert`), {
    success: 'Converted to member. Add a membership now.',
    invalidate: ['leads', 'members'],
    onSuccess: (d) => navigate(`/admin/members/${d.member._id}`),
  });
  const markLost = useAction((reason) => put(`/leads/${id}`, { status: 'lost', lostReason: reason, nextFollowUpAt: null }), { success: 'Marked as lost', invalidate: ['leads'], onSuccess: onClose });

  return (
    <Modal open onClose={onClose} title={lead ? lead.name : 'Lead'} size="lg">
      {!lead ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge status={lead.status} />
            <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <Phone className="size-4" /> {lead.phone}
            </a>
            <a href={`https://wa.me/91${lead.phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
              <MessageSquare className="size-4" /> WhatsApp
            </a>
            <span className="text-slate-500">· {lead.source} · added {fmtDate(lead.createdAt)}</span>
          </div>
          {lead.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm">{lead.notes}</p>}

          {lead.status !== 'converted' && lead.status !== 'lost' && (
            <div className="space-y-3 rounded-xl p-3 ring-1 ring-slate-200">
              <Field label="Follow-up note">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called — will visit on Saturday" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Next follow-up">
                  <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} />
                </Field>
                <Field label="Status">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Keep ({lead.status})</option>
                    <option value="contacted">Contacted</option>
                    <option value="trial">On trial</option>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!note.trim()} loading={follow.isPending} onClick={() => follow.mutate({ note, nextFollowUpAt: next || null, ...(status && { status }) })}>
                  Save follow-up
                </Button>
                <Button size="sm" variant="success" loading={convert.isPending} onClick={() => convert.mutate()}>
                  <UserCheck className="size-4" /> Convert to member
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { const r = window.prompt('Why was this lead lost?'); if (r !== null) markLost.mutate(r.trim() || 'Not interested'); }}>
                  Mark lost
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold">History</p>
            <ul className="space-y-2">
              {[...lead.followUps].reverse().map((f) => (
                <li key={f._id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                  <p>{f.note}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDateTime(f.at)} · {f.by?.name}
                  </p>
                </li>
              ))}
              {!lead.followUps.length && <li className="text-sm text-slate-500">No follow-ups yet</li>}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Leads() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('followUpDue') === 'true' ? 'due' : params.get('status') || 'open';
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const can = useAuth((s) => s.can);

  const q = tab === 'due' ? { followUpDue: 'true' } : tab === 'open' ? {} : { status: tab };
  const { data, isLoading } = useApi('leads', '/leads', { ...q, page });
  const c = data?.counts || {};

  return (
    <div>
      <PageHeader
        title="Leads & enquiries"
        actions={
          can('leads.write') && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New enquiry
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => (setPage(1), setParams(v === 'due' ? { followUpDue: 'true' } : v === 'open' ? {} : { status: v }))}
        tabs={[
          { value: 'open', label: 'All' },
          { value: 'due', label: 'Follow-ups due' },
          { value: 'new', label: 'New', count: c.new },
          { value: 'contacted', label: 'Contacted', count: c.contacted },
          { value: 'trial', label: 'Trial', count: c.trial },
          { value: 'converted', label: 'Converted', count: c.converted },
          { value: 'lost', label: 'Lost', count: c.lost },
        ]}
      />
      <Card padded={false}>
        {isLoading ? (
          <div className="p-6">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              rows={data?.items}
              onRowClick={(l) => setOpenId(l._id)}
              empty={<EmptyState title="No leads here" />}
              columns={[
                { key: 'name', label: 'Name', render: (l) => <span className="font-medium text-slate-900">{l.name}</span> },
                { key: 'phone', label: 'Phone' },
                { key: 'source', label: 'Source' },
                { key: 'status', label: 'Status', render: (l) => <Badge status={l.status} /> },
                {
                  key: 'next',
                  label: 'Next follow-up',
                  render: (l) =>
                    l.nextFollowUpAt ? <span className={new Date(l.nextFollowUpAt) < new Date() ? 'font-medium text-rose-600' : ''}>{fmtDate(l.nextFollowUpAt)}</span> : '—',
                },
                { key: 'by', label: 'Assigned', className: 'hidden md:table-cell', render: (l) => l.assignedTo?.name || '—' },
              ]}
            />
            <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
          </>
        )}
      </Card>
      {creating && <LeadForm onClose={() => setCreating(false)} />}
      {openId && <LeadDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
