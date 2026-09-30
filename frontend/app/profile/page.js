'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/format';

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', street: '', city: '', state: '', pincode: '' });
  const [pass, setPass] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      street: user.address?.street || '',
      city: user.address?.city || '',
      state: user.address?.state || '',
      pincode: user.address?.pincode || '',
    });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api('/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            country: 'India',
          },
        }),
      });
      await reload();
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const d = await api('/auth/change-password', {
        method: 'PATCH',
        body: JSON.stringify(pass),
      });
      setMessage(d.message);
      setPass({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PortalShell>
      <h2 className="page-title">My profile</h2>
      <p className="lead">Role and email are controlled by the administrator and cannot be changed here.</p>
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type="ok">{message}</Alert>}
      <div className="card" style={{ marginBottom: 16 }}>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {roleLabel(user?.role)}</p>
        <p><strong>Email verified:</strong> {user?.isEmailVerified ? 'Yes' : 'No'}</p>
        <p><strong>Department:</strong> {user?.department?.name || '—'}</p>
      </div>
      <form className="card form" onSubmit={saveProfile}>
        <h3 style={{ marginTop: 0 }}>Particulars</h3>
        <div className="row-2">
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Street</label>
          <input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
        </div>
        <div className="row-2">
          <div className="field">
            <label>City</label>
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="field">
            <label>State</label>
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>PIN code</label>
          <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
        </div>
        <button className="btn btn-navy" type="submit">Save profile</button>
      </form>
      <form className="card form" style={{ marginTop: 16 }} onSubmit={changePassword}>
        <h3 style={{ marginTop: 0 }}>Change password</h3>
        <div className="field">
          <label>Current password</label>
          <input type="password" required value={pass.currentPassword} onChange={(e) => setPass({ ...pass, currentPassword: e.target.value })} />
        </div>
        <div className="field">
          <label>New password</label>
          <input type="password" required value={pass.newPassword} onChange={(e) => setPass({ ...pass, newPassword: e.target.value })} />
        </div>
        <button className="btn btn-navy" type="submit">Update password</button>
      </form>
    </PortalShell>
  );
}
