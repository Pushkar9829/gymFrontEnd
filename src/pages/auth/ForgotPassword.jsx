import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api, errorMessage } from '../../lib/api';
import { Button, Field, Input } from '../../components/ui';
import { AuthShell } from './Login';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (step === 1) {
        await api.post('/auth/forgot-password', { email: form.email });
        toast.success('If the email is registered, a 6-digit code has been sent');
        setStep(2);
      } else {
        await api.post('/auth/reset-password', form);
        toast.success('Password updated. Please sign in.');
        navigate('/login');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" subtitle={step === 1 ? 'We will email you a 6-digit code' : `Enter the code sent to ${form.email}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} disabled={step === 2} required />
        </Field>
        {step === 2 && (
          <>
            <Field label="6-digit code">
              <Input inputMode="numeric" maxLength={6} value={form.otp} onChange={set('otp')} required />
            </Field>
            <Field label="New password" hint="At least 8 characters">
              <Input type="password" minLength={8} value={form.newPassword} onChange={set('newPassword')} required />
            </Field>
          </>
        )}
        <Button type="submit" loading={loading} className="w-full">
          {step === 1 ? 'Send code' : 'Update password'}
        </Button>
        <Link to="/login" className="block text-center text-sm text-slate-500 hover:underline">
          Back to login
        </Link>
      </form>
    </AuthShell>
  );
}
