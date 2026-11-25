'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, StatusBadge, PriorityBadge } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

function Kpi({ label, value }) {
  return (
    <div className="card kpi">
      <div className="lbl">{label}</div>
      <div className="num">{value ?? '—'}</div>
    </div>
  );
}

function RecentTable({ grievances }) {
  if (grievances.length === 0) return <div className="empty">No grievances to display.</div>;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Tracking ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Lodged</th>
          </tr>
        </thead>
        <tbody>
          {grievances.map((g) => (
            <tr key={g._id}>
              <td><Link href={`/grievances/${g._id}`}>{g.trackingId}</Link></td>
              <td>{g.title}</td>
              <td><StatusBadge status={g.status} /></td>
              <td><PriorityBadge priority={g.priority} /></td>
              <td>{formatDate(g.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const list = await api('/grievances?limit=8');
        setGrievances(list.data || []);
        if (user.role === 'admin') {
          const dash = await api('/admin/dashboard');
          setStats(dash.data);
        }
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [user]);

  const pending = grievances.filter((g) => ['pending', 'under_review'].includes(g.status)).length;
  const inProgress = grievances.filter((g) => g.status === 'in_progress').length;
  const resolved = grievances.filter((g) => g.status === 'resolved').length;

  return (
    <PortalShell>
      {error && <Alert type="error">{error}</Alert>}

      {user?.role === 'citizen' && (
        <>
          <div className="toolbar">
            <div>
              <h2 className="page-title">Citizen dashboard</h2>
              <p className="lead">Lodge a complaint, note the GRV tracking identity, and follow status from submitted to resolved.</p>
            </div>
            <Link className="btn btn-primary" href="/grievances/new">Lodge grievance</Link>
          </div>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            <Kpi label="My filings" value={grievances.length} />
            <Kpi label="Open / review" value={pending} />
            <Kpi label="Resolved" value={resolved} />
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>My recent complaints</h3>
            <RecentTable grievances={grievances} />
          </div>
        </>
      )}

      {(user?.role === 'officer' || user?.role === 'department_head') && (
        <>
          <div className="toolbar">
            <div>
              <h2 className="page-title">{user.role === 'department_head' ? 'Department head dashboard' : 'Officer dashboard'}</h2>
              <p className="lead">Review assigned complaints, update progress, add resolution details, and allocate resources.</p>
            </div>
            <Link className="btn btn-navy" href="/grievances">Open queue</Link>
          </div>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            <Kpi label="Visible cases" value={grievances.length} />
            <Kpi label="In progress" value={inProgress} />
            <Kpi label="Pending review" value={pending} />
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Assigned / departmental complaints</h3>
            <RecentTable grievances={grievances} />
          </div>
        </>
      )}

      {user?.role === 'admin' && (
        <>
          <div className="toolbar">
            <div>
              <h2 className="page-title">Administrator dashboard</h2>
              <p className="lead">Monitor classification, allocation, users, departments, and system-wide performance.</p>
            </div>
            <Link className="btn btn-primary" href="/admin/analytics">Reports</Link>
          </div>
          {stats && (
            <>
              <div className="grid-4">
                <Kpi label="Total grievances" value={stats.grievances?.total} />
                <Kpi label="Pending" value={stats.grievances?.pending} />
                <Kpi label="In progress" value={stats.grievances?.inProgress} />
                <Kpi label="Resolved" value={stats.grievances?.resolved} />
                <Kpi label="Critical open" value={stats.grievances?.critical} />
                <Kpi label="Resolution rate" value={`${stats.grievances?.resolutionRate ?? 0}%`} />
                <Kpi label="Registered users" value={stats.users?.total} />
                <Kpi label="Pending allocations" value={stats.resources?.pendingAllocations} />
              </div>
              <p className="muted" style={{ margin: '12px 0 24px' }}>
                Average resolution (30 days): {stats.performance?.avgResolutionTimeHours ?? '—'} hours ·
                Citizen rating: {stats.performance?.avgSatisfactionRating ?? '—'} / 5
              </p>
            </>
          )}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Latest complaints</h3>
            <RecentTable grievances={grievances} />
          </div>
        </>
      )}
    </PortalShell>
  );
}
