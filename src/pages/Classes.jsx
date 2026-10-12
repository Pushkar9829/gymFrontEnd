import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Plus, Users, X, Check, UserX } from 'lucide-react';
import { get, post, put } from '../lib/api';
import { useApi, useAction, useBranches, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { fmtTime, ymd } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table, Tabs, Toggle } from '../components/ui';
import { MemberAvatar } from '../components/MemberAvatar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function AddBooking({ session }) {
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['class-member-search', q], queryFn: () => get('/members', { search: q, limit: 5, status: 'active' }), enabled: q.length >= 2 });
  const book = useAction((memberId) => post(`/classes/sessions/${session._id}/bookings`, { memberId }), {
    success: (d) => (d.booking.status === 'booked' ? 'Booked' : 'Class full: added to waitlist'),
    invalidate: ['classes'],
    onSuccess: () => setQ(''),
  });
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add member: name, phone or code" />
      {q.length >= 2 && (
        <ul className="mt-1 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {data?.items?.map((m) => (
            <li key={m._id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {m.name} <span className="text-slate-400">#{m.memberCode}</span>
              </span>
              <Button size="sm" loading={book.isPending} onClick={() => book.mutate(m._id)}>
                Book
              </Button>
            </li>
          ))}
          {data && !data.items.length && <li className="px-3 py-2 text-sm text-slate-500">No active member found</li>}
        </ul>
      )}
    </div>
  );
}

