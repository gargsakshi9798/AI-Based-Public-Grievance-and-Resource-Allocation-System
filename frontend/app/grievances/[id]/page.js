'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert, PriorityBadge, StatusBadge } from '@/components/ui';
import { useAuth, hasRole } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PRIORITIES, STATUSES } from '@/lib/constants';
import { displayName, formatDate, idOf, labelize } from '@/lib/format';

export default function GrievanceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [g, setG] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [staff, setStaff] = useState({ status: '', priority: '', assignedTo: '', department: '', expectedResolutionDate: '' });
  const [departments, setDepartments] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [aiText, setAiText] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [alloc, setAlloc] = useState({ resourceId: '', quantityOrAmount: 1, purpose: '' });
  const [resources, setResources] = useState([]);

  const staffUser = hasRole(user, ['officer', 'department_head', 'admin']);
  const adminHead = hasRole(user, ['admin', 'department_head']);

  const load = useCallback(async () => {
    const data = await api(`/grievances/${id}`);
    setG(data.data);
    const d = data.data;
    setStaff({
      status: d.status || '',
      priority: d.priority || '',
      assignedTo: idOf(d.assignedTo),
      department: idOf(d.department),
      expectedResolutionDate: d.expectedResolutionDate ? String(d.expectedResolutionDate).slice(0, 10) : '',
    });
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  useEffect(() => {
    if (!staffUser) return;
    api('/departments').then((d) => setDepartments(d.data || [])).catch(() => {});
    api('/resources?limit=50').then((d) => setResources(d.data || [])).catch(() => {});
  }, [staffUser]);

  useEffect(() => {
    if (!adminHead || !staff.department) return;
    api(`/departments/${staff.department}/officers`)
      .then((d) => setOfficers(d.data || []))
      .catch(() => setOfficers([]));
  }, [adminHead, staff.department]);

  const run = async (fn) => {
    setError('');
    setNote('');
    try {
      await fn();
      setNote('Action completed.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!g) {
    return (
      <PortalShell>
        {error ? <Alert type="error">{error}</Alert> : <div className="loading">Loading dossier…</div>}
      </PortalShell>
    );
  }

  const comments = (g.comments || []).filter((c) => !c.isInternal || staffUser);
  const upvoted = (g.upvotes || []).some((u) => idOf(u) === user?._id || u === user?._id);

  return (
    <PortalShell>
      <div className="toolbar">
        <div>
          <p className="muted" style={{ margin: 0 }}>{g.trackingId}</p>
          <h2 className="page-title">{g.title}</h2>
        </div>
        <div>
          <StatusBadge status={g.status} /> <PriorityBadge priority={g.priority} />
        </div>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {note && <Alert type="ok">{note}</Alert>}

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Particulars</h3>
          <p>{g.description}</p>
          <p><strong>Category:</strong> {labelize(g.category)} {g.subCategory ? ` / ${g.subCategory}` : ''}</p>
          <p><strong>Citizen:</strong> {g.isAnonymous && !staffUser ? 'Anonymous' : displayName(g.citizen)}</p>
          <p><strong>Department:</strong> {displayName(g.department)}</p>
          <p><strong>Assigned officer:</strong> {displayName(g.assignedTo)}</p>
          <p><strong>Location:</strong> {[g.location?.address, g.location?.city, g.location?.state, g.location?.pincode].filter(Boolean).join(', ') || '—'}</p>
          <p><strong>Lodged:</strong> {formatDate(g.createdAt)} · <strong>Days open:</strong> {g.daysOpen ?? '—'}</p>
          <p>
            <button className="btn btn-ghost btn-sm" onClick={() => run(() => api(`/grievances/${id}/upvote`, { method: 'POST' }))}>
              {upvoted ? 'Remove support' : 'Support this grievance'} ({g.upvoteCount ?? g.upvotes?.length ?? 0})
            </button>
          </p>
          {g.attachments?.length > 0 && (
            <>
              <h4>Attachments</h4>
              <ul>
                {g.attachments.map((a) => (
                  <li key={a.filename}>
                    <a href={`/uploads/grievances/${a.filename}`} target="_blank" rel="noreferrer">{a.originalName || a.filename}</a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card ai-box">
          <h3 style={{ marginTop: 0 }}>AI assessment</h3>
          <p><strong>Processed:</strong> {g.aiProcessed ? 'Yes' : 'Pending'}</p>
          <p><strong>AI category:</strong> {labelize(g.aiCategory)}</p>
          <p><strong>AI priority:</strong> {labelize(g.aiPriority)}</p>
          <p><strong>Sentiment:</strong> {g.aiSentimentScore ?? '—'}</p>
          <p>{g.aiSummary || 'Summary will appear after classification.'}</p>
          {staffUser && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => run(async () => { await api(`/ai/classify/${id}`, { method: 'POST' }); })}>Re-classify</button>
              {adminHead && (
                <button className="btn btn-ghost btn-sm" onClick={() => run(async () => { await api(`/ai/route/${id}`, { method: 'POST' }); })}>Auto-route</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                try {
                  const d = await api(`/ai/duplicates/${id}`);
                  setDuplicates(d.data || []);
                  setAiText('');
                } catch (err) { setError(err.message); }
              }}>Find duplicates</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                try {
                  const d = await api(`/ai/resolve-suggestion/${id}`);
                  setAiText(d.data?.suggestion || '');
                } catch (err) { setError(err.message); }
              }}>Resolution plan</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                try {
                  const d = await api(`/resources/suggest/${id}`);
                  setSuggestions(d.data || []);
                } catch (err) { setError(err.message); }
              }}>Suggest resources</button>
            </div>
          )}
          {aiText && <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{aiText}</p>}
          {duplicates.length > 0 && (
            <ul>
              {duplicates.map((d) => (
                <li key={d.trackingId}>{d.trackingId} · score {d.similarityScore} · {d.reason}</li>
              ))}
            </ul>
          )}
          {suggestions?.length > 0 && (
            <ul>
              {(Array.isArray(suggestions) ? suggestions : []).map((s, i) => (
                <li key={i}>{JSON.stringify(s)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {staffUser && (
        <form
          className="card form"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/grievances/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: staff.status,
                priority: staff.priority,
                assignedTo: staff.assignedTo || null,
                department: staff.department || null,
                expectedResolutionDate: staff.expectedResolutionDate || undefined,
              }),
            }));
          }}
        >
          <h3 style={{ marginTop: 0 }}>Officer update</h3>
          <div className="row-2">
            <div className="field">
              <label>Status</label>
              <select value={staff.status} onChange={(e) => setStaff({ ...staff, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={staff.priority} onChange={(e) => setStaff({ ...staff, priority: e.target.value })}>
                {PRIORITIES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
              </select>
            </div>
          </div>
          <div className="row-2">
            <div className="field">
              <label>Department</label>
              <select value={staff.department} onChange={(e) => setStaff({ ...staff, department: e.target.value })}>
                <option value="">Unassigned</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.code})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Assigned officer</label>
              <select value={staff.assignedTo} onChange={(e) => setStaff({ ...staff, assignedTo: e.target.value })}>
                <option value="">Unassigned</option>
                {officers.map((o) => <option key={o._id} value={o._id}>{o.name} — {o.role}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Expected resolution date</label>
            <input type="date" value={staff.expectedResolutionDate} onChange={(e) => setStaff({ ...staff, expectedResolutionDate: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-navy" type="submit">Save official update</button>
            <button className="btn btn-ghost" type="button" onClick={() => run(() => api(`/grievances/${id}/escalate`, { method: 'POST' }))}>Escalate to critical</button>
          </div>
        </form>
      )}

      {staffUser && (
        <form
          className="card form"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api('/resources/allocate', {
              method: 'POST',
              body: JSON.stringify({
                resourceId: alloc.resourceId,
                grievanceId: id,
                quantityOrAmount: Number(alloc.quantityOrAmount),
                purpose: alloc.purpose,
              }),
            }));
          }}
        >
          <h3 style={{ marginTop: 0 }}>Allocate a resource</h3>
          <div className="row-2">
            <div className="field">
              <label>Resource</label>
              <select required value={alloc.resourceId} onChange={(e) => setAlloc({ ...alloc, resourceId: e.target.value })}>
                <option value="">Select</option>
                {resources.map((r) => <option key={r._id} value={r._id}>{r.name} ({r.type})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Quantity / amount</label>
              <input type="number" min="1" value={alloc.quantityOrAmount} onChange={(e) => setAlloc({ ...alloc, quantityOrAmount: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Purpose</label>
            <input required value={alloc.purpose} onChange={(e) => setAlloc({ ...alloc, purpose: e.target.value })} />
          </div>
          <button className="btn btn-navy" type="submit">Request allocation</button>
        </form>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Status history</h3>
        <ul className="timeline">
          {(g.statusHistory || []).map((h, i) => (
            <li key={i}>
              <strong>{labelize(h.status)}</strong>
              <div className="muted">{formatDate(h.createdAt)}{h.note ? ` · ${h.note}` : ''}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Correspondence</h3>
        {comments.length === 0 && <p className="muted">No public comments yet.</p>}
        {comments.map((c) => (
          <div key={c._id} className={`comment ${c.isInternal ? 'internal' : ''}`}>
            <strong>{displayName(c.author)}</strong>
            {c.isInternal && <span className="badge pr-high" style={{ marginLeft: 8 }}>Internal</span>}
            <div className="muted">{formatDate(c.createdAt)}</div>
            <p>{c.text}</p>
          </div>
        ))}
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(`/grievances/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ text: comment, isInternal: internal }),
              });
              setComment('');
            });
          }}
        >
          <div className="field">
            <label>Add comment</label>
            <textarea required maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {staffUser && (
            <label>
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (not visible to citizen)
            </label>
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-ghost" type="submit">Post comment</button>
          </div>
        </form>
      </div>

      {user?.role === 'citizen' && g.status === 'resolved' && !g.citizenRating && (
        <form
          className="card form"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/grievances/${id}/feedback`, {
              method: 'POST',
              body: JSON.stringify({ rating: Number(rating), feedback }),
            }));
          }}
        >
          <h3 style={{ marginTop: 0 }}>Satisfaction rating</h3>
          <div className="field">
            <label>Stars (1–5)</label>
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Remarks</label>
            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </div>
          <button className="btn btn-navy" type="submit">Submit feedback</button>
        </form>
      )}

      {g.citizenRating && (
        <p className="muted" style={{ marginTop: 16 }}>Citizen rating: {g.citizenRating}/5 — {g.citizenFeedback || 'No remarks'}</p>
      )}

      {(user?.role === 'admin' || (user?.role === 'citizen' && g.status === 'pending')) && (
        <p style={{ marginTop: 24 }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (!window.confirm('Delete this grievance permanently?')) return;
              run(async () => {
                await api(`/grievances/${id}`, { method: 'DELETE' });
                router.push('/grievances');
              });
            }}
          >
            Delete grievance
          </button>
        </p>
      )}
    </PortalShell>
  );
}
