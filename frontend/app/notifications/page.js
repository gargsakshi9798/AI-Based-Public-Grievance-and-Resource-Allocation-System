'use client';

import { useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, labelize } from '@/lib/format';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const load = () => {
    api('/notifications')
      .then((d) => {
        setItems(d.data || []);
        setUnread(d.unreadCount || 0);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  return (
    <PortalShell>
      <div className="toolbar">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="lead">{unread} unread.</p>
        </div>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => api('/notifications/read-all', { method: 'PATCH' }).then(load)}>Mark all read</button>
          {' '}
          <button className="btn btn-ghost btn-sm" onClick={() => {
            if (!window.confirm('Clear all notifications?')) return;
            api('/notifications/clear-all', { method: 'DELETE' }).then(load);
          }}>Clear all</button>
        </div>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {items.length === 0 && <div className="card empty">No notifications.</div>}
      {items.map((n) => (
        <div className="card" key={n._id} style={{ marginBottom: 10, opacity: n.isRead ? 0.75 : 1 }}>
          <strong>{n.title}</strong>
          <span className="badge pr-medium" style={{ marginLeft: 8 }}>{labelize(n.type)}</span>
          <p>{n.message}</p>
          <p className="muted">{formatDate(n.createdAt)}</p>
          {!n.isRead && (
            <button className="btn btn-ghost btn-sm" onClick={() => api(`/notifications/${n._id}/read`, { method: 'PATCH' }).then(load)}>Mark read</button>
          )}
          {' '}
          <button className="btn btn-ghost btn-sm" onClick={() => api(`/notifications/${n._id}`, { method: 'DELETE' }).then(load)}>Delete</button>
        </div>
      ))}
    </PortalShell>
  );
}
