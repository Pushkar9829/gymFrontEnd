import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Dumbbell, MapPin, Phone, Clock, CheckCircle2 } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { inr } from '../lib/format';
import { Button, Field, Input, PageLoader, Select, Textarea } from '../components/ui';

// Public page (no login): plans, classes and an enquiry form that creates a lead.
const publicApi = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api/v1/public` });

export default function Join() {
  const { data, isLoading } = useQuery({ queryKey: ['public-info'], queryFn: () => publicApi.get('/info').then((r) => r.data.data) });
  const [f, setF] = useState({ branchId: '', name: '', phone: '', email: '', interest: '', message: '', website: '' });
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  if (isLoading || !data) return <PageLoader />;
  const { gym, branches, plans, classTypes } = data;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, error: '' });
    try {
      await publicApi.post('/enquiry', { ...f, branchId: f.branchId || branches[0]?._id });
      setState({ busy: false, done: true, error: '' });
    } catch (err) {
      setState({ busy: false, done: false, error: errorMessage(err) });
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4 py-12 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2">
            {gym?.logoUrl ? <img src={gym.logoUrl} alt="" className="size-10 rounded-lg" /> : <span className="rounded-lg bg-brand-600 p-2"><Dumbbell className="size-6" /></span>}
            <h1 className="text-2xl font-bold">{gym?.name}</h1>
          </div>
          <p className="mt-3 max-w-xl text-white/80">Start your fitness journey today. Leave your details and our team will call you to book a free trial.</p>
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
                {plans.map((p) => (
                  <div key={p._id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-slate-500">
                      {p.durationValue} {p.durationUnit}
                      {p.durationValue > 1 ? 's' : ''}
                      {p.accessStart && ` · ${p.accessStart}–${p.accessEnd}`}
                    </p>
                    <p className="mt-2 text-xl font-bold text-brand-800">
                      {inr(p.price)} <span className="text-xs font-normal text-slate-500">+ GST</span>
                    </p>
                    {p.joiningFee > 0 && <p className="text-xs text-slate-500">+ {inr(p.joiningFee)} one-time joining fee</p>}
                  </div>
                ))}
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

        <aside className="md:col-span-2">
          <div className="sticky top-4 rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-200">
            {state.done ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
                <p className="mt-3 font-semibold">Thank you, {f.name.split(' ')[0]}!</p>
                <p className="text-sm text-slate-600">Our team will call you shortly.</p>
              </div>
            ) : (
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
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
