'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Pagination, StatusBadge } from '@/components/ui';
import { useAuth, hasRole } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { displayName, formatDate, labelize } from '@/lib/format';

export default function AllocationsPage() {
  const { user } = useAuth();
  const canApprove = hasRole(user, ['admin', 'department_head']);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = () => {
    const q = new URLSearchParams({ page, limit: 15 });
    if (status) q.set('status', status);
    api(`/resources/allocations/list?${q}`)
      .then((d) => {
        setRows(d.data || []);
        setPagination(d.pagination);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [page, status]);

  return (
    <PortalShell allowed={['officer', 'department_head', 'admin']}>
      <h2 className="page-title">Resource allocations</h2>
      <p className="lead">Every assignment is retained as an audit record even after release.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="filters" style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['pending_approval', 'approved', 'active', 'completed', 'cancelled'].map((s) => (
            <option key={s} value={s}>{labelize(s)}</option>
          ))}
        </select>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Grievance</th>
              <th>Qty / amount</th>
              <th>Status</th>
              <th>By</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id}>
                <td>{displayName(a.resource)}</td>
                <td>{a.grievance?.trackingId || '—'}</td>
                <td>{a.quantityOrAmount}</td>
                <td><StatusBadge status={a.status} /></td>
                <td>{displayName(a.allocatedBy)}</td>
                <td>{formatDate(a.createdAt)}</td>
                <td>
                  {canApprove && a.status === 'pending_approval' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => api(`/resources/allocations/${a._id}/approve`, { method: 'PATCH' }).then(load).catch((err) => setError(err.message))}>Approve</button>
                  )}
                  {['approved', 'active', 'pending_approval'].includes(a.status) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => api(`/resources/allocations/${a._id}/release`, { method: 'PATCH' }).then(load).catch((err) => setError(err.message))}>Release</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination pagination={pagination} onPage={setPage} />
      </div>
    </PortalShell>
  );
}
