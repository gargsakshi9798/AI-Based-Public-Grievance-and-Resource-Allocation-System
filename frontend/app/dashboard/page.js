'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, StatusBadge, PriorityBadge } from '@/components/ui';
import { useAuth, hasRole } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { formatDate, labelize } from '@/lib/format';

function Kpi({ label, value }) {
  return (
    <div className="card kpi">
      <div className="lbl">{label}</div>
      <div className="num">{value ?? '—'}</div>
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
        const list = await api('/grievances?limit=6');
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

  return (
    <PortalShell>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="lead">Welcome, {user?.name}. Use the workspace according to your official role.</p>
        </div>
        <Link className="btn btn-primary" href="/grievances/new">Lodge grievance</Link>
      </div>
      {error && <Alert type="error">{error}</Alert>}

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

      {!stats && user && hasRole(user, ['citizen', 'officer', 'department_head']) && (
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="card">
            <h4>Your queue</h4>
            <p>Open the grievances list to filter by status, priority, and category.</p>
          </div>
          <div className="card">
            <h4>Notifications</h4>
            <p>Status changes and assignments appear under Notifications.</p>
          </div>
          <div className="card">
            <h4>Tracking</h4>
            <p>Share the GRV identity with the complainant for public tracking without login.</p>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent grievances</h3>
        {grievances.length === 0 ? (
          <div className="empty">No grievances to display.</div>
        ) : (
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
        )}
      </div>
    </PortalShell>
  );
}
