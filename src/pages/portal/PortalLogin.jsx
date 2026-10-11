import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { memberApi, errorMessage } from '../../lib/api';
import { useMemberAuth } from '../../store/auth';
import { Button, Field, Input } from '../../components/ui';
import { AuthShell } from '../auth/Login';

export default function PortalLogin() {
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useMemberAuth((s) => s.setSession);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await memberApi.client.post('/auth/member/login', form);
      setSession(r.data.data);
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Member login" subtitle="Use the phone number registered at the gym">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Phone">
          <Input inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
        <p className="text-center text-xs text-slate-500">Don&apos;t have a password? Ask at the reception.</p>
        <Link to="/login" className="block text-center text-sm text-slate-400 hover:underline">
          Staff login
        </Link>
      </form>
    </AuthShell>
  );
}
