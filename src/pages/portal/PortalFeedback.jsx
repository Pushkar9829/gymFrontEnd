import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { ChevronLeft, Plus } from 'lucide-react';
import { memberApi, errorMessage } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, PageLoader, Select, Textarea } from '../../components/ui';
import { portalGet } from './PortalHome';
import { TYPE_TEXT, CATEGORY_TEXT, FB_STATUS_TEXT, FB_STATUS_BADGE, Stars, Thread } from '../Feedback';

const send = (url, body) => memberApi.client.post(url, body).then((r) => r.data.data);

function useSend() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return [
    busy,
    async (url, body, ok) => {
      setBusy(true);
      try {
        const d = await send(url, body);
        if (ok) toast.success(ok);
        await qc.invalidateQueries({ queryKey: ['portal', 'feedback'] });
        return d;
      } catch (err) {
        toast.error(errorMessage(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
  ];
}

function NewTicket({ onDone }) {
  const [f, setF] = useState({ type: 'complaint', category: 'other', subject: '', message: '', rating: 0 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [busy, go] = useSend();
  async function submit(e) {
    e.preventDefault();
    const d = await go('/me/feedback', { ...f, rating: f.rating || undefined }, null);
    if (d) {
      toast.success(`Thanks! Ticket ${d.ticketNo} sent to the gym.`);
      onDone();
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(TYPE_TEXT).map(([v, t]) => (
          <button
            type="button"
            key={v}
            onClick={() => setF({ ...f, type: v })}
            className={clsx('rounded-lg py-2 text-sm font-medium ring-1', f.type === v ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300')}
          >
            {t}
          </button>
        ))}
      </div>
      <Field label="About">
        <Select value={f.category} onChange={set('category')}>
          {Object.entries(CATEGORY_TEXT).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Subject">
        <Input value={f.subject} onChange={set('subject')} required minLength={3} maxLength={100} placeholder={f.type === 'praise' ? 'e.g. Great Zumba class' : 'e.g. Treadmill 3 not working'} />
      </Field>
      <Field label="Details">
        <Textarea value={f.message} onChange={set('message')} required minLength={3} rows={4} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Your overall experience (optional)</p>
        <Stars value={f.rating} onChange={(rating) => setF({ ...f, rating })} size="size-7" />
      </div>
      <Button type="submit" className="w-full" loading={busy}>
        Send
      </Button>
    </form>
  );
}

function TicketView({ ticket, onBack }) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [busy, go] = useSend();
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500">
        <ChevronLeft className="size-4" /> All tickets
      </button>
      <div>
        <p className="text-xs text-slate-500">
          {ticket.ticketNo} · {TYPE_TEXT[ticket.type]} · {CATEGORY_TEXT[ticket.category]}
        </p>
        <h2 className="text-lg font-semibold">{ticket.subject}</h2>
        <Badge status={FB_STATUS_BADGE[ticket.status]}>{FB_STATUS_TEXT[ticket.status]}</Badge>
      </div>
      <Thread ticket={ticket} />
      {ticket.status === 'resolved' && (
        <Card>
          <p className="text-sm font-medium">The gym marked this as resolved. How did we handle it?</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Stars value={rating} onChange={setRating} size="size-7" />
            <Button size="sm" disabled={!rating} loading={busy} onClick={() => go(`/me/feedback/${ticket._id}/rate`, { rating }, 'Thanks for rating!')}>
              Rate & close
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Not fixed? Reply below and the ticket opens again.</p>
        </Card>
      )}
      {ticket.status === 'closed' ? (
        <p className="text-sm text-slate-500">
          This ticket is closed{ticket.memberRating ? '. You rated it ' : '.'}
          {ticket.memberRating && <Stars value={ticket.memberRating} size="size-4" />}
        </p>
      ) : (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a reply" aria-label="Reply" />
          <Button
            className="w-full"
            variant="secondary"
            disabled={!text.trim()}
            loading={busy}
            onClick={async () => {
              if (await go(`/me/feedback/${ticket._id}/replies`, { text }, 'Reply sent')) setText('');
            }}
          >
            Send reply
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PortalFeedback() {
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'feedback'], queryFn: () => portalGet('/me/feedback') });
  const [view, setView] = useState(null); // 'new' | ticket id
  if (isLoading) return <PageLoader />;
  const ticket = data?.find((t) => t._id === view);
  if (ticket) return <TicketView ticket={ticket} onBack={() => setView(null)} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Feedback</h1>
        {view !== 'new' && (
          <Button size="sm" onClick={() => setView('new')}>
            <Plus className="size-4" /> New
          </Button>
        )}
      </div>
      {view === 'new' ? (
        <Card title="Tell the gym">
          <NewTicket onDone={() => setView(null)} />
          <button className="mt-3 w-full text-center text-sm text-slate-500" onClick={() => setView(null)}>
            Cancel
          </button>
        </Card>
      ) : data?.length ? (
        <Card padded={false}>
          <ul className="divide-y divide-slate-100">
            {data.map((t) => (
              <li key={t._id}>
                <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setView(t._id)}>
                  <span className="min-w-0">
                    <b className="block truncate text-sm">{t.subject}</b>
                    <span className="text-xs text-slate-500">
                      {t.ticketNo} · {fmtDate(t.createdAt)}
                      {t.replies.some((r) => r.from === 'staff') && ' · gym replied'}
                    </span>
                  </span>
                  <Badge status={FB_STATUS_BADGE[t.status]}>{FB_STATUS_TEXT[t.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState title="No feedback yet">Something not working, an idea, or a trainer who did great? Tap New.</EmptyState>
        </Card>
      )}
    </div>
  );
}
