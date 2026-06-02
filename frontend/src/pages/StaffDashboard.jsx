// frontend/src/pages/StaffDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function StaffDashboard() {
    const { user, role } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [pending,  setPending]  = useState([]);
    const [error, setError] = useState('');

    const [applications, setApplications] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const fetches = [
                    api.get('/staff/accounts'),
                    api.get('/staff/withdrawals/pending'),
                ];
                if (role === 'admin' || role === 'teller') {
                    fetches.push(api.get('/staff/applications'));
                }
                const results = await Promise.all(fetches);
                setAccounts(results[0].data);
                setPending(results[1].data);
                if (results[2]) setApplications(results[2].data.filter(a => a.status === 'pending'));
            } catch (err) { setError(err.message); }
        })();
    }, [role]);

    const totalBalance = accounts
        .filter((a) => a.status === 'active')
        .reduce((s, a) => s + Number(a.balance), 0);

    return (
        <div>
            <h1>Staff Dashboard</h1>
            <p className="muted">Signed in as <strong>{user?.full_name}</strong> ({role}).</p>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="stat-grid">
                <StatCard label="Accounts at branch"   value={accounts.length} />
                <StatCard label="Total active balance" value={formatCurrency(totalBalance)} tone="primary" />
                <StatCard label="Pending withdrawals"  value={pending.length} tone={pending.length ? 'warning' : ''} />
                {(role === 'admin' || role === 'teller') &&
                    <StatCard label="Pending applications" value={applications.length} tone={applications.length ? 'warning' : ''} />
                }
            </div>

            <div className="action-row">
                {(role === 'admin' || role === 'teller') && <>
                    <Link to="/staff/deposit" className="btn btn-primary">New Deposit</Link>
                    <Link to="/staff/withdraw" className="btn btn-primary">Process Withdrawals</Link>
                    <Link to="/staff/create-account" className="btn">Create Account</Link>
                    <Link to="/staff/applications" className="btn">Applications</Link>
                </>}
                <Link to="/staff/accounts" className="btn">Manage Accounts</Link>
                {(role === 'admin' || role === 'manager' || role === 'analyst') &&
                    <Link to="/staff/fraud" className="btn">Fraud Alerts</Link>}
            </div>

            <div className="card">
                <div className="card-head">
                    <h2>Pending withdrawal requests</h2>
                    {(role === 'admin' || role === 'teller') &&
                        <Link to="/staff/withdraw" className="btn btn-link">Process →</Link>}
                </div>
                <table className="data-table">
                    <thead>
                        <tr><th>TX</th><th>Customer</th><th>Account</th><th>When</th><th>Status</th><th className="right">Amount</th></tr>
                    </thead>
                    <tbody>
                        {pending.map((p) => (
                            <tr key={p.transaction_id}>
                                <td>#{p.transaction_id}</td>
                                <td>{p.customer_name}</td>
                                <td>#{p.from_account_id}</td>
                                <td>{formatDateTime(p.timestamp)}</td>
                                <td><StatusBadge status={p.status} /></td>
                                <td className="right">{formatCurrency(p.amount)}</td>
                            </tr>
                        ))}
                        {pending.length === 0 && (
                            <tr><td colSpan="6" className="muted center">No pending withdrawal requests.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
