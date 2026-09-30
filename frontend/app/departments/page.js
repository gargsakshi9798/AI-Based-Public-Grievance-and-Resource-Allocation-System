'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import { useAuth, hasRole } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { CATEGORIES } from '@/lib/constants';
import { displayName, labelize } from '@/lib/format';

export default function DepartmentsPage() {
  const { user } = useAuth();
  const admin = hasRole(user, ['admin']);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '', contactEmail: '', handledCategories: [] });
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [headId, setHeadId] = useState('');
  const [users, setUsers] = useState([]);

  const load = () => {
    api('/departments')
      .then((d) => setRows(d.data || []))
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!admin) return;
    api('/users?limit=100').then((d) => setUsers(d.data || [])).catch(() => {});
  }, [admin]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/departments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          code: form.code.toUpperCase(),
        }),
      });
      setForm({ name: '', code: '', description: '', contactEmail: '', handledCategories: [] });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openStats = async (id) => {
    setSelected(id);
    if (!hasRole(user, ['admin', 'department_head'])) return;
    try {
      const d = await api(`/departments/${id}/stats`);
      setStats(d.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleCat = (value) => {
    const has = form.handledCategories.includes(value);
    setForm({
      ...form,
      handledCategories: has
        ? form.handledCategories.filter((c) => c !== value)
        : [...form.handledCategories, value],
    });
  };

  return (
    <PortalShell>
      <h2 className="page-title">Departments</h2>
      <p className="lead">Categories listed against a department are used for automatic routing.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Head</th>
              <th>Categories</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d._id}>
                <td>{d.code}</td>
                <td>{d.name}</td>
                <td>{displayName(d.head)}</td>
                <td>{(d.handledCategories || []).map(labelize).join(', ')}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openStats(d._id)}>View</button>
                  {admin && (
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 6 }}
                      onClick={() => {
                        if (!window.confirm('Delete this department?')) return;
                        api(`/departments/${d._id}`, { method: 'DELETE' }).then(load).catch((err) => setError(err.message));
                      }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Department statistics</h3>
          <p><strong>By status:</strong> {(stats.statusBreakdown || []).map((x) => `${labelize(x._id)} (${x.count})`).join(' · ')}</p>
          <p><strong>By priority:</strong> {(stats.priorityBreakdown || []).map((x) => `${labelize(x._id)} (${x.count})`).join(' · ')}</p>
        </div>
      )}

      {admin && selected && (
        <form
          className="card form"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            api(`/departments/${selected}/assign-head`, {
              method: 'PATCH',
              body: JSON.stringify({ userId: headId }),
            }).then(load).catch((err) => setError(err.message));
          }}
        >
          <h3>Assign department head</h3>
          <div className="field">
            <select required value={headId} onChange={(e) => setHeadId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <button className="btn btn-navy" type="submit">Assign head</button>
        </form>
      )}

      {admin && (
        <form className="card form" style={{ marginTop: 16 }} onSubmit={create}>
          <h3>Create department</h3>
          <div className="row-2">
            <div className="field">
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Code (2–10 uppercase)</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Contact email</label>
            <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          </div>
          <div className="field">
            <label>Handled categories</label>
            <div className="grid-3">
              {CATEGORIES.map((c) => (
                <label key={c.value}>
                  <input type="checkbox" checked={form.handledCategories.includes(c.value)} onChange={() => toggleCat(c.value)} /> {c.label}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-navy" type="submit">Create</button>
        </form>
      )}
    </PortalShell>
  );
}
