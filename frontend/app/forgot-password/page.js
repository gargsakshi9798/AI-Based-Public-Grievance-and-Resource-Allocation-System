'use client';

import { useState } from 'react';
import { PublicFooter, PublicHeader, Alert } from '@/components/ui';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
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
          <h2 className="page-title">Password recovery</h2>
          <p className="lead">If the email is registered, a reset link will be issued. For security, the response does not confirm whether an account exists.</p>
          {error && <Alert type="error">{error}</Alert>}
          {message && <Alert type="ok">{message}</Alert>}
          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-navy" disabled={busy} type="submit">{busy ? 'Submitting…' : 'Send reset link'}</button>
          </form>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
