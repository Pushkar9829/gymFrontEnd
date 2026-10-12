import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus, Check, CheckCheck, Pencil, Trash2, RotateCcw, AlertTriangle, ClipboardList } from 'lucide-react';
import { get, post, put, del } from '../lib/api';
import { useApi, useAction, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { fmtDate, fmtDateTime, fromNow, daysUntil } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Tabs, Textarea, Toggle } from '../components/ui';

const INVALIDATE = ['handover', 'dashboard', 'notifications'];

/** Post or edit a note / task. */
export function NoteForm({ note, onClose }) {
  const defaultBranch = useDefaultBranchId();
  const branchId = note?.branchId || defaultBranch;
  const [f, setF] = useState({
    text: note?.text || '',
    isTask: note?.isTask || false,
    dueDate: note?.dueDate ? new Date(note.dueDate).toISOString().slice(0, 10) : '',
    assignedTo: note?.assignedTo?._id || note?.assignedTo || '',
    important: note?.important || false,
  });
  const { data: staff } = useQuery({ queryKey: ['handover', 'staff', branchId], queryFn: () => get('/handover/staff', { branchId }), enabled: Boolean(branchId) });
  const save = useAction(
    (b) => (note ? put(`/handover/${note._id}`, b) : post('/handover', { ...b, branchId })),
    { success: note ? 'Note updated' : f.isTask ? 'Task posted' : 'Note posted', invalidate: INVALIDATE, onSuccess: onClose },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={note ? 'Edit note' : 'Post a handover note'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={f.text.trim().length < 2}
            loading={save.isPending}
            onClick={() => save.mutate({ text: f.text.trim(), isTask: f.isTask, important: f.important, dueDate: f.isTask && f.dueDate ? f.dueDate : null, assignedTo: f.isTask && f.assignedTo ? f.assignedTo : null })}
          >
            {note ? 'Save' : 'Post'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Note">
          <Textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="e.g. AC in the cardio room is leaking, technician comes at 4 pm" autoFocus />
        </Field>
        <div className="flex flex-wrap gap-4">
          <Toggle checked={f.isTask} onChange={(v) => setF({ ...f, isTask: v })} label="This is a task" />
          <Toggle checked={f.important} onChange={(v) => setF({ ...f, important: v })} label="Important" />
        </div>
        {f.isTask && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Assign to" hint="Optional. They get an alert.">
              <Select value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })}>
                <option value="">Anyone on the desk</option>
                {staff?.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date" hint="Optional">
              <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** One note / task with its actions. compact = dashboard card. */
export function HandoverItem({ note, compact }) {
  const { can, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = useAction(() => post(`/handover/${note._id}/done`), { success: 'Task done', invalidate: INVALIDATE });
  const reopen = useAction(() => post(`/handover/${note._id}/reopen`), { success: 'Task reopened', invalidate: INVALIDATE });
  const ack = useAction(() => post(`/handover/${note._id}/ack`), { success: 'Marked as read', invalidate: INVALIDATE });
  const remove = useAction(() => del(`/handover/${note._id}`), { success: 'Note deleted', invalidate: INVALIDATE, onSuccess: () => setConfirmDelete(false) });
  const forMe = note.assignedTo && String(note.assignedTo._id || note.assignedTo) === String(user._id);
  const canDone = note.isTask && !note.doneAt && (can('handover.write') || forMe);
  const overdue = note.isTask && !note.doneAt && note.dueDate && daysUntil(note.dueDate) < 0;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm whitespace-pre-wrap break-words text-slate-800', note.doneAt && 'text-slate-500 line-through')}>
          {note.important && <AlertTriangle className="mr-1 inline size-4 text-amber-500" />}
          {note.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {note.isTask ? <Badge status={note.doneAt ? 'allow' : 'contacted'}>{note.doneAt ? 'Done' : 'Task'}</Badge> : <Badge status="upcoming">Note</Badge>}
          {note.important && <Badge status="deny">Important</Badge>}
          {note.assignedTo && <span className={forMe ? 'font-semibold text-brand-700' : ''}>For {forMe ? 'you' : note.assignedTo.name}</span>}
          {note.dueDate && <span className={overdue ? 'font-semibold text-rose-600' : ''}>· due {fmtDate(note.dueDate)}</span>}
          <span>
            · {note.createdBy?.name} · {compact ? fromNow(note.createdAt) : fmtDateTime(note.createdAt)}
            {note.editedAt ? ' (edited)' : ''}
          </span>
        </div>
        {!compact && note.doneAt && (
          <p className="mt-0.5 text-xs text-emerald-700">
            Done by {note.doneBy?.name} · {fmtDateTime(note.doneAt)}
          </p>
        )}
        {!compact && note.acks?.length > 0 && <p className="mt-0.5 text-xs text-slate-400">Read by {note.acks.map((a) => a.userId?.name).filter(Boolean).join(', ')}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1">
        {canDone && (
          <Button size="sm" variant="success" loading={done.isPending} onClick={() => done.mutate()}>
            <Check className="size-3.5" /> Mark done
          </Button>
        )}
        {!compact && note.doneAt && can('handover.write') && (
          <Button size="sm" variant="ghost" loading={reopen.isPending} onClick={() => reopen.mutate()}>
            <RotateCcw className="size-3.5" /> Reopen
          </Button>
        )}
        {!note.isTask && !note.acked && String(note.createdBy?._id) !== String(user._id) && (
          <Button size="sm" variant="secondary" loading={ack.isPending} onClick={() => ack.mutate()}>
            <CheckCheck className="size-3.5" /> Got it
          </Button>
        )}
        {!compact && note.canEdit && can('handover.write') && (
          <Button size="sm" variant="ghost" aria-label="Edit note" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
          </Button>
        )}
        {!compact && note.canDelete && (
          <Button size="sm" variant="ghost" className="text-rose-600" aria-label="Delete note" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      {editing && <NoteForm note={note} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(false)}
          title="Delete this note?"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">It disappears from the board for everyone.</p>
        </Modal>
      )}
    </li>
  );
}

/** Dashboard card: open tasks and unread notes from the last 24 hours. */
export function HandoverCard() {
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const [posting, setPosting] = useState(false);
  const { data } = useApi(['handover', 'board'], '/handover/board', {}, { refetchInterval: 60000 });
  if (!data) return null;
  const items = [...data.tasks, ...data.notes];
  return (
    <section aria-label="Handover">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ClipboardList className="size-4" /> Handover{data.openTasks ? ` · ${data.openTasks} open task(s)` : ''}
          </span>
        }
        className="mb-4"
        padded={false}
        actions={
          <>
            {can('handover.write') && (
              <Button size="sm" variant="secondary" onClick={() => setPosting(true)}>
                <Plus className="size-3.5" /> Post
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigate('/admin/handover')}>
              Board
            </Button>
          </>
        }
      >
        {items.length ? (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <HandoverItem key={n._id} note={n} compact />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-500">Nothing pending from the last shift.</p>
        )}
        {posting && <NoteForm onClose={() => setPosting(false)} />}
      </Card>
    </section>
  );
}

export default function Handover() {
  const can = useAuth((s) => s.can);
  const [tab, setTab] = useState('open');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [posting, setPosting] = useState(false);
  const { data, isLoading } = useApi('handover', '/handover', { status: tab, date, page });

  return (
    <div>
      <PageHeader
        title="Shift handover"
        subtitle="Notes and tasks for the next shift. Your own notes can be changed for 15 minutes."
        actions={
          can('handover.write') && (
            <Button onClick={() => setPosting(true)}>
              <Plus className="size-4" /> Post note
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => (setPage(1), setTab(v))}
        tabs={[
          { value: 'open', label: 'Open tasks' },
          { value: 'done', label: 'Done' },
          { value: 'notes', label: 'Notes' },
          { value: 'all', label: 'All' },
        ]}
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <span className="text-sm text-slate-600">Posted on</span>
          <div className="w-44">
            <Input type="date" value={date} onChange={(e) => (setPage(1), setDate(e.target.value))} aria-label="Posted on" />
          </div>
          {date && (
            <Button size="sm" variant="ghost" onClick={() => setDate('')}>
              Any day
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : data?.items?.length ? (
          <>
            <ul className="divide-y divide-slate-100">
              {data.items.map((n) => (
                <HandoverItem key={n._id} note={n} />
              ))}
            </ul>
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState title={tab === 'open' ? 'No open tasks' : 'Nothing here'} icon={ClipboardList}>
            {can('handover.write') && (
              <Button size="sm" className="mt-3" onClick={() => setPosting(true)}>
                <Plus className="size-4" /> Post note
              </Button>
            )}
          </EmptyState>
        )}
      </Card>
      {posting && <NoteForm onClose={() => setPosting(false)} />}
    </div>
  );
}
