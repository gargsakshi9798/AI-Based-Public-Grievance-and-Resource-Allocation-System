'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function AuditPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/audit-log')
      .then((d) => setRows(d.data || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <PortalShell allowed={['admin']}>
      <h2 className="page-title">Audit log</h2>
      <p className="lead">Each status change recorded on a grievance is expanded into a separate audit row.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Tracking ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Actor</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{formatDate(r.changedAt)}</td>
                <td>{r.trackingId}</td>
                <td>{r.title}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.actorName || '—'} {r.actorRole ? `(${r.actorRole})` : ''}</td>
                <td>{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
