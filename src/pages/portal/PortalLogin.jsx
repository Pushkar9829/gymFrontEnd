import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import clsx from 'clsx';
import { memberApi, errorMessage } from '../../lib/api';
import { useMemberAuth } from '../../store/auth';
import { Button, Field, Input } from '../../components/ui';
import { AuthShell } from '../auth/Login';

export default function PortalLogin() {
  const [mode, setMode] = useState('otp'); // otp | password
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ phone: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useMemberAuth((s) => s.setSession);
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run(fn) {
    setLoading(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const done = (r) => {
    setSession(r.data.data);
    navigate('/portal', { replace: true });
  };

  function submit(e) {
    e.preventDefault();
    if (mode === 'password') return run(async () => done(await memberApi.client.post('/auth/member/login', { phone: form.phone, password: form.password })));
    if (step === 1)
      return run(async () => {
        await memberApi.client.post('/auth/member/otp/send', { phone: form.phone });
        setInfo(`If ${form.phone} is registered with the gym, a 6-digit code has been sent.`);
        setStep(2);
      });
    return run(async () => done(await memberApi.client.post('/auth/member/otp/verify', { phone: form.phone, otp: form.otp })));
  }

  return (
    <AuthShell title="Member login" subtitle="Use the phone number registered at the gym">
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        {[
          ['otp', 'Login with code'],
          ['password', 'Password'],
        ].map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => (setMode(m), setStep(1), setError(''), setInfo(''))}
            className={clsx('rounded-md py-1.5', mode === m ? 'bg-white shadow-sm' : 'text-slate-500')}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Phone">
          <Input inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} disabled={mode === 'otp' && step === 2} required />
        </Field>
        {mode === 'password' && (
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} required />
          </Field>
        )}
        {mode === 'otp' && step === 2 && (
          <Field label="6-digit code">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.otp} onChange={set('otp')} autoFocus required />
          </Field>
        )}
        {info && !error && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">{info}</p>}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          {mode === 'otp' && step === 1 ? 'Send code' : 'Sign in'}
        </Button>
        {mode === 'otp' && step === 2 && (
          <button type="button" className="block w-full text-center text-sm text-brand-700" onClick={() => (setStep(1), setForm({ ...form, otp: '' }))}>
            Change number / resend code
          </button>
        )}
        <Link to="/login" className="block text-center text-sm text-slate-400 hover:underline">
          Staff login
        </Link>
      </form>
    </AuthShell>
  );
}
