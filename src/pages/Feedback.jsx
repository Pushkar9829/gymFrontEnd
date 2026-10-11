import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus, Star, MessageSquareWarning, Lightbulb, ThumbsUp } from 'lucide-react';
import { get, post, patch } from '../lib/api';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { fmtDateTime, fromNow } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, Table, Tabs, Textarea } from '../components/ui';
import MemberPicker from '../components/MemberPicker';

export const TYPE_TEXT = { complaint: 'Complaint', suggestion: 'Suggestion', praise: 'Praise' };
export const TYPE_ICON = { complaint: MessageSquareWarning, suggestion: Lightbulb, praise: ThumbsUp };
export const CATEGORY_TEXT = { equipment: 'Equipment', cleanliness: 'Cleanliness', staff: 'Staff', trainer: 'Trainer', classes: 'Classes', billing: 'Billing', timings: 'Timings', other: 'Other' };
export const FB_STATUS_TEXT = { open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved', closed: 'Closed' };
export const FB_STATUS_BADGE = { open: 'deny', 'in-progress': 'contacted', resolved: 'allow', closed: 'cancelled' };
const TYPE_BADGE = { complaint: 'expired', suggestion: 'upcoming', praise: 'active' };

export function Stars({ value, onChange, size = 'size-5' }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
            <Star className={clsx(size, n <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
          </button>
        ) : (
          <Star key={n} className={clsx(size, n <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        ),
      )}
    </span>
  );
}

export function Thread({ ticket }) {
  return (
    <ul className="space-y-2">
      <li className="rounded-lg bg-slate-50 p-3 text-sm">
        <p className="whitespace-pre-wrap text-slate-800">{ticket.message}</p>
        <p className="mt-1 text-xs text-slate-400">{fmtDateTime(ticket.createdAt)}</p>
      </li>
      {ticket.replies.map((r, i) => (
        <li key={i} className={clsx('rounded-lg p-3 text-sm', r.from === 'staff' ? 'ml-6 bg-brand-50' : 'mr-6 bg-slate-50')}>
          <p className="whitespace-pre-wrap text-slate-800">{r.text}</p>
          <p className="mt-1 text-xs text-slate-400">
            {r.from === 'staff' ? r.name || 'Gym' : 'Member'} · {fmtDateTime(r.at)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function TicketModal({ id, onClose }) {
  const can = useAuth((s) => s.can);
  const { data: fb } = useQuery({ queryKey: ['feedback', 'one', id], queryFn: () => get(`/feedback/${id}`) });
  const { data: staff } = useQuery({ queryKey: ['users'], queryFn: () => get('/users'), enabled: can('users.read') });
  const [text, setText] = useState('');
  const reply = useAction(() => post(`/feedback/${id}/replies`, { text }), { success: 'Reply sent to the member', invalidate: ['feedback'], onSuccess: () => setText('') });
  const update = useAction((b) => patch(`/feedback/${id}`, b), { success: 'Ticket updated', invalidate: ['feedback', 'dashboard'] });
  if (!fb) return null;
  const editable = can('feedback.write') && fb.status !== 'closed';
  return (
    <Modal open onClose={onClose} title={`${fb.ticketNo} · ${fb.subject}`} size="lg">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge status={TYPE_BADGE[fb.type]}>{TYPE_TEXT[fb.type]}</Badge>
        <Badge status={FB_STATUS_BADGE[fb.status]}>{FB_STATUS_TEXT[fb.status]}</Badge>
        {fb.priority === 'high' && <Badge status="deny">High priority</Badge>}
        <span className="text-slate-500">{CATEGORY_TEXT[fb.category]}</span>
        <span className="text-slate-400">·</span>
        <Link to={`/admin/members/${fb.memberId?._id}`} className="font-medium text-brand-700 hover:underline">
          {fb.memberId?.name} #{fb.memberId?.memberCode}
        </Link>
        <span className="text-slate-400">· {fb.source === 'desk' ? `logged at desk by ${fb.createdBy?.name || 'staff'}` : 'from the member app'}</span>
      </div>
      {(fb.rating || fb.memberRating) && (
        <p className="mb-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          {fb.rating && (
            <span className="flex items-center gap-1">
              Experience <Stars value={fb.rating} size="size-4" />
            </span>
          )}
          {fb.memberRating && (
            <span className="flex items-center gap-1">
              Handling <Stars value={fb.memberRating} size="size-4" />
            </span>
          )}
        </p>
      )}
      <Thread ticket={fb} />
      {editable && (
        <div className="mt-4 space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the member (they get a message if SMS / WhatsApp is on)" aria-label="Reply" />
          <div className="flex justify-end">
            <Button loading={reply.isPending} disabled={!text.trim()} onClick={() => reply.mutate()}>
              Send reply
            </Button>
          </div>
        </div>
      )}
      {can('feedback.write') && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <Field label="Status">
            <Select value={fb.status} onChange={(e) => update.mutate({ status: e.target.value })}>
              {Object.entries(FB_STATUS_TEXT).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={fb.priority} onChange={(e) => update.mutate({ priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </Field>
          {staff && (
            <Field label="Assigned to">
              <Select value={fb.assignedTo?._id || ''} onChange={(e) => update.mutate({ assignedTo: e.target.value || null })}>
                <option value="">Nobody</option>
                {staff
                  .filter((u) => u.isActive)
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}

function NewTicket({ onClose }) {
  const [member, setMember] = useState(null);
  const [f, setF] = useState({ type: 'complaint', category: 'other', subject: '', message: '', priority: 'normal' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction(() => post('/feedback', { ...f, memberId: member._id }), { success: (d) => `Ticket ${d.ticketNo} created`, invalidate: ['feedback', 'dashboard'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="Log feedback for a member"
      footer={
        <Button loading={save.isPending} disabled={!member || f.subject.trim().length < 3 || f.message.trim().length < 3} onClick={() => save.mutate()}>
          Create ticket
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Member" className="sm:col-span-2">
          <MemberPicker value={member} onChange={setMember} autoFocus />
        </Field>
        <Field label="Type">
          <Select value={f.type} onChange={set('type')}>
            {Object.entries(TYPE_TEXT).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="About">
          <Select value={f.category} onChange={set('category')}>
            {Object.entries(CATEGORY_TEXT).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject" className="sm:col-span-2">
          <Input value={f.subject} onChange={set('subject')} placeholder="e.g. AC not working in cardio area" maxLength={100} />
        </Field>
        <Field label="Details" className="sm:col-span-2">
          <Textarea value={f.message} onChange={set('message')} />
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onChange={set('priority')}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export default function Feedback() {
  const can = useAuth((s) => s.can);
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const { data } = useApi(['feedback', status, type, search, page], '/feedback', { status: status === 'all' ? '' : status, type, search, page });
  const c = data?.counts || {};
  return (
    <div>
      <PageHeader
        title="Complaints & feedback"
        subtitle={data?.satisfaction ? `Members rate how complaints are handled: ${data.satisfaction.average} / 5 from ${data.satisfaction.ratings} rating(s)` : 'From the member app and the front desk'}
        actions={can('feedback.write') && <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Log feedback</Button>}
      />
      <Tabs
        value={status}
        onChange={(v) => (setPage(1), setStatus(v))}
        tabs={[
          { value: 'open', label: 'Open', count: c.open || 0 },
          { value: 'in-progress', label: 'In progress', count: c['in-progress'] || 0 },
          { value: 'resolved', label: 'Resolved', count: c.resolved || 0 },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Card padded={false} className="mt-3">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <Select value={type} onChange={(e) => (setPage(1), setType(e.target.value))} className="w-auto" aria-label="Type">
            <option value="">All types</option>
            {Object.entries(TYPE_TEXT).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
          <Input value={search} onChange={(e) => (setPage(1), setSearch(e.target.value))} placeholder="Search ticket no. or subject" className="w-auto min-w-56 flex-1 sm:flex-none" />
        </div>
        <Table
          rows={data?.items}
          onRowClick={(r) => setOpenId(r._id)}
          empty={<EmptyState title={status === 'open' ? 'No open tickets. All caught up!' : 'Nothing here'} />}
          columns={[
            {
              key: 't',
              label: 'Ticket',
              render: (r) => {
                const Icon = TYPE_ICON[r.type];
                return (
                  <span className="flex items-center gap-2">
                    <Icon className={clsx('size-4', r.type === 'complaint' ? 'text-rose-500' : r.type === 'praise' ? 'text-emerald-500' : 'text-sky-500')} />
                    <span>
                      <b className="block max-w-72 truncate">{r.subject}</b>
                      <span className="text-xs text-slate-500">
                        {r.ticketNo} · {TYPE_TEXT[r.type]} · {CATEGORY_TEXT[r.category]}
                      </span>
                    </span>
                  </span>
                );
              },
            },
            { key: 'm', label: 'Member', render: (r) => `${r.memberId?.name || '—'}` },
            { key: 'p', label: 'Priority', className: 'hidden sm:table-cell', render: (r) => (r.priority === 'high' ? <Badge status="deny">High</Badge> : <span className="text-slate-400">Normal</span>) },
            { key: 's', label: 'Status', render: (r) => <Badge status={FB_STATUS_BADGE[r.status]}>{FB_STATUS_TEXT[r.status]}</Badge> },
            { key: 'a', label: 'Assigned', className: 'hidden md:table-cell', render: (r) => r.assignedTo?.name || '—' },
            { key: 'u', label: 'Updated', className: 'hidden md:table-cell', render: (r) => fromNow(r.lastActivityAt) },
          ]}
        />
        {data && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </Card>
      {openId && <TicketModal id={openId} onClose={() => setOpenId(null)} />}
      {adding && <NewTicket onClose={() => setAdding(false)} />}
    </div>
  );
}
