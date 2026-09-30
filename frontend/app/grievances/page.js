'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Pagination, PriorityBadge, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { CATEGORIES, PRIORITIES, STATUSES } from '@/lib/constants';
import { formatDate, labelize } from '@/lib/format';

export default function GrievancesPage() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', category: '', page: 1 });
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', filters.page);
    params.set('limit', '10');
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.category) params.set('category', filters.category);
    api(`/grievances?${params}`)
      .then((d) => {
        setRows(d.data || []);
        setPagination(d.pagination);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [filters]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value, page: 1 });

  return (
    <PortalShell>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Grievance register</h2>
          <p className="lead">Visibility follows your role: citizens see their own filings; officers see assigned or departmental cases.</p>
        </div>
        <Link className="btn btn-primary" href="/grievances/new">Lodge new</Link>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="filters" style={{ marginBottom: 16 }}>
        <input placeholder="Search title or tracking ID" value={filters.search} onChange={set('search')} />
        <select value={filters.status} onChange={set('status')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
        </select>
        <select value={filters.priority} onChange={set('priority')}>
          <option value="">All priorities</option>
          {PRIORITIES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
        </select>
        <select value={filters.category} onChange={set('category')}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="card">
        {rows.length === 0 ? <div className="empty">No matching records.</div> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tracking ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g._id}>
                    <td><Link href={`/grievances/${g._id}`}>{g.trackingId}</Link></td>
                    <td>{g.title}</td>
                    <td>{labelize(g.category)}</td>
                    <td>{g.department?.name || '—'}</td>
                    <td><StatusBadge status={g.status} /></td>
                    <td><PriorityBadge priority={g.priority} /></td>
                    <td>{formatDate(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination pagination={pagination} onPage={(p) => setFilters({ ...filters, page: p })} />
      </div>
    </PortalShell>
  );
}
