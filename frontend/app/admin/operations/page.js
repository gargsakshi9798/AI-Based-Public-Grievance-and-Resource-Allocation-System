'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, Pagination, PriorityBadge, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function OperationsPage() {
  const [breaches, setBreaches] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selected, setSelected] = useState([]);
  const [assign, setAssign] = useState({ assignedTo: '', departmentId: '' });
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    api('/admin/grievances/sla-breaches')
      .then((d) => setBreaches(d.data || []))
      .catch((err) => setError(err.message));
    api(`/admin/grievances/unassigned?page=${page}`)
      .then((d) => {
        setUnassigned(d.data || []);
        setPagination(d.pagination);
      })
      .catch((err) => setError(err.message));
  }, [page]);

  useEffect(() => {
    api('/users?role=officer&limit=100').then((d) => setUsers(d.data || [])).catch(() => {});
    api('/departments').then((d) => setDepartments(d.data || [])).catch(() => {});
  }, []);

  const toggle = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const bulk = async () => {
    setError('');
    setNote('');
    try {
      const d = await api('/admin/grievances/bulk-assign', {
        method: 'POST',
        body: JSON.stringify({
          grievanceIds: selected,
          assignedTo: assign.assignedTo || undefined,
          departmentId: assign.departmentId || undefined,
        }),
      });
      setNote(d.message);
      setSelected([]);
    } catch (err) {
      setError(err.message);
    }
  };

  const batch = async () => {
    try {
      const d = await api('/ai/batch-classify', { method: 'POST' });
      setNote(d.message || 'Batch classification accepted.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PortalShell allowed={['admin']}>
      <h2 className="page-title">Operations</h2>
      <p className="lead">SLA breaches, unassigned queue, bulk assignment, and batch AI classification.</p>
      {error && <Alert type="error">{error}</Alert>}
      {note && <Alert type="ok">{note}</Alert>}
      <p>
        <button className="btn btn-navy" onClick={batch}>Run batch AI classification</button>
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>SLA breaches</h3>
        {breaches.length === 0 ? <p className="muted">None recorded.</p> : (
          <table className="data">
            <thead>
              <tr>
                <th>Tracking ID</th>
                <th>Due</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {breaches.map((g) => (
                <tr key={g._id}>
                  <td><Link href={`/grievances/${g._id}`}>{g.trackingId}</Link></td>
                  <td>{formatDate(g.expectedResolutionDate)}</td>
                  <td><StatusBadge status={g.status} /></td>
                  <td><PriorityBadge priority={g.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Unassigned grievances</h3>
        <div className="row-2">
          <div className="field">
            <label>Officer</label>
            <select value={assign.assignedTo} onChange={(e) => setAssign({ ...assign, assignedTo: e.target.value })}>
              <option value="">Select</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Department</label>
            <select value={assign.departmentId} onChange={(e) => setAssign({ ...assign, departmentId: e.target.value })}>
              <option value="">Select</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" disabled={!selected.length} onClick={bulk}>Assign selected ({selected.length})</button>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th>Tracking ID</th>
                <th>Title</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((g) => (
                <tr key={g._id}>
                  <td><input type="checkbox" checked={selected.includes(g._id)} onChange={() => toggle(g._id)} /></td>
                  <td><Link href={`/grievances/${g._id}`}>{g.trackingId}</Link></td>
                  <td>{g.title}</td>
                  <td><PriorityBadge priority={g.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPage={setPage} />
      </div>
    </PortalShell>
  );
}
