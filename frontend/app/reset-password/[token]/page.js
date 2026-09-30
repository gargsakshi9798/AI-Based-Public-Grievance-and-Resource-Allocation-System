'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PublicFooter, PublicHeader, Alert } from '@/components/ui';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/auth/reset-password/${token}`, {
        method: 'PATCH',
        auth: false,
        body: JSON.stringify({ password }),
      });
      router.push('/login');
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
          <h2 className="page-title">Set a new password</h2>
          {error && <Alert type="error">{error}</Alert>}
          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="hint">Minimum 8 characters with uppercase, lowercase, and a number.</div>
            </div>
            <button className="btn btn-navy" disabled={busy} type="submit">{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
