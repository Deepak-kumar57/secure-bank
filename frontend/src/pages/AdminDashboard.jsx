// frontend/src/pages/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function AdminDashboard() {
    const [d, setD] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/admin/dashboard')
            .then(({ data }) => setD(data))
            .catch((err) => setError(err.message));
    }, []);

    if (error) return <div className="alert alert-error">{error}</div>;
    if (!d)    return <div className="muted">Loading…</div>;

    const c = d.counts;
    return (
        <div>
            <h1>Admin Dashboard</h1>

            <div className="stat-grid">
                <StatCard label="Customers"        value={c.customers} />
                <StatCard label="Accounts"         value={c.accounts} />
                <StatCard label="Total balance"    value={formatCurrency(c.total_balance)} tone="primary" />
                <StatCard label="Transactions"     value={c.transactions} />
                <StatCard label="Pending alerts"   value={c.pending_alerts}
                    tone={c.pending_alerts ? 'warning' : ''} />
                <StatCard label="High-risk alerts" value={c.high_risk_alerts}
                    tone={c.high_risk_alerts ? 'danger' : ''} />
            </div>

            <div className={`card chain-summary ${d.chain_summary.aligned ? 'ok' : 'warn'}`}>
                <h3>Hash chain summary</h3>
                <p>
                    {d.chain_summary.actual_hashed} hashes stored for {d.chain_summary.expected_hashed} hashable transactions{' '}
                    — {d.chain_summary.aligned
                        ? <span className="ok-text">counts aligned</span>
                        : <span className="warn-text">counts misaligned (run integrity check)</span>}.
                </p>
                <Link to="/admin/integrity" className="btn">Run full integrity check →</Link>
            </div>

            <div className="grid-2">
                <div className="card">
                    <h3>Recent transactions</h3>
                    <table className="data-table">
                        <thead>
                            <tr><th>ID</th><th>When</th><th>Type</th><th>Status</th><th className="right">Amount</th></tr>
                        </thead>
                        <tbody>
                            {d.recent_transactions.map((t) => (
                                <tr key={t.transaction_id}>
                                    <td>#{t.transaction_id}</td>
                                    <td>{formatDateTime(t.timestamp)}</td>
                                    <td>{t.transaction_type}</td>
                                    <td><StatusBadge status={t.status} /></td>
                                    <td className="right">{formatCurrency(t.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h3>Recent audit log</h3>
                    <table className="data-table">
                        <thead>
                            <tr><th>Log</th><th>TX</th><th>Action</th><th>When</th></tr>
                        </thead>
                        <tbody>
                            {d.recent_logs.map((l) => (
                                <tr key={l.log_id}>
                                    <td>#{l.log_id}</td>
                                    <td>{l.transaction_id ? `#${l.transaction_id}` : '—'}</td>
                                    <td>{l.action}</td>
                                    <td>{formatDateTime(l.timestamp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Link to="/admin/logs" className="btn btn-link">All logs →</Link>
                </div>
            </div>
        </div>
    );
}
