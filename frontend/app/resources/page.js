'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Pagination } from '@/components/ui';
import { useAuth, hasRole } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { RESOURCE_TYPES } from '@/lib/constants';
import { displayName, labelize } from '@/lib/format';

export default function ResourcesPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, ['admin', 'department_head']);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type: 'equipment',
    department: '',
    description: '',
    total: 1,
  });

  const load = () => {
    api(`/resources?page=${page}&limit=15`)
      .then((d) => {
        setRows(d.data || []);
        setPagination(d.pagination);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [page]);
  useEffect(() => {
    api('/departments').then((d) => setDepartments(d.data || [])).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        type: form.type,
        department: form.department,
        description: form.description,
      };
      if (form.type === 'financial') {
        payload.budget = { total: Number(form.total), currency: 'INR' };
      } else {
        payload.quantity = { total: Number(form.total), available: Number(form.total), allocated: 0 };
      }
      await api('/resources', { method: 'POST', body: JSON.stringify(payload) });
      setForm({ ...form, name: '', description: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PortalShell allowed={['officer', 'department_head', 'admin']}>
      <h2 className="page-title">Government resources</h2>
      <p className="lead">Physical stock, personnel, facilities, and financial envelopes available for allocation.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Department</th>
              <th>Status</th>
              <th>Availability</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.name}</td>
                <td>{labelize(r.type)}</td>
                <td>{displayName(r.department)}</td>
                <td>{labelize(r.status)}</td>
                <td>
                  {r.type === 'financial'
                    ? `₹${r.budget?.allocated ?? 0} / ₹${r.budget?.total ?? 0}`
                    : `${r.quantity?.available ?? 0} of ${r.quantity?.total ?? 0} available`}
                </td>
                <td>
                  {hasRole(user, ['admin']) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (!window.confirm('Delete this resource?')) return;
                        api(`/resources/${r._id}`, { method: 'DELETE' }).then(load).catch((err) => setError(err.message));
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
        <Pagination pagination={pagination} onPage={setPage} />
      </div>

      {canWrite && (
        <form className="card form" style={{ marginTop: 16 }} onSubmit={create}>
          <h3>Add resource</h3>
          <div className="row-2">
            <div className="field">
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="row-2">
            <div className="field">
              <label>Department</label>
              <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Select</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{form.type === 'financial' ? 'Budget total (INR)' : 'Total quantity'}</label>
              <input type="number" min="1" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn btn-navy" type="submit">Create resource</button>
        </form>
      )}
    </PortalShell>
  );
}
