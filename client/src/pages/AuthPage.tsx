import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../store/auth';
import { Logo } from '../components/Logo';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === 'login' ? await api.login(email, password) : await api.signup(email, name, password);
      setUser(user);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-[0_20px_60px_-20px_rgba(22,24,29,0.25)]">
        <div className="mb-3">
          <Logo size={28} />
        </div>
        <p className="mb-6 text-sm text-gray-500">{mode === 'login' ? 'Log in to keep designing.' : 'Create a free account.'}</p>
        {mode === 'signup' && (
          <input className="mb-3 w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="mb-3 w-full rounded-lg border px-3 py-2.5 text-sm" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="mb-3 w-full rounded-lg border px-3 py-2.5 text-sm"
          type="password"
          placeholder="Password (6+ characters)"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
        <p className="mt-4 text-center text-sm text-gray-600">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="font-semibold text-brand" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}
