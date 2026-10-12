import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import clsx from 'clsx';
import { Camera, CameraOff, Search, ShieldCheck, ShieldX, RefreshCw, IndianRupee, Play } from 'lucide-react';
import { get, post, errorMessage } from '../lib/api';
import { useAuth } from '../store/auth';
import { useAction } from '../lib/hooks';
import { inr, fmtTime, daysUntil } from '../lib/format';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui';
import { MemberAvatar } from '../components/MemberAvatar';
import { MembershipModal, PaymentModal } from './members/MemberModals';

const RENEW_CODES = ['EXPIRED', 'NO_MEMBERSHIP', 'CANCELLED'];
const FIX_CODES = [...RENEW_CODES, 'DUES', 'FROZEN'];

// Membership with money due that is still running (or starts later).
const dueSubscription = (subs = []) =>
  subs.filter((s) => s.status === 'active' && s.dueAmount > 0 && daysUntil(s.endDate) >= 0).sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] || null;

function runningFreeze(subs = []) {
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const f = s.freezes?.find((x) => !x.endedEarlyAt && daysUntil(x.from) <= 0 && daysUntil(x.to) >= 0);
    if (f) return { sub: s, freeze: f };
  }
  return null;
}

/** One-click fixes for a refused entry; after a successful save the check-in is tried again. */
function DeniedActions({ result, onRetry }) {
  const can = useAuth((s) => s.can);
  const id = result.member._id;
  const fixable = FIX_CODES.includes(result.code);
  const { data } = useQuery({ queryKey: ['member', id], queryFn: () => get(`/members/${id}`), enabled: fixable });
  const [modal, setModal] = useState(null);
  const unfreeze = useAction(({ sub, freeze }) => post(`/subscriptions/${sub._id}/freezes/${freeze._id}/end`), {
    success: 'Freeze ended',
    invalidate: ['member', 'members', 'dashboard'],
    onSuccess: onRetry,
  });
  if (!fixable || !data) return null;
  const subs = data.subscriptions || [];
  const due = result.code === 'DUES' ? dueSubscription(subs) : null;
  const frozen = result.code === 'FROZEN' ? runningFreeze(subs) : null;
  const renew = RENEW_CODES.includes(result.code) && can('subscriptions.write');
  if (!renew && !(due && can('payments.create')) && !(frozen && can('subscriptions.write'))) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {renew && (
        <Button onClick={() => setModal('renew')}>
          <RefreshCw className="size-4" /> {subs.length ? 'Renew' : 'Add membership'}
        </Button>
      )}
      {due && can('payments.create') && (
        <Button onClick={() => setModal('pay')}>
          <IndianRupee className="size-4" /> Collect due {inr(due.dueAmount)}
        </Button>
      )}
      {frozen && can('subscriptions.write') && (
        <Button loading={unfreeze.isPending} onClick={() => unfreeze.mutate(frozen)}>
          <Play className="size-4" /> End freeze
        </Button>
      )}
      <div className="text-left">
        <MembershipModal open={modal === 'renew'} onClose={() => setModal(null)} member={data.member} isFirst={!subs.length} onSaved={onRetry} />
        <PaymentModal open={modal === 'pay'} onClose={() => setModal(null)} subscription={due} onSaved={onRetry} />
      </div>
    </div>
  );
}

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Scanner({ onScan }) {
  const ref = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let scanner;
    let stopped = false;
    let last = { text: '', at: 0 };
    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (stopped) return;
      scanner = new Html5Qrcode('qr-reader');
      ref.current = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => {
            // Ignore the same code for 4 seconds (camera sees it many times).
            if (text === last.text && Date.now() - last.at < 4000) return;
            last = { text, at: Date.now() };
            onScan(text);
          },
          () => {},
        );
      } catch (e) {
        setError(String(e?.message || e).includes('Permission') ? 'Camera permission denied' : 'Could not start the camera');
      }
    })();
    return () => {
      stopped = true;
      if (ref.current?.isScanning) ref.current.stop().catch(() => {});
    };
  }, [onScan]);
  return (
    <div>
      <div id="qr-reader" className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-slate-900" />
      {error && <p className="mt-2 text-center text-sm text-rose-600">{error}</p>}
    </div>
  );
}

