import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Repeat, Copy } from 'lucide-react';
import { get, post } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { inr, fmtDate } from '../../lib/format';
import { Badge, Button, Card, Field, Modal, Select } from '../../components/ui';

const LIVE = ['created', 'authenticated', 'active', 'pending', 'halted', 'paused'];
const BADGE = { active: 'allow', authenticated: 'allow', created: 'upcoming', pending: 'upcoming', halted: 'deny', paused: 'deny', cancelled: 'cancelled', completed: 'cancelled' };

export function AutopayStatus({ a }) {
  return (
    <span className="text-sm">
      <Badge status={BADGE[a.status]}>{a.status === 'created' ? 'waiting for member to approve' : a.status}</Badge> {a.planId?.name} · {inr(a.amount)} per cycle
      {a.lastChargedAt && <span className="text-slate-500"> · last charged {fmtDate(a.lastChargedAt)}</span>}
    </span>
  );
}

export default function MemberAutopay({ member }) {
  const can = useAuth((s) => s.can);
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState('');
  const [link, setLink] = useState(null);
  const { data } = useQuery({ queryKey: ['autopay', member._id], queryFn: () => get('/online-payments/autopay', { memberId: member._id }) });
  const { data: plans } = useQuery({ queryKey: ['plans', 'active'], queryFn: () => get('/plans', { active: true }), enabled: open });
  const start = useAction(() => post('/online-payments/autopay', { memberId: member._id, planId }), { invalidate: ['autopay'], onSuccess: (d) => setLink(d) });
  const cancel = useAction((id) => post(`/online-payments/autopay/${id}/cancel`), { success: 'Autopay cancelled', invalidate: ['autopay'] });
  const current = data?.find((a) => LIVE.includes(a.status));
  if (!can('payments.create') && !current) return null;
  return (
    <Card
      title={<span className="flex items-center gap-2"><Repeat className="size-4" /> Autopay</span>}
      actions={
        can('payments.create') &&
        (current ? (
          <Button size="sm" variant="ghost" className="text-rose-600" loading={cancel.isPending} onClick={() => window.confirm('Cancel autopay for this member?') && cancel.mutate(current._id)}>
            Cancel autopay
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => (setOpen(true), setLink(null))}>
            Set up autopay
          </Button>
        ))
      }
    >
      {current ? <AutopayStatus a={current} /> : <p className="text-sm text-slate-500">Not set up. The member approves a UPI AutoPay / card mandate once; each charge renews the membership automatically.</p>}
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Set up autopay" size="sm" footer={!link && <Button disabled={!planId} loading={start.isPending} onClick={() => start.mutate()}>Create mandate link</Button>}>
          {link ? (
            <div className="space-y-3 text-sm">
              <p>Razorpay has sent the approval link to the member. They pay {inr(link.amount)} per cycle after approving.</p>
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                <code className="flex-1 truncate">{link.shortUrl}</code>
                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link.shortUrl).then(() => toast.success('Copied'))}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <a
                className="font-medium text-emerald-700 hover:underline"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/91${member.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hi ${member.name}, approve autopay for your gym membership here: ${link.shortUrl}`)}`}
              >
                Share on WhatsApp
              </a>
            </div>
          ) : (
            <Field label="Plan to renew automatically" hint="Monthly-based plans only. Charged at plan price + GST (no joining fee).">
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Choose…</option>
                {plans
                  ?.filter((p) => p.durationUnit === 'month' && (p.maxMembers || 1) === 1)
                  .map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} · {inr(p.price)} + GST
                    </option>
                  ))}
              </Select>
            </Field>
          )}
        </Modal>
      )}
    </Card>
  );
}
