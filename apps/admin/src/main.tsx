import { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { authStorage, getAdmin, signIn, signOut, updateAdmin } from './lib/api';
import { formatCurrency, titleCase } from './lib/format';
import type { AuthUser } from './types';
import './style.css';

type Booking = {
  id: string;
  service: string;
  status: string;
  date: string;
  time: string;
  cancellationReason?: string;
  cancelledBy?: string;
  customer?: { name: string; email?: string };
  professional?: { businessName: string; name?: string };
  payment?: { id: string; amount: number; status: string; transactionId?: string };
};

type Professional = {
  id: string;
  name: string;
  businessName: string;
  category: string;
  verified: boolean;
  rating: number;
  email: string;
  completedJobs?: number;
};

type Dispute = {
  id: string;
  reason: string;
  description: string;
  status: string;
  reporter: { name: string };
  booking: { service: string };
};

type Overview = {
  metrics: {
    professionalCount: number;
    bookingCount: number;
    pendingVerificationCount: number;
    grossMerchandiseValue: number;
  };
  recentBookings: Booking[];
  pendingProfessionals: Professional[];
  openDisputes: Dispute[];
};

function Login({ onSignedIn }: { onSignedIn: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('admin@opustia.demo');
  const [password, setPassword] = useState('demo123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(await signIn(email, password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand dark">✦ opustia</div>
        <p className="eyebrow">CONTROL CENTER</p>
        <h1>Admin Sign In</h1>
        <p>Manage marketplace operations, verification & dispute resolution.</p>
        <label>
          Admin Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="admin@opustia.demo"
          />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error && <div className="notice error">{error}</div>}
        <button disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in to Dashboard ➔'}
        </button>
        <small>Demo Credentials: admin@opustia.demo / demo123</small>
      </form>
    </div>
  );
}

const ADMIN_CANCEL_REASONS = [
  'Administrative cancellation',
  'Customer violation or fraud',
  'Requested by customer via support',
  'Professional unresponsiveness / No-show',
  'Pricing or dispute resolution',
  'Other',
] as const;

function CancelModal({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [selectedReason, setSelectedReason] = useState<string>('Administrative cancellation');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const finalReason = selectedReason === 'Other' ? customReason.trim() || 'Other reason' : selectedReason;
      await onConfirm(finalReason);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to cancel booking.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon">✕</div>
          <div className="modal-title">
            <h2>Cancel Booking</h2>
            <p>
              Are you sure you want to cancel the booking for <b>{booking.service}</b>?
            </p>
          </div>
        </div>

        <div className="modal-body">
          {error && <div className="notice error">{error}</div>}
          <label htmlFor="cancel-reason-select">Select cancellation reason</label>
          <select
            id="cancel-reason-select"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
          >
            {ADMIN_CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {selectedReason === 'Other' && (
            <>
              <label htmlFor="cancel-reason-text">Custom reason details</label>
              <textarea
                id="cancel-reason-text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain the reason for this administrative cancellation..."
              />
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            Keep booking
          </button>
          <button className="btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<'overview' | 'bookings' | 'professionals' | 'disputes' | 'legal'>('overview');
  const [items, setItems] = useState<{
    bookings: Booking[];
    professionals: Professional[];
    disputes: Dispute[];
  }>({ bookings: [], professionals: [], disputes: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, bookings, professionals, disputes] = await Promise.all([
        getAdmin<Overview>('overview'),
        getAdmin<{ items: Booking[] }>('bookings'),
        getAdmin<{ items: Professional[] }>('professionals'),
        getAdmin<{ items: Dispute[] }>('disputes'),
      ]);
      setData(overview);
      setItems({
        bookings: bookings.items,
        professionals: professionals.items,
        disputes: disputes.items,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const verify = async (professional: Professional) => {
    await updateAdmin('professionals', professional.id, { verified: true });
    await load();
  };

  const resolve = async (dispute: Dispute) => {
    await updateAdmin('disputes', dispute.id, { status: 'RESOLVED' });
    await load();
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!cancelTarget) return;
    await updateAdmin('bookings', cancelTarget.id, { status: 'CANCELLED', reason });
    setCancelTarget(null);
    await load();
  };

  const nav = [
    ['overview', '📊 Overview'],
    ['bookings', '📅 Bookings'],
    ['professionals', '🛠️ Professionals'],
    ['disputes', '⚠️ Disputes'],
    ['legal', '⚖️ Legal & Support'],
  ] as const;

  const metricCards = data
    ? [
        ['Active Professionals', data.metrics.professionalCount, 'Verified partners'],
        ['Total Bookings', data.metrics.bookingCount, 'All-time requests'],
        ['Pending Verification', data.metrics.pendingVerificationCount, 'Review required'],
        ['Gross Volume', formatCurrency(data.metrics.grossMerchandiseValue), 'Processed volume'],
      ]
    : [];

  return (
    <div className="shell">
      <aside>
        <div className="brand">opustia</div>
        <div className="muted">CONTROL CENTER</div>
        {nav.map(([id, label]) => (
          <button
            className={`nav ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id as any)}
            key={id}
          >
            {label}
          </button>
        ))}

        <div className="user">
          <b>{user.name || 'Administrator'}</b>
          <small>{user.email}</small>
          <button
            className="signout"
            onClick={async () => {
              await signOut();
              onSignOut();
            }}
          >
            Sign out ➔
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="eyebrow">OPUSTIA MARKETPLACE ADMINISTRATION</div>
            <h1>
              {tab === 'overview'
                ? 'Marketplace Overview'
                : tab === 'legal'
                ? 'Corporate, Legal & Support'
                : titleCase(tab)}
            </h1>
            <p>Live operational data synced from Opustia database.</p>
          </div>
          <button onClick={() => void load()}>↻ Refresh Data</button>
        </header>

        {error && <div className="notice error">{error}</div>}

        {loading ? (
          <div className="loading">Fetching dashboard data…</div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <section className="stats">
                  {metricCards.map(([label, value, sub]) => (
                    <div className="card" key={String(label)}>
                      <div className="muted">{label}</div>
                      <strong>{value}</strong>
                      <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        {sub}
                      </small>
                    </div>
                  ))}
                </section>

                <section className="grid">
                  <div className="panel">
                    <div className="panelhead">
                      <h2>Recent Bookings</h2>
                      <button className="link" onClick={() => setTab('bookings')}>
                        View all ➔
                      </button>
                    </div>
                    <BookingTable items={data?.recentBookings || []} onCancel={setCancelTarget} />
                  </div>

                  <div className="panel">
                    <div className="panelhead">
                      <h2>Verification Queue</h2>
                      <button className="link" onClick={() => setTab('professionals')}>
                        View all ➔
                      </button>
                    </div>
                    {data?.pendingProfessionals.length ? (
                      data.pendingProfessionals.map((pro) => (
                        <ProfessionalRow key={pro.id} pro={pro} onVerify={verify} />
                      ))
                    ) : (
                      <Empty text="No professionals waiting for verification review." />
                    )}
                  </div>
                </section>

                <div className="panel">
                  <div className="panelhead">
                    <h2>Open Disputes & Support Cases</h2>
                    <button className="link" onClick={() => setTab('disputes')}>
                      View all ➔
                    </button>
                  </div>
                  {data?.openDisputes.length ? (
                    data.openDisputes.map((dispute) => (
                      <DisputeRow key={dispute.id} dispute={dispute} onResolve={resolve} />
                    ))
                  ) : (
                    <Empty text="No active dispute cases." />
                  )}
                </div>
              </>
            )}

            {tab === 'bookings' && (
              <div className="panel">
                <div className="panelhead">
                  <h2>All Marketplace Bookings ({items.bookings.length})</h2>
                </div>
                <BookingTable items={items.bookings} onCancel={setCancelTarget} />
              </div>
            )}

            {tab === 'professionals' && (
              <div className="panel">
                <div className="panelhead">
                  <h2>Service Professionals ({items.professionals.length})</h2>
                </div>
                {items.professionals.map((pro) => (
                  <ProfessionalRow key={pro.id} pro={pro} onVerify={verify} />
                ))}
              </div>
            )}

            {tab === 'disputes' && (
              <div className="panel">
                <div className="panelhead">
                  <h2>Support Claims & Disputes ({items.disputes.length})</h2>
                </div>
                {items.disputes.length ? (
                  items.disputes.map((dispute) => (
                    <DisputeRow key={dispute.id} dispute={dispute} onResolve={resolve} />
                  ))
                ) : (
                  <Empty text="No disputes filed yet." />
                )}
              </div>
            )}

            {tab === 'legal' && (
              <div className="panel">
                <div className="panelhead">
                  <h2>Registered Corporate Entity & Compliance Standards</h2>
                </div>
                <div style={{ padding: '8px 0', lineHeight: '1.6' }}>
                  <div
                    style={{
                      background: '#f0fdfa',
                      border: '1px solid #ccfbf1',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '20px',
                    }}
                  >
                    <h3 style={{ margin: '0 0 8px', color: '#0f766e', fontSize: '18px' }}>
                      Opustia Technologies India Private Limited
                    </h3>
                    <p style={{ margin: '4px 0', color: '#134e4a' }}>
                      <b>Corporate ID (CIN):</b> U72900KA2024PTC184920 · <b>GSTIN:</b> 29AAFCO1234M1Z5
                    </p>
                    <p style={{ margin: '4px 0', color: '#134e4a' }}>
                      <b>Registered Headquarters:</b> 4th Floor, Salarpuria Citadel, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka – 560038, India
                    </p>
                    <p style={{ margin: '4px 0', color: '#134e4a', fontSize: '13px' }}>
                      <b>Operational Cities:</b> Bengaluru (HQ), Mumbai, Delhi NCR, Hyderabad, Chennai, Pune
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                      }}
                    >
                      <h4 style={{ margin: '0 0 10px', color: '#0f172a' }}>📞 Customer Helplines</h4>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        Toll-Free: <b>1800-889-OPUS</b> (1800-889-6787)
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        WhatsApp Desk: <b>+91 98765 43210</b>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        Support Email: <b>support@opustia.com</b>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        Billing Desk: <b>billing@opustia.com</b>
                      </p>
                      <small style={{ color: '#64748b', display: 'block', marginTop: '6px' }}>
                        Hours: Mon–Sun, 7:00 AM – 11:00 PM IST
                      </small>
                    </div>

                    <div
                      style={{
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '12px',
                        padding: '18px',
                      }}
                    >
                      <h4 style={{ margin: '0 0 10px', color: '#0369a1' }}>
                        🏛️ Designated Grievance Redressal Officer
                      </h4>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        Officer: <b>Rajeshwar Rao</b>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#0284c7' }}>
                        Head of Trust, Safety & Grievance Redressal
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        Direct Email: <b>grievance-officer@opustia.com</b>
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px' }}>
                        Phone: <b>+91 80 4567 8910</b>
                      </p>
                      <small style={{ color: '#0369a1', display: 'block', marginTop: '6px' }}>
                        Rule 5(9) Consumer Protection (E-Commerce) Rules, 2020 SLA: Acknowledged in 48h, resolved in 30 days.
                      </small>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '18px',
                    }}
                  >
                    <h4 style={{ margin: '0 0 8px', color: '#0f172a' }}>📜 Statutory Policies In Effect</h4>
                    <p style={{ margin: '3px 0', fontSize: '13px', color: '#334155' }}>
                      • <b>Terms of Service:</b> v2026.1 (IT Act 2000 Section 79 Intermediary Terms; Jurisdiction: Bengaluru, Karnataka)
                    </p>
                    <p style={{ margin: '3px 0', fontSize: '13px', color: '#334155' }}>
                      • <b>Data Privacy Policy:</b> DPDP Act 2023 Compliant (AES-256 at rest, TLS 1.3 in transit, Zero plain card storage)
                    </p>
                    <p style={{ margin: '3px 0', fontSize: '13px', color: '#334155' }}>
                      • <b>Cancellation & Refund Policy:</b> 100% Free cancellation before arrival; refunds credited in 24h–7 days
                    </p>
                    <p style={{ margin: '3px 0', fontSize: '13px', color: '#334155' }}>
                      • <b>Service Protection Guarantee:</b> Mandatory 30-Day Workmanship Warranty with free inspection & rework
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}

function BookingTable({
  items,
  onCancel,
}: {
  items: Booking[];
  onCancel?: (booking: Booking) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = items.filter((b) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      b.service.toLowerCase().includes(q) ||
      (b.customer?.name || '').toLowerCase().includes(q) ||
      (b.professional?.businessName || '').toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q)
    );
  });

  return items.length ? (
    <div>
      <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter bookings by service, customer, professional, or status..."
          style={{
            flex: 1,
            padding: '9px 14px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        {query && (
          <button
            className="link"
            onClick={() => setQuery('')}
            style={{ fontSize: '12px' }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Customer</th>
              <th>Professional</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Payment</th>
              {onCancel && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <b>{booking.service}</b>
                  {booking.status === 'CANCELLED' && booking.cancellationReason && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                      Reason: {booking.cancellationReason}
                    </div>
                  )}
                </td>
                <td>{booking.customer?.name || '—'}</td>
                <td>{booking.professional?.businessName || 'Unassigned'}</td>
                <td>
                  {booking.date} · {booking.time}
                </td>
                <td>
                  <span
                    className={`pill ${
                      booking.status === 'CANCELLED'
                        ? 'red'
                        : booking.status === 'COMPLETED'
                        ? 'green'
                        : 'yellow'
                    }`}
                  >
                    {titleCase(booking.status)}
                  </span>
                </td>
                <td>
                  {booking.payment?.status === 'SUCCESS' ? (
                    <span className="pill green">Paid (₹{booking.payment.amount})</span>
                  ) : booking.status === 'COMPLETED' ? (
                    <span className="pill yellow">Unpaid</span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                  )}
                </td>
                {onCancel && (
                  <td>
                    {!['COMPLETED', 'CANCELLED'].includes(booking.status) ? (
                      <button
                        className="review"
                        style={{
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          borderColor: '#fecaca',
                        }}
                        onClick={() => onCancel(booking)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : (
    <Empty text="No bookings available." />
  );
}

function ProfessionalRow({
  pro,
  onVerify,
}: {
  pro: Professional;
  onVerify: (pro: Professional) => void;
}) {
  return (
    <div className="row">
      <span className="avatar">{pro.name.slice(0, 1)}</span>
      <span>
        <b>{pro.businessName}</b>
        <small>
          {pro.name} · {titleCase(pro.category)} · {pro.email}
        </small>
      </span>
      <span className={pro.verified ? 'verified' : 'pending'}>
        {pro.verified ? '✓ Verified' : '⏳ Pending'}
      </span>
      {!pro.verified && (
        <button className="review" onClick={() => void onVerify(pro)}>
          Approve Verification
        </button>
      )}
    </div>
  );
}

function DisputeRow({
  dispute,
  onResolve,
}: {
  dispute: Dispute;
  onResolve: (dispute: Dispute) => void;
}) {
  return (
    <div className="row dispute">
      <span
        className="avatar"
        style={{ background: '#fef3c7', color: '#b45309' }}
      >
        !
      </span>
      <span>
        <b>
          {titleCase(dispute.reason)} · {dispute.booking.service}
        </b>
        <small>
          Reported by {dispute.reporter.name}: {dispute.description}
        </small>
      </span>
      <span className="pending">{titleCase(dispute.status)}</span>
      {['OPEN', 'UNDER_REVIEW'].includes(dispute.status) && (
        <button className="review" onClick={() => void onResolve(dispute)}>
          Resolve Claim ➔
        </button>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(() => authStorage.getUser());
  return user ? (
    <Dashboard user={user} onSignOut={() => setUser(null)} />
  ) : (
    <Login onSignedIn={setUser} />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
