'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export function Tricolor() {
  return (
    <div className="tricolor" aria-hidden="true">
      <span /><span /><span />
    </div>
  );
}

export function Emblem() {
  return (
    <div className="emblem" aria-hidden="true">
      <div className="emblem-wheel" />
    </div>
  );
}

export function PublicHeader() {
  const { user } = useAuth();
  const pathname = usePathname();
  const nav = [
    ['/', 'Home'],
    ['/track', 'Track Grievance'],
    ['/login', 'Citizen Login'],
    ['/register', 'Register'],
  ];

  return (
    <>
      <Tricolor />
      <div className="topbar">
        <div className="topbar-inner">
          <span>Government of India · Ministry of Public Grievances</span>
          <span>Helpline: 1800-11-1975 · Monday–Saturday, 09:00–18:00 IST</span>
        </div>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Emblem />
          <div className="brand">
            <p>भारत सरकार · Government of India</p>
            <h1>National Public Grievance Portal</h1>
            <p>AI-assisted classification, routing, and resource allocation</p>
          </div>
          <div className="header-actions">
            {user ? (
              <Link className="btn btn-primary" href="/dashboard">Enter dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-outline" href="/login">Sign in</Link>
                <Link className="btn btn-primary" href="/register">File as citizen</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <nav className="nav-public" aria-label="Primary">
        <ul>
          {nav.map(([href, label]) => (
            <li key={href}>
              <Link className={pathname === href ? 'active' : ''} href={href}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner footer-grid">
        <div>
          <h4>About this portal</h4>
          <p>
            This system enables citizens to lodge public grievances and enables departments
            to allocate staff, equipment, and budget with AI-assisted decision support.
            It is a demonstration implementation for academic and development use.
          </p>
        </div>
        <div>
          <h4>Quick links</h4>
          <p><Link href="/track">Track a complaint</Link></p>
          <p><Link href="/login">Officer / Admin login</Link></p>
          <p><Link href="/register">New citizen account</Link></p>
        </div>
        <div>
          <h4>Contact</h4>
          <p>Directorate of Public Grievances</p>
          <p>New Delhi — 110001</p>
          <p>support@grievance.gov.in</p>
        </div>
      </div>
      <div className="footer-inner copyright">
        <span>© {new Date().getFullYear()} National Public Grievance Portal. All rights reserved.</span>
        <span>Content is for authorised official use. Do not share credentials.</span>
      </div>
    </footer>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge st-${status}`}>{status?.replace(/_/g, ' ')}</span>;
}

export function PriorityBadge({ priority }) {
  return <span className={`badge pr-${priority}`}>{priority}</span>;
}

export function Alert({ type = 'info', children }) {
  return <div className={`alert alert-${type === 'error' ? 'error' : type === 'ok' ? 'ok' : 'info'}`}>{children}</div>;
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-ghost btn-sm" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Previous</button>
      <span className="muted">Page {pagination.page} of {pagination.pages} · {pagination.total} records</span>
      <button className="btn btn-ghost btn-sm" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>Next</button>
    </div>
  );
}
