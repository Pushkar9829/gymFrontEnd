import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, CheckCircle2, UserX, XCircle, Plus, Trash2, CalendarPlus, Copy } from 'lucide-react';
import { get, post, put } from '../../lib/api';
import { useAction, useApi, useBranches } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDate, fmtDateTime, fmtTime, ymd } from '../../lib/format';
import MemberPicker from '../../components/MemberPicker';
import SlotPicker, { BookingBadge } from '../../components/SlotPicker';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Textarea } from '../../components/ui';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function useTrainers() {
  return useQuery({ queryKey: ['trainers'], queryFn: () => get('/users/trainers') });
}

/** Staff books a slot for a member on their active PT package. */
export function BookSlotModal({ member: fixedMember, purchase: fixedPurchase, onClose }) {
  const [member, setMember] = useState(fixedMember || null);
  const [purchaseId, setPurchaseId] = useState(fixedPurchase?._id || '');
  const [slot, setSlot] = useState('');
  const { data: purchases } = useQuery({
    queryKey: ['pt', 'purchases', 'active', member?._id],
    queryFn: () => get('/pt/purchases', { memberId: member._id, state: 'active', limit: 20 }),
    enabled: Boolean(member && !fixedPurchase),
  });
  const list = fixedPurchase ? [fixedPurchase] : purchases?.items || [];
  const purchase = list.find((p) => p._id === purchaseId) || (list.length === 1 ? list[0] : null);
  const trainerId = purchase?.trainerId?._id || purchase?.trainerId;
  const { data: slots, isLoading } = useQuery({
    queryKey: ['pt', 'slots', trainerId, purchase?.branchId],
    queryFn: () => get('/pt/slots', { trainerId, branchId: purchase.branchId, from: ymd(), days: 14 }),
    enabled: Boolean(trainerId),
  });
  const book = useAction(() => post('/pt/bookings', { purchaseId: purchase._id, startsAt: slot }), {
    success: (b) => `Booked ${b.memberId?.name} on ${fmtDateTime(b.startsAt)}`,
    invalidate: ['pt'],
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Book a PT session"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!purchase || !slot} loading={book.isPending} onClick={() => book.mutate()}>
            Book
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedMember && (
          <Field label="Member">
            <MemberPicker value={member} onChange={(m) => (setMember(m), setPurchaseId(''), setSlot(''))} autoFocus />
          </Field>
        )}
        {member && !fixedPurchase && purchases && !list.length && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">No active PT package. Sell one from the member's page first.</p>}
        {list.length > 1 && (
          <Field label="PT package">
            <Select value={purchaseId} onChange={(e) => (setPurchaseId(e.target.value), setSlot(''))}>
              <option value="">Choose…</option>
              {list.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.package?.name} with {p.trainerId?.name} ({p.sessionsTotal - p.sessionsUsed} left)
                </option>
              ))}
            </Select>
          </Field>
        )}
        {purchase && (
          <div>
            <p className="mb-2 text-sm text-slate-600">
              {purchase.package?.name} with <b>{purchase.trainerId?.name}</b> · {purchase.sessionsTotal - purchase.sessionsUsed} session(s) left · valid till {fmtDate(purchase.validTo)}
            </p>
            {isLoading ? <Spinner /> : <SlotPicker days={slots?.days} value={slot} onChange={setSlot} empty={slots?.hasHours ? 'No free slots in the next 14 days' : 'This trainer has not set PT hours yet (Personal training > Availability)'} />}
          </div>
        )}
      </div>
    </Modal>
  );
}

