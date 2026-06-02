// frontend/src/pages/CustomerDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function CustomerDashboard() {
    const [me, setMe] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [tx, setTx] = useState([]);
    const [error, setError] = useState('');

    const [applications, setApplications] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const [m, a, t, ap] = await Promise.all([
                    api.get('/customer/me'),
                    api.get('/customer/accounts'),
                    api.get('/customer/transactions'),
                    api.get('/customer/applications'),
                ]);
                setMe(m.data); setAccounts(a.data); setTx(t.data); setApplications(ap.data);
            } catch (err) {
                setError(err.message);
            }
        })();
    }, []);

    const totalBalance = accounts
        .filter((a) => a.status === 'active')
        .reduce((sum, a) => sum + Number(a.balance), 0);

    return (
        <div>
            <h1>Welcome{me ? `, ${me.full_name}` : ''}</h1>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="stat-grid">
                <StatCard label="Active Accounts" value={accounts.filter(a => a.status === 'active').length} />
                <StatCard label="Total Balance" value={formatCurrency(totalBalance)} tone="primary" />
                <StatCard label="Recent Transactions" value={tx.length} />
            </div>

            <div className="grid-2">
                <div className="card">
                    <div className="card-head">
                        <h2>My Accounts</h2>
                        <Link to="/customer/accounts" className="btn btn-link">View all →</Link>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr><th>ID</th><th>Type</th><th>Branch</th><th>Status</th><th className="right">Balance</th></tr>
                        </thead>
                        <tbody>
                            {accounts.slice(0, 5).map((a) => (
                                <tr key={a.account_id}>
                                    <td>#{a.account_id}</td>
                                    <td>{a.account_type}</td>
                                    <td>{a.branch_name}</td>
                                    <td><StatusBadge status={a.status} /></td>
                                    <td className="right">{formatCurrency(a.balance)}</td>
                                </tr>
                            ))}
                            {accounts.length === 0 && <tr><td colSpan="5" className="muted center">No accounts yet — please contact a teller.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <div className="card-head">
                        <h2>Recent Transactions</h2>
                        <Link to="/customer/transactions" className="btn btn-link">History →</Link>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr><th>ID</th><th>Type</th><th>When</th><th>Status</th><th className="right">Amount</th></tr>
                        </thead>
                        <tbody>
                            {tx.slice(0, 6).map((t) => (
                                <tr key={t.transaction_id}>
                                    <td>#{t.transaction_id}</td>
                                    <td>{t.transaction_type}</td>
                                    <td>{formatDateTime(t.timestamp)}</td>
                                    <td><StatusBadge status={t.status} /></td>
                                    <td className="right">{formatCurrency(t.amount)}</td>
                                </tr>
                            ))}
                            {tx.length === 0 && <tr><td colSpan="5" className="muted center">No activity yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {applications.length > 0 && (
                <div className="card">
                    <h2>Account Applications</h2>
                    <table className="data-table">
                        <thead>
                            <tr><th>ID</th><th>Type</th><th>Branch</th><th>Status</th><th>Applied</th><th>Notes</th></tr>
                        </thead>
                        <tbody>
                            {applications.map((a) => (
                                <tr key={a.application_id}>
                                    <td>#{a.application_id}</td>
                                    <td>{a.account_type}</td>
                                    <td>{a.branch_name || '—'}</td>
                                    <td><StatusBadge status={a.status} /></td>
                                    <td>{formatDateTime(a.created_at)}</td>
                                    <td>{a.review_notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="action-row">
                <Link to="/customer/transfer" className="btn btn-primary">Make a Transfer</Link>
                <Link to="/customer/accounts" className="btn">Request Withdrawal</Link>
            </div>
        </div>
    );
}
