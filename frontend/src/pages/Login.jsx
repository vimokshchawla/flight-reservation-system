import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Field, Input, cx } from '../components/ui';
import { useAuth } from '../context/AppContext';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', full_name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.username.trim()) er.username = 'Username is required';
    if (f.password.length < (mode === 'login' ? 1 : 6)) er.password = mode === 'login' ? 'Password is required' : 'At least 6 characters';
    if (mode === 'register') {
      if (f.full_name.trim().length < 2) er.full_name = 'Full name is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) er.email = 'Enter a valid email';
      if (f.phone && !/^\+?[0-9\s-]{10,15}$/.test(f.phone)) er.phone = 'Enter a valid phone number';
    }
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError(null);
    try {
      const s = mode === 'login' ? await login(f.username.trim(), f.password) : await register({ ...f, username: f.username.trim() });
      navigate(state?.from || (s.user.role === 'Admin' ? '/admin' : '/my-bookings'), { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="container-x grid min-h-[70vh] place-items-center py-12">
      <div className="w-full max-w-md">
        <h1 className="text-center font-display text-3xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-center text-sm text-ink-500">{mode === 'login' ? 'Sign in to manage bookings or open the admin dashboard.' : 'Your account is linked to your passenger profile by email.'}</p>
        <form onSubmit={submit} noValidate className="panel mt-8 space-y-4 p-6">
          <div className="grid grid-cols-2 rounded-xl bg-mist-100 p-1">
            {[['login', 'Sign in'], ['register', 'Register']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setMode(v); setError(null); setErrors({}); }} className={cx('rounded-lg py-2 text-sm font-semibold', mode === v ? 'bg-white shadow-sm' : 'text-ink-500')}>{l}</button>
            ))}
          </div>
          {mode === 'register' && (<>
            <Field label="Full name" error={errors.full_name}><Input value={f.full_name} error={errors.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="name" /></Field>
            <Field label="Email" error={errors.email}><Input type="email" value={f.email} error={errors.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></Field>
            <Field label="Phone (optional)" error={errors.phone}><Input type="tel" value={f.phone} error={errors.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" /></Field>
          </>)}
          <Field label="Username" error={errors.username}><Input value={f.username} error={errors.username} onChange={(e) => set('username', e.target.value)} autoComplete="username" /></Field>
          <Field label="Password" error={errors.password}><Input type="password" value={f.password} error={errors.password} onChange={(e) => set('password', e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" variant="primary" className="w-full" loading={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
        </form>
        {mode === 'login' && (
          <div className="mt-5 rounded-xl border border-dashed border-mist-300 p-4 text-sm text-ink-700">
            <p className="font-semibold">Demo accounts</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[['admin1', 'admin123', 'Administrator'], ['rahul01', 'rahul123', 'Passenger']].map(([u, p, r]) => (
                <button key={u} type="button" onClick={() => setF((x) => ({ ...x, username: u, password: p }))} className="rounded-lg bg-white px-3 py-2 text-left ring-1 ring-mist-200 hover:ring-ink-400">
                  <span className="block font-mono text-xs font-semibold">{u} / {p}</span><span className="text-xs text-ink-500">{r}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-sm"><Link to="/" className="font-semibold text-brand-600 hover:underline">← Back to flight search</Link></p>
      </div>
    </div>
  );
}