export default function CheckIn() {
  const [camera, setCamera] = useState(false);
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const branchId = useAuth((s) => s.branchId);
  const query = useDebounced(q.trim());

  const { data: found } = useQuery({
    queryKey: ['checkin-search', query, branchId],
    queryFn: () => get('/members', { search: query, limit: 6, branchId: branchId || undefined, includeTrials: true }),
    enabled: query.length >= 2,
  });

  const submit = useCallback(async (body, extra = {}) => {
    setBusy(true);
    try {
      const r = await post('/attendance/check-in', body);
      setResult({ ...r, ...extra });
    } catch (err) {
      setResult({ allowed: false, reason: errorMessage(err), error: true });
    } finally {
      setBusy(false);
    }
  }, []);

  const onScan = useCallback((text) => submit({ qr: text }), [submit]);

  return (
    <div>
      <PageHeader
        title="Check-in"
        subtitle="Scan the member's QR card or search by name, phone or member code. Biometric entries are recorded automatically."
        actions={
          <Button variant={camera ? 'secondary' : 'primary'} onClick={() => setCamera((v) => !v)}>
            {camera ? <CameraOff className="size-4" /> : <Camera className="size-4" />} {camera ? 'Stop camera' : 'Scan QR'}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {camera && (
            <Card>
              <Scanner onScan={onScan} />
            </Card>
          )}
          <Card>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  // USB RFID readers type the card number and press Enter.
                  if (e.key === 'Enter' && /^\d{6,20}$/.test(q.trim())) {
                    submit({ cardNo: q.trim() });
                    setQ('');
                  }
                }}
                placeholder="Name, phone, member code, or tap RFID card"
                className="pl-9"
                autoFocus
              />
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {found?.items?.map((m) => (
                <li key={m._id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar member={m} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        #{m.memberCode} · {m.phone} · {m.isTrial ? <Badge status="trial">Trial pass</Badge> : <Badge status={m.membershipStatus} />}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" loading={busy} onClick={() => submit({ memberId: m._id })}>
                    Check in
                  </Button>
                </li>
              ))}
              {query.length >= 2 && found && !found.items.length && <li className="py-6 text-center text-sm text-slate-500">No member found</li>}
            </ul>
          </Card>
        </div>

        <div>
          {result ? (
            <div
              className={clsx(
                'flex flex-col items-center rounded-2xl p-8 text-center ring-2',
                result.allowed ? 'bg-emerald-50 ring-emerald-400' : 'bg-rose-50 ring-rose-400',
              )}
            >
              {result.allowed ? <ShieldCheck className="size-20 text-emerald-600" /> : <ShieldX className="size-20 text-rose-600" />}
              <p className={clsx('mt-3 text-3xl font-bold', result.allowed ? 'text-emerald-700' : 'text-rose-700')}>{result.allowed ? 'ENTRY ALLOWED' : 'NO ENTRY'}</p>
              {result.member && (
                <div className="mt-4 flex items-center gap-3">
                  <MemberAvatar member={result.member} size="lg" />
                  <div className="text-left">
                    <p className="text-lg font-semibold">{result.member.name}</p>
                    <p className="text-sm text-slate-600">
                      #{result.member.memberCode}
                      {result.member.isTrial && <Badge status="trial" className="ml-2">Trial pass</Badge>}
                    </p>
                  </div>
                </div>
              )}
              <p className={clsx('mt-4 text-lg', result.allowed ? 'text-emerald-800' : 'text-rose-800')}>{result.reason}</p>
              {result.dueAmount > 0 && <p className="mt-1 font-medium text-amber-700">Pending dues: {inr(result.dueAmount)}</p>}
              {result.attendance?.punches > 1 && <p className="mt-1 text-sm text-slate-500">Already checked in today at {fmtTime(result.attendance.checkInAt)}</p>}
              {result.retried && result.allowed && <p className="mt-1 text-sm font-medium text-emerald-700">Checked in after the fix</p>}
              {result.member && !result.allowed && !result.error && <DeniedActions key={`${result.member._id}:${result.code}`} result={result} onRetry={() => submit({ memberId: result.member._id }, { retried: true })} />}
              {result.member && !result.allowed && (
                <Link to={`/admin/members/${result.member._id}`} className="mt-4 text-sm font-medium text-brand-700 hover:underline">
                  Open member →
                </Link>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
              The check-in result will appear here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
