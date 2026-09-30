'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { Alert } from '@/components/ui';
import { api } from '@/lib/api';
import { CATEGORIES } from '@/lib/constants';

export default function NewGrievancePage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'infrastructure',
    subCategory: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    isAnonymous: false,
  });
  const [files, setFiles] = useState([]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      if (form.subCategory) fd.append('subCategory', form.subCategory);
      fd.append('isAnonymous', form.isAnonymous ? 'true' : 'false');
      fd.append('location', JSON.stringify({
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      }));
      [...files].slice(0, 5).forEach((file) => fd.append('attachments', file));
      const data = await api('/grievances', { method: 'POST', body: fd });
      router.push(`/grievances/${data.data._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalShell>
      <h2 className="page-title">Lodge a grievance</h2>
      <p className="lead">Title must be 10–200 characters. Description must be 20–5000 characters. Attachments: JPEG, PNG, GIF, PDF, DOC, DOCX, MP4, MOV — max 5 MB each, 5 files.</p>
      {error && <Alert type="error">{error}</Alert>}
      <form className="form card" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="title">Subject</label>
          <input id="title" required minLength={10} maxLength={200} value={form.title} onChange={set('title')} />
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="subCategory">Sub-category (optional)</label>
            <input id="subCategory" value={form.subCategory} onChange={set('subCategory')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Particulars of the grievance</label>
          <textarea id="description" required minLength={20} maxLength={5000} value={form.description} onChange={set('description')} />
        </div>
        <div className="field">
          <label htmlFor="address">Location — address</label>
          <input id="address" value={form.address} onChange={set('address')} />
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" value={form.city} onChange={set('city')} />
          </div>
          <div className="field">
            <label htmlFor="state">State / UT</label>
            <input id="state" value={form.state} onChange={set('state')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pincode">PIN code</label>
          <input id="pincode" value={form.pincode} onChange={set('pincode')} />
        </div>
        <div className="field">
          <label htmlFor="files">Supporting documents</label>
          <input id="files" type="file" multiple onChange={(e) => setFiles(e.target.files)} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={form.isAnonymous} onChange={set('isAnonymous')} /> File without displaying my name on public views where applicable
          </label>
        </div>
        <button className="btn btn-navy" disabled={busy} type="submit">{busy ? 'Submitting…' : 'Submit grievance'}</button>
      </form>
    </PortalShell>
  );
}
