'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PublicFooter, PublicHeader, Alert } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PublicHeader />
      <main id="main" className="wrap auth-shell">
        <div className="card">
          <h2 className="page-title">Secure sign-in</h2>
          <p className="lead">Citizens, officers, department heads, and administrators use this form.</p>
          {error && <Alert type="error">{error}</Alert>}
          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Registered email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="btn btn-navy" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="muted" style={{ marginTop: 16 }}>
            <Link href="/forgot-password">Forgot password?</Link>
            {' · '}
            <Link href="/register">Create citizen account</Link>
          </p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
