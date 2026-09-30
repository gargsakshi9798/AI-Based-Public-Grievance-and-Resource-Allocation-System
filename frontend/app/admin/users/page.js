'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Pagination } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLES } from '@/lib/constants';
import { labelize, roleLabel } from '@/lib/format';

export default function AdminUsersPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', page: 1 });
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);

  const load = () => {
    const q = new URLSearchParams({ page: filters.page, limit: 20 });
    if (filters.search) q.set('search', filters.search);
    if (filters.role) q.set('role', filters.role);
    api(`/users?${q}`)
      .then((d) => {
        setRows(d.data || []);
        setPagination(d.pagination);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [filters]);
  useEffect(() => {
    api('/departments').then((d) => setDepartments(d.data || [])).catch(() => {});
  }, []);

  const setRole = async (id, role, department) => {
    try {
      await api(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role, department: department || undefined }) });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PortalShell allowed={['admin']}>
      <h2 className="page-title">User directory</h2>
      <p className="lead">Promote officers, attach a department, or deactivate accounts. You cannot deactivate or delete your own account.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="filters" style={{ marginBottom: 12 }}>
        <input placeholder="Search name or email" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} />
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select defaultValue={u.role} onChange={(e) => setRole(u._id, e.target.value, u.department?._id || u.department)}>
                    {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    defaultValue={u.department?._id || ''}
                    onChange={(e) => setRole(u._id, u.role, e.target.value)}
                  >
                    <option value="">None</option>
                    {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </td>
                <td>{u.isActive ? 'Yes' : 'No'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => api(`/users/${u._id}/status`, { method: 'PATCH' }).then(load).catch((err) => setError(err.message))}>
                    Toggle status
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginLeft: 6 }}
                    onClick={() => {
                      if (!window.confirm('Permanently delete this user?')) return;
                      api(`/users/${u._id}`, { method: 'DELETE' }).then(load).catch((err) => setError(err.message));
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination pagination={pagination} onPage={(p) => setFilters({ ...filters, page: p })} />
      </div>
    </PortalShell>
  );
}
