'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, hasRole } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/format';
import { Emblem, Tricolor } from '@/components/ui';

export default function PortalShell({ children, allowed }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (allowed && !hasRole(user, allowed)) {
      router.replace('/dashboard');
    }
  }, [ready, user, allowed, router]);

  useEffect(() => {
    if (!user) return;
    api('/notifications/unread-count')
      .then((d) => setUnread(d.data?.unreadCount ?? 0))
      .catch(() => {});
  }, [user, pathname]);

  if (!ready || !user) {
    return <div className="loading">Verifying session…</div>;
  }

  const staff = hasRole(user, ['officer', 'department_head', 'admin']);
  const admin = hasRole(user, ['admin']);
  const head = hasRole(user, ['admin', 'department_head']);

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/grievances', label: user.role === 'citizen' ? 'My grievances' : 'Grievances' },
    ...(user.role === 'citizen' || staff ? [{ href: '/grievances/new', label: 'Lodge grievance' }] : []),
    { href: '/track', label: 'Public tracking' },
    ...(staff ? [{ href: '/resources', label: 'Resources' }, { href: '/allocations', label: 'Allocations' }] : []),
    { href: '/departments', label: 'Departments' },
    ...(admin ? [
      { href: '/admin/users', label: 'User directory' },
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/operations', label: 'Operations' },
      { href: '/admin/audit', label: 'Audit log' },
      { href: '/admin/broadcast', label: 'Broadcast' },
    ] : []),
    { href: '/notifications', label: unread ? `Notifications (${unread})` : 'Notifications' },
    { href: '/profile', label: 'My profile' },
  ];

  return (
    <>
      <Tricolor />
      <div className="topbar">
        <div className="topbar-inner">
          <span>Secure official workspace · {roleLabel(user.role)}</span>
          <button className="btn btn-outline btn-sm" onClick={async () => { await logout(); router.push('/'); }}>Sign out</button>
        </div>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Emblem />
          <div className="brand">
            <p>Government of India</p>
            <h1>Grievance Redressal Workspace</h1>
            <p>Authorised personnel and registered citizens only</p>
          </div>
        </div>
      </header>
      <div className="portal">
        <aside className="sidebar">
          <div className="who">
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </div>
          <div className="group">Navigation</div>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              {l.label}
            </Link>
          ))}
          {head && <div className="group">Department heads may approve allocations and assign officers.</div>}
        </aside>
        <main id="main" className="main-pane">{children}</main>
      </div>
    </>
  );
}
