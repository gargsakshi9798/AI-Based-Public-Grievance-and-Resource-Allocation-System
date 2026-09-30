'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { labelize } from '@/lib/format';

function Bars({ rows, labelKey = '_id', valueKey = 'count' }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey] || 0));
  return (
    <div>
      {rows.map((r) => (
        <div className="bar-row" key={String(r[labelKey])}>
          <span style={{ width: 140 }}>{labelize(r[labelKey] || r.departmentName || r.resourceName)}</span>
          <div className="bar"><span style={{ width: `${((r[valueKey] || r.submitted || 0) / max) * 100}%` }} /></div>
          <span>{r[valueKey] ?? r.submitted ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [g, setG] = useState(null);
  const [d, setD] = useState(null);
  const [r, setR] = useState(null);
  const [u, setU] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/admin/analytics/grievances'),
      api('/admin/analytics/departments'),
      api('/admin/analytics/resources'),
      api('/admin/analytics/users'),
    ])
      .then(([a, b, c, e]) => {
        setG(a.data);
        setD(b.data);
        setR(c.data);
        setU(e.data);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <PortalShell allowed={['admin']}>
      <h2 className="page-title">Analytics</h2>
      <p className="lead">Aggregated from the live operational database. Charts are rendered as proportional bars for official reporting.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="grid-2">
        <div className="card">
          <h3>By status</h3>
          {g?.byStatus && <Bars rows={g.byStatus} />}
        </div>
        <div className="card">
          <h3>By priority</h3>
          {g?.byPriority && <Bars rows={g.byPriority} />}
        </div>
        <div className="card">
          <h3>By category</h3>
          {g?.byCategory && <Bars rows={g.byCategory} />}
        </div>
        <div className="card">
          <h3>Users by role</h3>
          {u?.byRole && <Bars rows={u.byRole} />}
        </div>
        <div className="card">
          <h3>Resources by type</h3>
          {r?.byType && <Bars rows={r.byType} />}
        </div>
        <div className="card">
          <h3>Department caseload</h3>
          {g?.byDepartment && <Bars rows={g.byDepartment.map((x) => ({ _id: x.departmentName, count: x.count }))} />}
        </div>
      </div>
      {Array.isArray(d) && d.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Department performance</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total</th>
                  <th>Resolved</th>
                  <th>Rate</th>
                  <th>Avg hours</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {d.map((row) => (
                  <tr key={row._id}>
                    <td>{row.departmentName} ({row.departmentCode})</td>
                    <td>{row.total}</td>
                    <td>{row.resolved}</td>
                    <td>{row.resolutionRate}%</td>
                    <td>{row.avgResolutionHours ?? '—'}</td>
                    <td>{row.avgRating ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
