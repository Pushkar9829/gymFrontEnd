import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowLeft, Clock } from 'lucide-react';
import { memberApi, errorMessage } from '../../lib/api';
import { openCheckout } from '../../lib/razorpay';
import { inr } from '../../lib/format';
import { Button, Card, Input, PageLoader } from '../../components/ui';
import { portalGet } from './PortalHome';

const portalPost = (url, body) => memberApi.client.post(url, body).then((r) => r.data.data);

export default function PortalRenew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery({ queryKey: ['portal', 'plans'], queryFn: () => portalGet('/me/plans') });
  const { data: cfg } = useQuery({ queryKey: ['portal', 'paycfg'], queryFn: () => portalGet('/me/pay/config') });
  const [planId, setPlanId] = useState('');
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: quote, error: quoteError } = useQuery({
    queryKey: ['portal', 'quote', planId, applied],
    queryFn: () => portalPost('/me/quote', { planId, couponCode: applied || undefined }),
    enabled: Boolean(planId),
    retry: false,
  });

  async function pay() {
    setBusy(true);
    try {
      const order = await portalPost('/me/pay/renew', { planId, couponCode: applied || undefined });
      const plan = plans.find((p) => p._id === planId);
      const r = await openCheckout(order, { description: `${plan.name} membership` });
      await portalPost('/me/pay/verify', r);
      toast.success('Payment successful! Your membership is active.');
      await qc.invalidateQueries({ queryKey: ['portal'] });
      navigate('/portal');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <PageLoader />;
  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/portal')} className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> Back
      </button>
      <h1 className="text-lg font-semibold">Renew / buy a plan</h1>
      {!cfg?.enabled && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Online payment is not available right now. Please renew at the reception.</p>}
      <div className="space-y-2">
        {plans?.map((p) => (
          <button
            key={p._id}
            onClick={() => setPlanId(p._id)}
            className={clsx('w-full rounded-xl bg-white p-4 text-left ring-1', planId === p._id ? 'ring-2 ring-brand-600' : 'ring-slate-200')}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{p.name}</p>
              <p className="font-semibold text-brand-800">{inr(p.price)}</p>
            </div>
            <p className="text-sm text-slate-500">
              {p.durationValue} {p.durationUnit}
              {p.durationValue > 1 ? 's' : ''} + GST
            </p>
            {p.accessStart && (
              <p className="mt-1 flex items-center gap-1 text-xs text-indigo-700">
                <Clock className="size-3" /> Entry {p.accessStart}–{p.accessEnd} only
              </p>
            )}
          </button>
        ))}
      </div>
      {planId && (
        <Card>
          <div className="flex gap-2">
            <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Coupon code" />
            <Button variant="secondary" onClick={() => setApplied(coupon.trim())} disabled={!coupon.trim()}>
              Apply
            </Button>
          </div>
          {quoteError && <p className="mt-2 text-sm text-rose-600">{errorMessage(quoteError)}</p>}
          {quote && (
            <dl className="mt-3 space-y-1 text-sm">
              <Row k="Plan" v={inr(quote.price)} />
              {quote.joiningFee > 0 && <Row k="Joining fee" v={inr(quote.joiningFee)} />}
              {quote.discount > 0 && <Row k={`Discount${quote.coupon ? ` (${quote.coupon.code})` : ''}`} v={`- ${inr(quote.discount)}`} />}
              {quote.taxAmount > 0 && <Row k={`GST ${quote.taxPercent}%`} v={inr(quote.taxAmount)} />}
              <Row k={<b>Total</b>} v={<b>{inr(quote.totalAmount, { decimals: true })}</b>} />
            </dl>
          )}
          <Button className="mt-4 w-full" size="lg" disabled={!quote || !cfg?.enabled} loading={busy} onClick={pay}>
            Pay {quote ? inr(quote.totalAmount, { decimals: true }) : ''}
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">UPI, cards and netbanking via Razorpay. Your membership starts right after your current one ends.</p>
        </Card>
      )}
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between">
    <dt className="text-slate-600">{k}</dt>
    <dd>{v}</dd>
  </div>
);
