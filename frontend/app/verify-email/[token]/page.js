'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PublicFooter, PublicHeader, Alert } from '@/components/ui';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, ok: false, message: '' });

  useEffect(() => {
    api(`/auth/verify-email/${token}`, { auth: false })
      .then((d) => setState({ loading: false, ok: true, message: d.message }))
      .catch((err) => setState({ loading: false, ok: false, message: err.message }));
  }, [token]);

  return (
    <>
      <PublicHeader />
      <main id="main" className="wrap auth-shell">
        <div className="card">
          <h2 className="page-title">Email verification</h2>
          {state.loading && <p>Confirming your address…</p>}
          {!state.loading && <Alert type={state.ok ? 'ok' : 'error'}>{state.message}</Alert>}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
