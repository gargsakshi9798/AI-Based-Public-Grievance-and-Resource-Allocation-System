'use client';

import { useState } from 'react';
import { PublicFooter, PublicHeader, Alert, StatusBadge, PriorityBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, labelize } from '@/lib/format';
import { STATUS_FLOW } from '@/lib/constants';

export default function TrackPage() {
  const [trackingId, setTrackingId] = useState('');
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    setError('');
    setRecord(null);
    setBusy(true);
    try {
      const id = trackingId.trim().toUpperCase();
      const data = await api(`/grievances/track/${encodeURIComponent(id)}`, { auth: false });
      setRecord(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const current = record?.status;
  const idx = STATUS_FLOW.indexOf(current);

  return (
    <>
      <PublicHeader />
      <main id="main" className="wrap" style={{ padding: '32px 0 48px' }}>
        <h2 className="page-title">Public grievance tracking</h2>
        <p className="lead">Enter the tracking identity printed on your acknowledgement (for example GRV-2026-00001). Login is not required.</p>
        <div className="card" style={{ maxWidth: 640 }}>
          {error && <Alert type="error">{error}</Alert>}
          <form className="form" onSubmit={search}>
            <div className="field">
              <label htmlFor="tid">Tracking identity</label>
              <input id="tid" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="GRV-YYYY-NNNNN" required />
            </div>
            <button className="btn btn-navy" disabled={busy} type="submit">{busy ? 'Searching…' : 'Track'}</button>
          </form>
        </div>

        {record && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="toolbar">
              <div>
                <h3 style={{ margin: 0 }}>{record.trackingId}</h3>
                <p className="muted">{record.title}</p>
              </div>
              <div>
                <StatusBadge status={record.status} /> {' '}
                <PriorityBadge priority={record.priority} />
              </div>
            </div>
            <p><strong>Category:</strong> {labelize(record.category)}</p>
            <p><strong>Department:</strong> {record.department?.name || 'Not yet assigned'}</p>
            <p><strong>Lodged on:</strong> {formatDate(record.createdAt)}</p>
            <p><strong>Expected resolution:</strong> {formatDate(record.expectedResolutionDate)}</p>
            <div className="steps">
              {STATUS_FLOW.map((s, i) => (
                <div key={s} className={`step ${current === 'rejected' ? '' : i < idx ? 'done' : i === idx ? 'now' : ''}`}>
                  {s.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
            {current === 'rejected' && <Alert type="error">This grievance has been rejected. Contact the department for particulars.</Alert>}
            {record.statusHistory?.length > 0 && (
              <>
                <h4>Status history</h4>
                <ul className="timeline">
                  {record.statusHistory.map((h, i) => (
                    <li key={i}>
                      <strong>{labelize(h.status)}</strong>
                      <div className="muted">{formatDate(h.createdAt)}{h.note ? ` · ${h.note}` : ''}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