function MarkModal({ booking, status, onClose }) {
  const [notes, setNotes] = useState('');
  const done = status === 'done';
  const act = useAction(() => post(`/pt/bookings/${booking._id}/${status}`, { notes: notes.trim() || undefined }), {
    success: (r) => (r.purchase ? `${done ? 'Session done' : 'Marked no-show'}. ${r.purchase.sessionsTotal - r.purchase.sessionsUsed} session(s) left.` : 'Marked no-show'),
    invalidate: ['pt', 'member'],
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={done ? 'Mark session done' : 'Mark no-show'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={done ? 'success' : 'danger'} loading={act.isPending} onClick={() => act.mutate()}>
            {done ? 'Mark done' : 'Mark no-show'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {booking.memberId?.name} · {fmtDateTime(booking.startsAt)}
      </p>
      <Field label="Notes (optional)">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={done ? 'Workout done, progress…' : ''} />
      </Field>
      <p className="mt-2 text-xs text-slate-500">{done ? 'One session is used from the package.' : 'Depending on your settings a no-show also uses one session.'}</p>
    </Modal>
  );
}

function CancelModal({ booking, onClose }) {
  const [reason, setReason] = useState('');
  const act = useAction(() => post(`/pt/bookings/${booking._id}/cancel`, { reason: reason.trim() || undefined }), { success: 'Booking cancelled. The trainer is informed.', invalidate: ['pt'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Cancel booking?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep
          </Button>
          <Button variant="danger" loading={act.isPending} onClick={() => act.mutate()}>
            Cancel booking
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {booking.memberId?.name} · {fmtDateTime(booking.startsAt)}. The slot opens for others and no session is used.
      </p>
      <Field label="Reason (optional)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

function BookingRow({ b, onAct }) {
  const can = useAuth((s) => s.can);
  const left = b.ptPurchaseId ? b.ptPurchaseId.sessionsTotal - b.ptPurchaseId.sessionsUsed : null;
  const canMark = b.status === 'booked' && new Date(b.startsAt) - Date.now() <= 30 * 60000;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          {fmtTime(b.startsAt)} – {fmtTime(b.endsAt)} <BookingBadge status={b.status} />
          {b.lateCancel && <span className="ml-1 text-xs text-rose-600">late cancel</span>}
        </p>
        <p className="text-sm text-slate-700">
          <Link to={`/admin/members/${b.memberId?._id}`} className="text-brand-700 hover:underline">
            {b.memberId?.name}
          </Link>{' '}
          <span className="text-slate-400">#{b.memberId?.memberCode}</span>
        </p>
        <p className="text-xs text-slate-500">
          {b.trainerId?.name} · {b.ptPurchaseId?.package?.name}
          {left != null && ` · ${left} left`}
          {b.source === 'staff' ? ' · booked at desk' : ' · booked in app'}
        </p>
      </div>
      {b.status === 'booked' && can('pt.log') && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="success" disabled={!canMark} title={canMark ? '' : 'From 30 minutes before the session'} onClick={() => onAct({ type: 'done', b })}>
            <CheckCircle2 className="size-3.5" /> Mark done
          </Button>
          <Button size="sm" variant="secondary" disabled={!canMark} onClick={() => onAct({ type: 'no-show', b })}>
            <UserX className="size-3.5" /> No-show
          </Button>
          <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => onAct({ type: 'cancel', b })}>
            <XCircle className="size-3.5" /> Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

/** Day / week list of PT bookings. Trainers see only their own. */
export function PtSchedule() {
  const { can, user } = useAuth();
  const isTrainer = user.role === 'trainer';
  const [view, setView] = useState('day');
  const [date, setDate] = useState(ymd());
  const [trainerId, setTrainerId] = useState('');
  const [modal, setModal] = useState(null);
  const { data: trainers } = useTrainers();
  const start = view === 'day' ? dayjs(date) : dayjs(date).subtract((dayjs(date).day() + 6) % 7, 'day');
  const end = view === 'day' ? start : start.add(6, 'day');
  const { data, isLoading } = useApi(['pt', 'bookings'], '/pt/bookings', { from: ymd(start), to: ymd(end), trainerId: isTrainer ? '' : trainerId }, { refetchInterval: 60000 });
  const shift = (n) => setDate(ymd(dayjs(date).add(view === 'day' ? n : n * 7, 'day')));
  const byDay = (data || []).reduce((acc, b) => {
    (acc[ymd(b.startsAt)] ||= []).push(b);
    return acc;
  }, {});
  const days = view === 'day' ? [ymd(start)] : Array.from({ length: 7 }, (_, i) => ymd(start.add(i, 'day')));
  const open = (data || []).filter((b) => b.status === 'booked').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-300">
          {['day', 'week'].map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-brand-700 text-white' : 'text-slate-600'}`}>
              {v === 'day' ? 'Day' : 'Week'}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="size-4" />
        </Button>
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
        <Button size="sm" variant="secondary" onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDate(ymd())}>
          Today
        </Button>
        {!isTrainer && (
          <Select value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="w-auto" aria-label="Trainer">
            <option value="">All trainers</option>
            {(trainers || []).map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        <div className="flex-1" />
        {can('pt.log') && (
          <Button size="sm" onClick={() => setModal({ type: 'book' })}>
            <CalendarPlus className="size-4" /> Book for a member
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-500">
        {view === 'day' ? dayjs(date).format('dddd, DD MMM YYYY') : `${start.format('DD MMM')} – ${end.format('DD MMM YYYY')}`} · {data?.length ?? 0} booking(s), {open} upcoming
      </p>
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <EmptyState title={view === 'day' ? 'No PT bookings on this day' : 'No PT bookings this week'}>
            Members book from the app once their trainer has set PT hours in the Availability tab.
            {can('pt.log') && (
              <div>
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setModal({ type: 'book' })}>
                  <CalendarPlus className="size-4" /> Book for a member
                </Button>
              </div>
            )}
          </EmptyState>
        </Card>
      ) : (
        days
          .filter((d) => byDay[d]?.length || view === 'day')
          .map((d) => (
            <Card key={d} title={dayjs(d).format('dddd, DD MMM')} padded={false}>
              <ul className="divide-y divide-slate-100">
                {(byDay[d] || []).map((b) => (
                  <BookingRow key={b._id} b={b} onAct={setModal} />
                ))}
              </ul>
            </Card>
          ))
      )}
      {modal?.type === 'book' && <BookSlotModal onClose={() => setModal(null)} />}
      {(modal?.type === 'done' || modal?.type === 'no-show') && <MarkModal booking={modal.b} status={modal.type} onClose={() => setModal(null)} />}
      {modal?.type === 'cancel' && <CancelModal booking={modal.b} onClose={() => setModal(null)} />}
    </div>
  );
}


/** Weekly PT hours, slot length and time off of one trainer. */
export function PtAvailability() {
  const { can, user } = useAuth();
  const isTrainer = user.role === 'trainer';
  const editable = isTrainer || can('pt.manage');
  const { data: trainers } = useTrainers();
  const { data: branches } = useBranches();
  const [trainerId, setTrainerId] = useState(isTrainer ? user._id : '');
  useEffect(() => {
    if (!trainerId && trainers?.length) setTrainerId(trainers[0]._id);
  }, [trainers, trainerId]);
  const { data, isLoading } = useQuery({ queryKey: ['pt', 'availability', trainerId], queryFn: () => get('/pt/availability', isTrainer ? {} : { trainerId }), enabled: Boolean(trainerId) });
  const [f, setF] = useState(null);
  const [off, setOff] = useState({ from: ymd(), to: ymd(), startTime: '', endTime: '', note: '' });
  useEffect(() => {
    if (data) setF({ slotMin: data.slotMin || 60, weekly: data.weekly || [], timeOff: data.timeOff || [] });
  }, [data]);
  const trainer = isTrainer ? { _id: user._id, name: user.name, branchIds: user.branchIds } : trainers?.find((t) => t._id === trainerId);
  const myBranches = (branches || []).filter((b) => (trainer?.branchIds || []).map(String).includes(b._id));
  const defaultBranch = myBranches[0]?._id || branches?.[0]?._id || '';
  const save = useAction(
    () =>
      put('/pt/availability', {
        ...(isTrainer ? {} : { trainerId }),
        slotMin: Number(f.slotMin),
        weekly: f.weekly.map((r) => ({ day: r.day, start: r.start, end: r.end, branchId: r.branchId || defaultBranch })),
        timeOff: f.timeOff.map((t) => ({ from: t.from, to: t.to, note: t.note || undefined })),
      }),
    { success: 'PT hours saved. Members can book these slots now.', invalidate: ['pt'] },
  );

  if (!trainers && !isTrainer) return <Spinner />;
  if (!isTrainer && !trainers?.length) return <Card><EmptyState title="No trainers yet">Add a staff account with the Trainer role in Settings &gt; Staff.</EmptyState></Card>;
  if (isLoading || !f) return <Spinner />;

  const setRange = (i, k, v) => setF({ ...f, weekly: f.weekly.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const addRange = (day) => setF({ ...f, weekly: [...f.weekly, { day, start: '07:00', end: '11:00', branchId: defaultBranch }] });
  const removeRange = (i) => setF({ ...f, weekly: f.weekly.filter((_, j) => j !== i) });
  const copyMonday = () => {
    const mon = f.weekly.filter((r) => r.day === 1);
    setF({ ...f, weekly: [...f.weekly.filter((r) => r.day === 0 || r.day === 1), ...[2, 3, 4, 5, 6].flatMap((day) => mon.map((r) => ({ ...r, day })))] });
  };
  const addOff = () => {
    const from = dayjs(`${off.from} ${off.startTime || '00:00'}`);
    const to = off.endTime ? dayjs(`${off.to} ${off.endTime}`) : dayjs(off.to).add(1, 'day').startOf('day');
    if (!to.isAfter(from)) return;
    setF({ ...f, timeOff: [...f.timeOff, { from: from.toISOString(), to: to.toISOString(), note: off.note.trim() }] });
    setOff({ ...off, note: '', startTime: '', endTime: '' });
  };
  const offLabel = (t) => {
    const a = dayjs(t.from);
    const b = dayjs(t.to);
    const allDay = a.format('HH:mm') === '00:00' && b.format('HH:mm') === '00:00';
    if (allDay) {
      const last = b.subtract(1, 'day');
      return last.isSame(a, 'day') ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(last)}`;
    }
    return `${fmtDateTime(a)} – ${b.isSame(a, 'day') ? fmtTime(b) : fmtDateTime(b)}`;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        title="Weekly PT hours"
        className="lg:col-span-2"
        actions={
          editable && (
            <Button size="sm" variant="ghost" onClick={copyMonday} title="Use Monday's hours for Tuesday to Saturday">
              <Copy className="size-4" /> Copy Monday to Tue–Sat
            </Button>
          )
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {!isTrainer && (
            <Field label="Trainer">
              <Select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                {(trainers || []).map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Slot length">
            <Select value={f.slotMin} onChange={(e) => setF({ ...f, slotMin: Number(e.target.value) })} disabled={!editable}>
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <ul className="divide-y divide-slate-100">
          {DAYS.map((day) => {
            const rows = f.weekly.map((r, i) => ({ ...r, i })).filter((r) => r.day === day);
            return (
              <li key={day} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="w-24 text-sm font-medium text-slate-800">{DAY_NAME[day]}</span>
                  {!rows.length && <span className="flex-1 text-sm text-slate-400">Off</span>}
                  {editable && (
                    <Button size="sm" variant="ghost" onClick={() => addRange(day)} aria-label={`Add hours on ${DAY_NAME[day]}`}>
                      <Plus className="size-4" /> Hours
                    </Button>
                  )}
                </div>
                {rows.map((r) => (
                  <div key={r.i} className="mt-2 flex flex-wrap items-center gap-2">
                    <Input type="time" value={r.start} onChange={(e) => setRange(r.i, 'start', e.target.value)} disabled={!editable} className="w-36" aria-label={`${DAY_NAME[day]} from`} />
                    <span className="text-slate-400">to</span>
                    <Input type="time" value={r.end} onChange={(e) => setRange(r.i, 'end', e.target.value)} disabled={!editable} className="w-36" aria-label={`${DAY_NAME[day]} to`} />
                    {myBranches.length > 1 && (
                      <Select value={r.branchId || defaultBranch} onChange={(e) => setRange(r.i, 'branchId', e.target.value)} disabled={!editable} className="w-auto" aria-label="Branch">
                        {myBranches.map((b) => (
                          <option key={b._id} value={b._id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    )}
                    {editable && (
                      <Button size="sm" variant="ghost" onClick={() => removeRange(r.i)} aria-label="Remove hours">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                    {r.start >= r.end && <span className="text-xs text-rose-600">End must be after start</span>}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
        {editable ? (
          <div className="mt-4 flex justify-end">
            <Button loading={save.isPending} disabled={f.weekly.some((r) => r.start >= r.end)} onClick={() => save.mutate()}>
              Save hours
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Only the trainer or a manager can change PT hours.</p>
        )}
      </Card>
      <Card title="Time off">
        {editable && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Field label="From">
              <Input type="date" min={ymd()} value={off.from} onChange={(e) => setOff({ ...off, from: e.target.value, to: e.target.value > off.to ? e.target.value : off.to })} />
            </Field>
            <Field label="To">
              <Input type="date" min={off.from} value={off.to} onChange={(e) => setOff({ ...off, to: e.target.value })} />
            </Field>
            <Field label="From time" hint="Empty = whole day">
              <Input type="time" value={off.startTime} onChange={(e) => setOff({ ...off, startTime: e.target.value })} />
            </Field>
            <Field label="To time">
              <Input type="time" value={off.endTime} onChange={(e) => setOff({ ...off, endTime: e.target.value })} />
            </Field>
            <Field label="Note" className="col-span-2">
              <Input value={off.note} onChange={(e) => setOff({ ...off, note: e.target.value })} placeholder="Leave, holiday…" />
            </Field>
            <Button size="sm" variant="secondary" className="col-span-2" onClick={addOff} disabled={!off.from || !off.to}>
              <Plus className="size-4" /> Add time off
            </Button>
          </div>
        )}
        {f.timeOff.length ? (
          <ul className="space-y-2 text-sm">
            {f.timeOff.map((t, i) => (
              <li key={`${t.from}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span>
                  {offLabel(t)}
                  {t.note && <span className="block text-xs text-slate-500">{t.note}</span>}
                </span>
                {editable && (
                  <Button size="sm" variant="ghost" onClick={() => setF({ ...f, timeOff: f.timeOff.filter((_, j) => j !== i) })} aria-label="Remove time off">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No time off planned.</p>
        )}
        {editable && <p className="mt-3 text-xs text-slate-500">Time off is saved with “Save hours”. Existing bookings are not cancelled automatically.</p>}
      </Card>
    </div>
  );
}
