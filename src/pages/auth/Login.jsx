import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Dumbbell } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { Button, Field, Input } from '../../components/ui';

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <span className="rounded-xl bg-brand-600 p-2">
            <Dumbbell className="size-6" />
          </span>
          <span className="text-xl font-semibold">Gym Manager</span>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mb-5 text-sm text-slate-500">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await api.post('/auth/login', form);
      setSession(r.data.data);
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Staff login" subtitle="Sign in with your email or phone">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email or phone">
          <Input autoFocus autoComplete="username" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-brand-700 hover:underline">
            Forgot password?
          </Link>
          <Link to="/portal/login" className="text-slate-500 hover:underline">
            Member login
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
