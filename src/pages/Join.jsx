import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import { Dumbbell, MapPin, Phone, Clock, CheckCircle2, Gift, ShieldCheck } from 'lucide-react';
import dayjs from 'dayjs';
import { errorMessage } from '../lib/api';
import { inr, fmtDate, ymd } from '../lib/format';
import { openCheckout } from '../lib/razorpay';
import { Button, Field, Input, PageLoader, Select, Textarea } from '../components/ui';

// Public page (no login): plans, classes, an enquiry form that creates a lead and, when online payments
// are set up, "Join online" (phone OTP -> Razorpay -> member + membership created after payment).
const publicApi = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api/v1/public` });
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const validPhone = (p) => /^\+?\d{10,13}$/.test(String(p).replace(/[\s-]/g, ''));

export default function Join() {
  const [params] = useSearchParams();
  const ref = cleanCode(params.get('ref'));
  const { data, isLoading } = useQuery({ queryKey: ['public-info'], queryFn: () => publicApi.get('/info').then((r) => r.data.data) });
  const refOn = data?.referral?.enabled !== false;
  const { data: inviter } = useQuery({
    queryKey: ['public-ref', ref],
    queryFn: () => publicApi.get(`/referral/${ref}`).then((r) => r.data.data),
    enabled: Boolean(ref && data && refOn),
  });
  const [mode, setMode] = useState(null);
  const [planId, setPlanId] = useState('');
  if (isLoading || !data) return <PageLoader />;
  const { gym, branches, plans, classTypes } = data;
  const onlinePlans = plans.filter((p) => p.sellOnline);
  const active = mode || (data.onlineJoin ? 'online' : 'enquiry');

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            {gym?.logoUrl ? <img src={gym.logoUrl} alt="" className="size-10 rounded-lg" /> : <span className="rounded-lg bg-brand-600 p-2"><Dumbbell className="size-6" /></span>}
            <h1 className="text-2xl font-bold">{gym?.name}</h1>
          </div>
          <p className="mt-3 max-w-xl text-white/80">
            {data.onlineJoin ? 'Start your fitness journey today. Join online in two minutes, or leave your number and we will call you.' : 'Start your fitness journey today. Leave your details and our team will call you to book a free trial.'}
          </p>
          {gym?.phone && (
            <a href={`tel:${gym.phone}`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
              <Phone className="size-4" /> {gym.phone}
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          {plans.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Membership plans</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((p) => {
                  const buyable = active === 'online' && p.sellOnline;
                  const Comp = buyable ? 'button' : 'div';
                  return (
                    <Comp
                      key={p._id}
                      type={buyable ? 'button' : undefined}
                      onClick={buyable ? () => setPlanId(p._id) : undefined}
                      className={clsx('rounded-xl bg-white p-4 text-left shadow-sm ring-1', buyable && planId === p._id ? 'ring-2 ring-brand-600' : 'ring-slate-200', buyable && 'transition hover:ring-brand-300')}
                    >
                      <p className="flex items-center justify-between gap-2 font-semibold">
                        {p.name}
                        {data.onlineJoin && p.sellOnline && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Join online</span>}
                      </p>
                      <p className="text-sm text-slate-500">
                        {p.durationValue} {p.durationUnit}
                        {p.durationValue > 1 ? 's' : ''}
                        {p.accessStart && ` · ${p.accessStart}–${p.accessEnd}`}
                      </p>
                      <p className="mt-2 text-xl font-bold text-brand-800">
                        {inr(p.price)} <span className="text-xs font-normal text-slate-500">+ GST</span>
                      </p>
                      {p.joiningFee > 0 && <p className="text-xs text-slate-500">+ {inr(p.joiningFee)} one-time joining fee</p>}
                    </Comp>
                  );
                })}
              </div>
            </section>
          )}
          {classTypes.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Group classes</h2>
              <div className="flex flex-wrap gap-2">
                {classTypes.map((c) => (
                  <span key={c._id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-slate-200">
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Locations</h2>
            <ul className="space-y-2">
              {branches.map((b) => (
                <li key={b._id} className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
                  <p className="font-semibold">{b.name}</p>
                  {b.address && (
                    <p className="flex items-center gap-1 text-slate-600">
                      <MapPin className="size-4" /> {b.address}
                    </p>
                  )}
                  <p className="flex items-center gap-1 text-slate-600">
                    <Clock className="size-4" /> {b.openingTime} – {b.closingTime}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="order-first md:order-none md:col-span-2">
          <div className="sticky top-4 space-y-3 rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-200">
            {inviter?.valid && (
              <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <Gift className="mt-0.5 size-4 shrink-0" />
                <span>
                  Invited by <b>{inviter.name}</b>
                  {inviter.friendDiscountPercent > 0 && ` · ${inviter.friendDiscountPercent}% off your first membership`}
                </span>
              </p>
            )}
            {data.onlineJoin && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium" role="tablist">
                {[
                  ['online', 'Join online'],
                  ['enquiry', 'Free trial / call me'],
                ].map(([v, label]) => (
                  <button key={v} type="button" role="tab" aria-selected={active === v} onClick={() => setMode(v)} className={clsx('rounded-md px-2 py-1.5', active === v ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600')}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {active === 'online' ? (
              <JoinOnline branches={branches} plans={onlinePlans} planId={planId} setPlanId={setPlanId} refCode={refOn ? ref : ''} refOn={refOn} />
            ) : (
              <Enquiry branches={branches} plans={plans} classTypes={classTypes} refCode={refOn ? ref : ''} refOn={refOn} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Enquiry({ branches, plans, classTypes, refCode, refOn }) {
  const [f, setF] = useState({ branchId: '', name: '', phone: '', email: '', interest: '', message: '', referralCode: refCode, website: '' });
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, error: '' });
    try {
      await publicApi.post('/enquiry', { ...f, referralCode: f.referralCode || undefined, branchId: f.branchId || branches[0]?._id });
      setState({ busy: false, done: true, error: '' });
    } catch (err) {
      setState({ busy: false, done: false, error: errorMessage(err) });
    }
  }

  if (state.done) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <p className="mt-3 font-semibold">Thank you, {f.name.split(' ')[0]}!</p>
        <p className="text-sm text-slate-600">Our team will call you shortly.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-lg font-semibold">Book a free trial</h2>
      {branches.length > 1 && (
        <Field label="Branch">
          <Select value={f.branchId} onChange={set('branchId')} required>
            <option value="">Choose…</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Name">
        <Input value={f.name} onChange={set('name')} required autoComplete="name" />
      </Field>
      <Field label="Phone">
        <Input value={f.phone} onChange={set('phone')} required inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Email (optional)">
        <Input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
      </Field>
      <Field label="Interested in">
        <Select value={f.interest} onChange={set('interest')}>
          <option value="">—</option>
          {plans.map((p) => (
            <option key={p._id}>{p.name}</option>
          ))}
          {classTypes.map((c) => (
            <option key={c._id}>{c.name} classes</option>
          ))}
          <option>Personal training</option>
        </Select>
      </Field>
      {refOn && (
        <Field label="Referral code (optional)" hint="From a friend who is a member">
          <Input value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: cleanCode(e.target.value) })} autoComplete="off" className="font-mono uppercase" />
        </Field>
      )}
      <Field label="Message (optional)">
        <Textarea value={f.message} onChange={set('message')} rows={2} />
      </Field>
      {/* Honeypot: hidden from people, bots fill it */}
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" className="w-full" size="lg" loading={state.busy}>
        Call me back
      </Button>
      <p className="text-center text-xs text-slate-400">We'll only use your number to contact you about your membership.</p>
    </form>
  );
}

function JoinOnline({ branches, plans, planId, setPlanId, refCode, refOn }) {
  const [f, setF] = useState({ branchId: branches.length === 1 ? branches[0]._id : '', name: '', phone: '', email: '', gender: '', dob: '', startDate: ymd(), referralCode: refCode });
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [otp, setOtp] = useState({ sent: false, code: '', token: '', status: '', busy: false, error: '' });
  const [pay, setPay] = useState({ busy: false, error: '', result: null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const branchPlans = plans.filter((p) => !p.branchIds?.length || p.branchIds.includes(f.branchId));
  const plan = branchPlans.find((p) => p._id === planId);

  const { data: quote, error: quoteError } = useQuery({
    queryKey: ['join-quote', f.branchId, planId, applied, f.referralCode],
    queryFn: () => publicApi.post('/join/quote', { branchId: f.branchId, planId, couponCode: applied || undefined, referralCode: f.referralCode || undefined }).then((r) => r.data.data),
    enabled: Boolean(f.branchId && plan && (!f.referralCode || f.referralCode.length >= 6)),
    retry: false,
  });

  async function sendCode() {
    setOtp({ ...otp, busy: true, error: '' });
    try {
      await publicApi.post('/join/otp', { phone: f.phone });
      setOtp({ sent: true, code: '', token: '', status: '', busy: false, error: '' });
    } catch (err) {
      setOtp({ ...otp, busy: false, error: errorMessage(err) });
    }
  }
  async function verifyCode() {
    setOtp({ ...otp, busy: true, error: '' });
    try {
      const r = (await publicApi.post('/join/otp/verify', { phone: f.phone, otp: otp.code })).data.data;
      setOtp({ ...otp, busy: false, token: r.token || '', status: r.status });
      if (r.name && !f.name) setF({ ...f, name: r.name, email: f.email || r.email || '' });
    } catch (err) {
      setOtp({ ...otp, busy: false, error: errorMessage(err) });
    }
  }

  async function payNow() {
    setPay({ busy: true, error: '', result: null });
    try {
      const order = (
        await publicApi.post('/join/order', {
          token: otp.token,
          branchId: f.branchId,
          planId,
          name: f.name,
          email: f.email,
          gender: f.gender,
          dob: f.dob,
          startDate: f.startDate,
          couponCode: applied || undefined,
          referralCode: f.referralCode || undefined,
        })
      ).data.data;
      const r = await openCheckout(order, { description: order.description });
      const result = (await publicApi.post('/join/pay/verify', r)).data.data;
      setPay({ busy: false, error: '', result });
    } catch (err) {
      if (err?.response?.data?.code === 'ALREADY_MEMBER') setOtp({ ...otp, status: 'member', token: '' });
      const msg = errorMessage(err);
      setPay({ busy: false, error: msg === 'Payment cancelled' ? 'Payment cancelled. Nothing was charged; you can try again.' : msg, result: null });
    }
  }

  if (pay.result) {
    const r = pay.result;
    return (
      <div className="py-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <p className="mt-3 text-lg font-semibold">Welcome, {r.member?.name?.split(' ')[0]}!</p>
        <p className="text-sm text-slate-600">Your membership is confirmed.</p>
        <dl className="mx-auto mt-4 max-w-xs space-y-1 rounded-xl bg-slate-50 p-3 text-left text-sm">
          <Row k="Member code" v={<b className="font-mono">#{r.member?.memberCode}</b>} />
          <Row k="Plan" v={r.membership?.plan} />
          <Row k="From" v={fmtDate(r.membership?.startDate)} />
          <Row k="Till" v={fmtDate(r.membership?.endDate)} />
          <Row k="Paid" v={inr(r.membership?.paid, { decimals: true })} />
        </dl>
        <p className="mt-3 text-xs text-slate-500">Show your member code at the reception on your first visit to set up gym entry.</p>
        <Link to={r.appPath || '/portal/login'} className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white">
          Open the member app
        </Link>
        <p className="mt-2 text-xs text-slate-500">Log in with your phone number and a one-time code.</p>
      </div>
    );
  }

  const verified = Boolean(otp.token);
  const canPay = verified && plan && quote && f.name.trim().length >= 2 && f.startDate && !pay.busy;
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <h2 className="text-lg font-semibold">Join online</h2>
      {branches.length > 1 && (
        <Field label="Branch">
          <Select value={f.branchId} onChange={(e) => (setF({ ...f, branchId: e.target.value }), setPlanId(''))}>
            <option value="">Choose…</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Plan">
        <Select value={plan ? planId : ''} onChange={(e) => setPlanId(e.target.value)} disabled={!f.branchId}>
          <option value="">{f.branchId ? 'Choose a plan…' : 'Choose a branch first'}</option>
          {branchPlans.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} · {inr(p.price)} + GST
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Phone" hint={verified ? undefined : 'We send a 6-digit code to check it is yours'}>
        <div className="flex gap-2">
          <Input value={f.phone} onChange={(e) => (setF({ ...f, phone: e.target.value }), setOtp({ sent: false, code: '', token: '', status: '', busy: false, error: '' }))} inputMode="tel" autoComplete="tel" disabled={verified} />
          {!verified && (
            <Button type="button" variant="secondary" disabled={!validPhone(f.phone)} loading={otp.busy && !otp.sent} onClick={sendCode} className="shrink-0">
              {otp.sent ? 'Send again' : 'Send code'}
            </Button>
          )}
        </div>
      </Field>
      {otp.sent && !verified && otp.status !== 'member' && (
        <Field label="Code from SMS">
          <div className="flex gap-2">
            <Input value={otp.code} onChange={(e) => setOtp({ ...otp, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" autoComplete="one-time-code" />
            <Button type="button" disabled={otp.code.length !== 6} loading={otp.busy} onClick={verifyCode} className="shrink-0">
              Verify
            </Button>
          </div>
        </Field>
      )}
      {otp.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{otp.error}</p>}
      {verified && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <ShieldCheck className="size-4" /> Phone verified{otp.status === 'trial' ? ': your trial pass becomes your membership' : ''}
        </p>
      )}
      {otp.status === 'member' ? (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">This number is already a member.</p>
          <p>Log in to the member app to renew your membership.</p>
          <Link to="/portal/login" className="mt-2 inline-block font-semibold text-brand-700 underline">
            Open the member app
          </Link>
        </div>
      ) : (
        <>
          <Field label="Full name">
            <Input value={f.name} onChange={set('name')} autoComplete="name" />
          </Field>
          <Field label="Email (optional)" hint="For your invoice">
            <Input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <Select value={f.gender} onChange={set('gender')}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={f.dob} onChange={set('dob')} max={ymd()} />
            </Field>
          </div>
          <Field label="Start date" hint="Today or within 30 days">
            <Input type="date" value={f.startDate} onChange={set('startDate')} min={ymd()} max={ymd(dayjs().add(30, 'day'))} />
          </Field>
          <Field label="Coupon (optional)">
            <div className="flex gap-2">
              <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} autoComplete="off" />
              <Button type="button" variant="secondary" onClick={() => setApplied(coupon.trim())} disabled={!coupon.trim()} className="shrink-0">
                Apply
              </Button>
            </div>
          </Field>
          {refOn && (
            <Field label="Referral code (optional)" hint="From a friend who is a member">
              <Input value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: cleanCode(e.target.value) })} autoComplete="off" className="font-mono uppercase" />
            </Field>
          )}
          {quoteError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage(quoteError)}</p>}
          {quote && plan && (
            <dl className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
              <Row k={plan.name} v={inr(quote.price)} />
              {quote.joiningFee > 0 && <Row k="Joining fee" v={inr(quote.joiningFee)} />}
              {quote.couponDiscount > 0 && <Row k={`Coupon ${quote.coupon?.code || ''}`} v={`- ${inr(quote.couponDiscount)}`} />}
              {quote.referralDiscount > 0 && <Row k="Referral discount" v={`- ${inr(quote.referralDiscount)}`} />}
              {quote.taxAmount > 0 && <Row k={`GST ${quote.taxPercent}%`} v={inr(quote.taxAmount, { decimals: true })} />}
              <Row k={<b>Total</b>} v={<b>{inr(quote.totalAmount, { decimals: true })}</b>} />
            </dl>
          )}
          {pay.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{pay.error}</p>}
          <Button type="button" className="w-full" size="lg" disabled={!canPay} loading={pay.busy} onClick={payNow}>
            {quote && plan ? `Pay ${inr(quote.totalAmount, { decimals: true })}` : 'Pay'}
          </Button>
          <p className="text-center text-xs text-slate-400">{verified ? 'UPI, cards and netbanking via Razorpay.' : 'Verify your phone to pay.'} Your membership is created only after the payment succeeds.</p>
        </>
      )}
    </form>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-slate-600">{k}</dt>
    <dd className="text-right">{v}</dd>
  </div>
);