function SessionModal({ id, onClose }) {
  const { can, user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['classes', 'session', id], queryFn: () => get(`/classes/sessions/${id}`) });
  const cancelBooking = useAction((bid) => post(`/classes/bookings/${bid}/cancel`), { success: 'Booking cancelled', invalidate: ['classes'] });
  const mark = useAction(({ bid, status }) => post(`/classes/bookings/${bid}/attendance`, { status }), { success: (_d, v) => (v.status === 'attended' ? 'Marked present' : 'Marked as no-show'), invalidate: ['classes'] });
  const cancelClass = useAction((reason) => post(`/classes/sessions/${id}/cancel`, { reason }), { success: (d) => `Class cancelled. ${d.informed} member(s) informed.`, invalidate: ['classes'], onSuccess: onClose });
  if (isLoading) return null;
  const { session, bookings } = data;
  const isMine = String(session.trainerId?._id) === String(user._id);
  const canMark = can('classes.attendance') && (user.role !== 'trainer' || isMine) && new Date(session.startsAt) - Date.now() < 30 * 60000;
  const upcoming = new Date(session.startsAt) > new Date() && session.status === 'scheduled';
  return (
    <Modal open onClose={onClose} title={`${session.name} · ${dayjs(session.startsAt).format('ddd DD MMM, hh:mm A')}`} size="lg">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        {session.status === 'cancelled' ? <Badge status="cancelled">Cancelled{session.cancelReason ? `: ${session.cancelReason}` : ''}</Badge> : <Badge status="active">Scheduled</Badge>}
        <span>
          <Users className="mr-1 inline size-4" />
          {session.bookedCount}/{session.capacity} booked{session.waitlistCount ? ` · ${session.waitlistCount} waiting` : ''}
        </span>
        {session.trainerId && <span>· {session.trainerId.name}</span>}
        {session.room && <span>· {session.room}</span>}
      </div>
      {upcoming && can('classes.book') && (
        <div className="mb-3">
          <AddBooking session={session} />
        </div>
      )}
      {bookings.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {bookings.map((b) => (
            <li key={b._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="flex items-center gap-2">
                <MemberAvatar member={b.memberId} size="sm" />
                <span className="text-sm">
                  {b.memberId?.name} <span className="text-slate-400">#{b.memberId?.memberCode}</span>
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Badge status={{ booked: 'active', waitlisted: 'upcoming', attended: 'allow', 'no-show': 'deny' }[b.status]}>{b.status}</Badge>
                {canMark && ['booked', 'attended', 'no-show'].includes(b.status) && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => mark.mutate({ bid: b._id, status: 'attended' })} aria-label="Attended">
                      <Check className="size-4 text-emerald-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mark.mutate({ bid: b._id, status: 'no-show' })} aria-label="No-show">
                      <UserX className="size-4 text-rose-600" />
                    </Button>
                  </>
                )}
                {upcoming && can('classes.book') && ['booked', 'waitlisted'].includes(b.status) && (
                  <Button size="sm" variant="ghost" onClick={() => cancelBooking.mutate(b._id)} aria-label="Cancel booking">
                    <X className="size-4" />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Users} title="No bookings yet" />
      )}
      {upcoming && can('classes.write') && (
        <Button variant="ghost" className="mt-3 text-rose-600" onClick={() => { const r = window.prompt('Reason for cancelling this class (sent to members):'); if (r !== null) cancelClass.mutate(r); }}>
          Cancel this class
        </Button>
      )}
    </Modal>
  );
}

function Timetable() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week'));
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useApi(['classes', 'sessions'], '/classes/sessions', { from: ymd(weekStart), to: ymd(weekStart.add(6, 'day')) });
  const days = [...Array(7)].map((_, i) => weekStart.add(i, 'day'));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(weekStart.subtract(7, 'day'))} aria-label="Previous week">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {weekStart.format('DD MMM')} – {weekStart.add(6, 'day').format('DD MMM YYYY')}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(weekStart.add(7, 'day'))} aria-label="Next week">
          <ChevronRight className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setWeekStart(dayjs().startOf('week'))}>
          This week
        </Button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const list = (data || []).filter((s) => dayjs(s.startsAt).isSame(d, 'day'));
            const today = d.isSame(dayjs(), 'day');
            return (
              <div key={d.toString()} className={clsx('rounded-xl bg-white p-2 ring-1', today ? 'ring-brand-400' : 'ring-slate-200')}>
                <p className={clsx('mb-2 text-xs font-semibold uppercase', today ? 'text-brand-700' : 'text-slate-500')}>{d.format('ddd DD')}</p>
                <div className="space-y-2">
                  {list.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => setOpen(s._id)}
                      className={clsx('w-full rounded-lg border-l-4 bg-slate-50 p-2 text-left text-xs hover:bg-slate-100', s.status === 'cancelled' && 'opacity-50 line-through')}
                      style={{ borderColor: s.color || '#0f766e' }}
                    >
                      <p className="font-semibold text-slate-800">{s.name}</p>
                      <p className="text-slate-500">{fmtTime(s.startsAt)}</p>
                      <p className={clsx(s.bookedCount >= s.capacity ? 'text-rose-600' : 'text-slate-500')}>
                        {s.bookedCount}/{s.capacity}
                        {s.waitlistCount ? ` +${s.waitlistCount}` : ''}
                      </p>
                    </button>
                  ))}
                  {!list.length && <p className="text-xs text-slate-300">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {open && <SessionModal id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ScheduleForm({ schedule, onClose }) {
  const { data: types } = useQuery({ queryKey: ['classes', 'types'], queryFn: () => get('/classes/types') });
  const { data: trainers } = useQuery({ queryKey: ['trainers'], queryFn: () => get('/users/trainers') });
  const { data: branches } = useBranches();
  const defaultBranch = useDefaultBranchId();
  const [f, setF] = useState(
    schedule
      ? { ...schedule, branchId: schedule.branchId, classTypeId: schedule.classTypeId?._id || schedule.classTypeId, trainerId: schedule.trainerId?._id || '' }
      : { branchId: defaultBranch, classTypeId: '', trainerId: '', weekdays: [1, 3, 5], startTime: '07:00', durationMin: 60, capacity: 20, room: '', isActive: true },
  );
  const save = useAction((b) => (schedule ? put(`/classes/schedules/${schedule._id}`, b) : post('/classes/schedules', b)), { success: 'Schedule saved', invalidate: ['classes'], onSuccess: onClose });
  const toggleDay = (d) => setF({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() });
  const pickType = (id) => {
    const t = types?.find((x) => x._id === id);
    setF({ ...f, classTypeId: id, ...(t && !schedule ? { durationMin: t.durationMin, capacity: t.defaultCapacity } : {}) });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={schedule ? 'Edit schedule' : 'New weekly class'}
      footer={
        <Button
          loading={save.isPending}
          disabled={!f.classTypeId || !f.weekdays.length}
          onClick={() =>
            save.mutate({
              branchId: f.branchId,
              classTypeId: f.classTypeId,
              trainerId: f.trainerId || null,
              weekdays: f.weekdays,
              startTime: f.startTime,
              durationMin: Number(f.durationMin),
              capacity: Number(f.capacity),
              room: f.room || undefined,
              isActive: f.isActive,
            })
          }
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class">
          <Select value={f.classTypeId} onChange={(e) => pickType(e.target.value)}>
            <option value="">Choose…</option>
            {types?.filter((t) => t.isActive).map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Trainer">
          <Select value={f.trainerId} onChange={(e) => setF({ ...f, trainerId: e.target.value })}>
            <option value="">—</option>
            {trainers?.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium text-slate-700">Days</p>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggleDay(i)} className={clsx('rounded-lg px-3 py-1.5 text-sm ring-1', f.weekdays.includes(i) ? 'bg-brand-700 text-white ring-brand-700' : 'ring-slate-300')}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <Field label="Start time">
          <Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
        </Field>
        <Field label="Duration (min)">
          <Input type="number" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} />
        </Field>
        <Field label="Capacity">
          <Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
        </Field>
        <Field label="Room / area">
          <Input value={f.room || ''} onChange={(e) => setF({ ...f, room: e.target.value })} />
        </Field>
        {branches?.length > 1 && (
          <Field label="Branch">
            <Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {schedule && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />}
      </div>
    </Modal>
  );
}

function Schedules() {
  const can = useAuth((s) => s.can);
  const [edit, setEdit] = useState(null);
  const { data } = useApi(['classes', 'schedules'], '/classes/schedules');
  return (
    <Card padded={false} title="Weekly schedule" actions={can('classes.write') && <Button size="sm" onClick={() => setEdit('new')}><Plus className="size-4" /> New weekly class</Button>}>
      <Table
        rows={data}
        empty={<EmptyState title="No classes scheduled">Set up a repeating class, e.g. Yoga every Mon / Wed / Fri at 7 AM.<div>{can('classes.write') && (<Button size="sm" className="mt-3" onClick={() => setEdit('new')}><Plus className="size-4" /> New weekly class</Button>)}</div></EmptyState>}
        columns={[
          { key: 'c', label: 'Class', render: (s) => <b>{s.classTypeId?.name}</b> },
          { key: 'd', label: 'Days', render: (s) => s.weekdays.map((d) => WEEKDAYS[d]).join(', ') },
          { key: 't', label: 'Time', render: (s) => `${s.startTime} · ${s.durationMin} min` },
          { key: 'tr', label: 'Trainer', render: (s) => s.trainerId?.name || '—' },
          { key: 'cap', label: 'Capacity', render: (s) => s.capacity },
          { key: 'st', label: 'Status', render: (s) => <Badge status={s.isActive ? 'active' : 'cancelled'}>{s.isActive ? 'Active' : 'Off'}</Badge> },
          { key: 'e', label: '', render: (s) => can('classes.write') && <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button> },
        ]}
      />
      {edit && <ScheduleForm schedule={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function Types() {
  const can = useAuth((s) => s.can);
  const { data } = useQuery({ queryKey: ['classes', 'types'], queryFn: () => get('/classes/types') });
  const [f, setF] = useState({ name: '', color: '#0f766e', durationMin: 60, defaultCapacity: 20 });
  const add = useAction((b) => post('/classes/types', b), { success: 'Class type added', invalidate: ['classes'], onSuccess: () => setF({ ...f, name: '' }) });
  return (
    <Card title="Class types">
      {can('classes.write') && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Zumba" />
          </Field>
          <Field label="Colour">
            <Input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-16 p-1" />
          </Field>
          <Field label="Minutes">
            <Input type="number" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} className="w-24" />
          </Field>
          <Field label="Capacity">
            <Input type="number" value={f.defaultCapacity} onChange={(e) => setF({ ...f, defaultCapacity: e.target.value })} className="w-24" />
          </Field>
          <Button disabled={f.name.trim().length < 2} loading={add.isPending} onClick={() => add.mutate({ ...f, durationMin: Number(f.durationMin), defaultCapacity: Number(f.defaultCapacity) })}>
            Add
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {data?.map((t) => (
          <span key={t._id} className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ring-slate-200">
            <span className="size-3 rounded-full" style={{ background: t.color }} />
            {t.name} · {t.durationMin}m · {t.defaultCapacity}
          </span>
        ))}
        {!data?.length && <p className="text-sm text-slate-500">Add Yoga, Zumba, HIIT… first.</p>}
      </div>
    </Card>
  );
}

export default function Classes() {
  const [tab, setTab] = useState('timetable');
  return (
    <div>
      <PageHeader title="Classes" subtitle="Members book from the app; only members with a valid membership on the class day can book." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'timetable', label: 'Timetable' },
          { value: 'schedules', label: 'Weekly schedule' },
          { value: 'types', label: 'Class types' },
        ]}
      />
      {tab === 'timetable' && <Timetable />}
      {tab === 'schedules' && <Schedules />}
      {tab === 'types' && <Types />}
    </div>
  );
}
