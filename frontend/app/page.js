'use client';

import Link from 'next/link';
import { PublicFooter, PublicHeader } from '@/components/ui';

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main id="main">
        <section className="hero">
          <div className="wrap">
            <h2>A single window for public grievances and accountable resource use.</h2>
            <p>
              Lodge a complaint, receive a tracking identity, and follow its movement through
              department review, officer action, and resolution. Artificial intelligence assists
              classification, priority, routing, and resource suggestion — officers remain
              responsible for every decision.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/register">Register and lodge a grievance</Link>
              <Link className="btn btn-outline" href="/track">Track with GRV identity</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <h3>How the service works</h3>
            <p className="lead">Four official stages from filing to closure.</p>
            <div className="grid-4">
              <div className="card">
                <h4>1. Lodge</h4>
                <p>Submit title, description, category, location, and supporting documents (up to 5 files, 5 MB each).</p>
              </div>
              <div className="card">
                <h4>2. Classify</h4>
                <p>The system records a tracking ID such as GRV-2026-00001. AI proposes category, priority, and summary in the background.</p>
              </div>
              <div className="card">
                <h4>3. Route & allocate</h4>
                <p>The complaint is matched to a department. Officers may assign staff, equipment, or budget against an audit trail.</p>
              </div>
              <div className="card">
                <h4>4. Resolve</h4>
                <p>Status moves from pending to resolved or closed. Citizens may rate the outcome and follow comments (non-internal).</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <h3>Categories accepted</h3>
            <p className="lead">Select the closest official category at the time of filing.</p>
            <div className="grid-3">
              {[
                ['Infrastructure & roads', 'Potholes, drainage, public works'],
                ['Water & electricity', 'Supply interruption and utility faults'],
                ['Sanitation & environment', 'Waste, pollution, public hygiene'],
                ['Health & education', 'Facility access and service quality'],
                ['Safety & transport', 'Street lighting, traffic, public safety'],
                ['Welfare & integrity', 'Entitlements and corruption reports'],
              ].map(([t, d]) => (
                <div className="card" key={t}>
                  <h4>{t}</h4>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
