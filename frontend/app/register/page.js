'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PublicFooter, PublicHeader, Alert } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          country: 'India',
        },
      });
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
      <main id="main" className="wrap auth-shell" style={{ maxWidth: 640 }}>
        <div className="card">
          <h2 className="page-title">Citizen registration</h2>
          <p className="lead">Password must be at least 8 characters with uppercase, lowercase, and a number.</p>
          {error && <Alert type="error">{error}</Alert>}
          <form className="form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" required value={form.name} onChange={set('name')} />
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" required value={form.email} onChange={set('email')} />
              </div>
              <div className="field">
                <label htmlFor="phone">Mobile</label>
                <input id="phone" value={form.phone} onChange={set('phone')} placeholder="10-digit number" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required value={form.password} onChange={set('password')} />
            </div>
            <div className="field">
              <label htmlFor="street">Street / locality</label>
              <input id="street" value={form.street} onChange={set('street')} />
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="city">City</label>
                <input id="city" value={form.city} onChange={set('city')} />
              </div>
              <div className="field">
                <label htmlFor="state">State / UT</label>
                <input id="state" value={form.state} onChange={set('state')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pincode">PIN code</label>
              <input id="pincode" value={form.pincode} onChange={set('pincode')} />
            </div>
            <button className="btn btn-navy" disabled={busy} type="submit">{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
          <p className="muted" style={{ marginTop: 16 }}>Already registered? <Link href="/login">Sign in</Link></p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
