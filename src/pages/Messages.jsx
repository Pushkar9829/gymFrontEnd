import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { get, post } from '../lib/api';
import { useAction, useBranches } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { fmtDateTime } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, Table, Textarea, Input } from '../components/ui';

const AUDIENCES = [
  { value: 'active', label: 'Active members (incl. frozen)' },
  { value: 'expiring', label: 'Expiring in the next 7 days' },
  { value: 'expired', label: 'Expired in the last 60 days' },
  { value: 'due', label: 'Members with pending dues' },
  { value: 'all', label: 'Everyone' },
];
const CHANNELS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

export default function Messages() {
  const { data: branches } = useBranches();
  const { user } = useAuth();
  const [f, setF] = useState({ branchId: '', audience: 'active', channels: ['sms'], subject: '', text: '' });
  const [count, setCount] = useState(null);
  const { data: history } = useQuery({ queryKey: ['announcements'], queryFn: () => get('/announcements'), refetchInterval: 5000 });
  const { data: outbox } = useQuery({ queryKey: ['dev-outbox'], queryFn: () => get('/announcements/dev-outbox'), enabled: user.role === 'owner', retry: false });

  const body = { ...f, branchId: f.branchId || undefined, subject: f.subject || undefined };
  useEffect(() => {
    let alive = true;
    post('/announcements', { ...body, text: f.text.length >= 5 ? f.text : 'preview', preview: true })
      .then((d) => alive && setCount(d.total))
      .catch(() => alive && setCount(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.branchId, f.audience]);

  const send = useAction(() => post('/announcements', body), {
    success: (d) => `Sending to ${d.total} member(s)`,
    invalidate: ['announcements'],
    onSuccess: () => setF({ ...f, text: '', subject: '' }),
  });
  const toggle = (c) => setF({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] });

  return (
    <div>
      <PageHeader title="Messages" subtitle="Send announcements by SMS, WhatsApp or email. Renewal reminders, receipts and birthday wishes go out automatically." />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="New announcement" className="lg:col-span-2">
          <div className="space-y-3">
            {branches?.length > 1 && (
              <Field label="Branch">
                <Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
                  <option value="">All my branches</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Send to" hint={count != null ? `${count} member(s)` : undefined}>
              <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Channels</p>
              <div className="flex gap-4">
                {CHANNELS.map((c) => (
                  <label key={c.value} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={f.channels.includes(c.value)} onChange={() => toggle(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            {f.channels.includes('email') && (
              <Field label="Email subject">
                <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
              </Field>
            )}
            <Field label="Message" hint={`${f.text.length}/600. WhatsApp needs an approved "announcement" template.`}>
              <Textarea rows={5} maxLength={600} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="The gym will be closed on Monday for maintenance." />
            </Field>
            <Button className="w-full" disabled={f.text.trim().length < 5 || !f.channels.length || !count} loading={send.isPending} onClick={() => window.confirm(`Send to ${count} member(s)?`) && send.mutate()}>
              <Send className="size-4" /> Send
            </Button>
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-3">
          <Card title="History" padded={false}>
            <Table
              rows={history?.items}
              empty={<EmptyState title="No announcements yet" />}
              columns={[
                { key: 'at', label: 'When', render: (a) => fmtDateTime(a.createdAt) },
                { key: 'text', label: 'Message', className: 'max-w-xs truncate', render: (a) => a.text },
                { key: 'aud', label: 'To', render: (a) => `${a.audience} · ${a.channels.join(', ')}` },
                { key: 'n', label: 'Sent', render: (a) => (a.status === 'sending' ? <Badge status="upcoming">Sending…</Badge> : `${a.sent}/${a.total * a.channels.length}${a.failed ? ` · ${a.failed} failed` : ''}`) },
              ]}
            />
          </Card>
          {outbox && (
            <Card title="Test outbox (no SMS/WhatsApp provider configured)" padded={false}>
              <Table
                rowKey="at"
                rows={outbox.map((m, i) => ({ ...m, at: `${m.at}-${i}` }))}
                empty={<EmptyState title="Nothing yet" />}
                columns={[
                  { key: 'ch', label: 'Channel', render: (m) => m.channel },
                  { key: 'to', label: 'To', render: (m) => m.to },
                  { key: 'text', label: 'Text', className: 'whitespace-normal text-xs', render: (m) => m.text },
                ]}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
