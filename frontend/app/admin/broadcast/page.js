'use client';

import { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLES } from '@/lib/constants';
import { roleLabel } from '@/lib/format';

export default function BroadcastPage() {
  const [form, setForm] = useState({ title: '', message: '', targetRole: '' });
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNote('');
    try {
      const payload = { title: form.title, message: form.message };
      if (form.targetRole) payload.targetRole = form.targetRole;
      const d = await api('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNote(d.message);
      setForm({ title: '', message: '', targetRole: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PortalShell allowed={['admin']}>
      <h2 className="page-title">Official broadcast</h2>
      <p className="lead">Sends an in-app system alert to all active users, or to a single role.</p>
      {error && <Alert type="error">{error}</Alert>}
      {note && <Alert type="ok">{note}</Alert>}
      <form className="card form" onSubmit={submit}>
        <div className="field">
          <label>Title</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Message</label>
          <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </div>
        <div className="field">
          <label>Audience</label>
          <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}>
            <option value="">All active users</option>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
        <button className="btn btn-navy" type="submit">Send broadcast</button>
      </form>
    </PortalShell>
  );
}
