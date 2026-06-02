// frontend/src/pages/AccountManagement.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function AccountManagement() {
    const { role } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState('');
    const [busyId,  setBusyId]  = useState(null);
    const [search,  setSearch]  = useState('');

    async function load() {
        try {
            const { data } = await api.get('/staff/accounts');
            setAccounts(data);
        } catch (err) { setError(err.message); }
    }
    useEffect(() => { load(); }, []);

    const canFreeze = role === 'admin' || role === 'manager';
    const canClose  = role === 'admin';

    async function action(accountId, kind) {
        const labels = { freeze: 'freeze', unfreeze: 'unfreeze', close: 'close (irreversible)' };
        if (!confirm(`Are you sure you want to ${labels[kind]} account #${accountId}?`)) return;
        setBusyId(accountId); setError(''); setSuccess('');
        try {
            await api.patch(`/staff/accounts/${accountId}/${kind}`);
            setSuccess(`Account #${accountId} ${kind}d.`);
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusyId(null); }
    }

    const filtered = accounts.filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            String(a.account_id).includes(q) ||
            (a.full_name || '').toLowerCase().includes(q) ||
            (a.email || '').toLowerCase().includes(q)
        );
    });

    return (
        <div>
            <h1>Account Management</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <input className="search" placeholder="Search by account #, name, or email…"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Customer</th><th>Type</th><th>Branch</th>
                            <th>Opened</th><th>Status</th><th className="right">Balance</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a) => (
                            <tr key={a.account_id}>
                                <td>#{a.account_id}</td>
                                <td>{a.full_name}<br/><span className="muted small">{a.email}</span></td>
                                <td>{a.account_type}</td>
                                <td>{a.branch_name}</td>
                                <td>{formatDateTime(a.created_at)}</td>
                                <td><StatusBadge status={a.status} /></td>
                                <td className="right">{formatCurrency(a.balance)}</td>
                                <td>
                                    {canFreeze && a.status === 'active' && (
                                        <button className="btn btn-link" disabled={busyId === a.account_id}
                                            onClick={() => action(a.account_id, 'freeze')}>Freeze</button>
                                    )}
                                    {canFreeze && a.status === 'frozen' && (
                                        <button className="btn btn-link" disabled={busyId === a.account_id}
                                            onClick={() => action(a.account_id, 'unfreeze')}>Unfreeze</button>
                                    )}
                                    {canClose && a.status !== 'closed' && (
                                        <button className="btn btn-link danger" disabled={busyId === a.account_id}
                                            onClick={() => action(a.account_id, 'close')}>Close</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="8" className="muted center">No accounts found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
