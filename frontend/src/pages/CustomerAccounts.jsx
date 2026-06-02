// frontend/src/pages/CustomerAccounts.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function CustomerAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeId, setActiveId] = useState(null);
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            const { data } = await api.get('/customer/accounts');
            setAccounts(data);
        } catch (err) {
            setError(err.message);
        }
    }
    useEffect(() => { load(); }, []);

    async function submitWithdrawal(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setBusy(true);
        try {
            const { data } = await api.post('/customer/withdrawal-request', {
                from_account_id: activeId,
                amount: Number(amount),
            });
            setSuccess(`Withdrawal request #${data.transaction.transaction_id} submitted; awaiting staff approval.`);
            setActiveId(null); setAmount('');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <h1>My Accounts</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Type</th><th>Branch</th><th>Opened</th>
                            <th>Status</th><th className="right">Balance</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((a) => (
                            <tr key={a.account_id}>
                                <td>#{a.account_id}</td>
                                <td>{a.account_type}</td>
                                <td>{a.branch_name}</td>
                                <td>{formatDateTime(a.created_at)}</td>
                                <td><StatusBadge status={a.status} /></td>
                                <td className="right">{formatCurrency(a.balance)}</td>
                                <td>
                                    {a.status === 'active' && (
                                        <button className="btn btn-link"
                                            onClick={() => { setActiveId(a.account_id); setAmount(''); }}>
                                            Request withdrawal
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {accounts.length === 0 && (
                            <tr><td colSpan="7" className="muted center">
                                You have no accounts. Please ask a teller to open one for you.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {activeId && (
                <div className="card">
                    <h3>Request withdrawal from account #{activeId}</h3>
                    <p className="muted small">
                        Withdrawals are processed by a teller. Funds are not deducted until approved.
                    </p>
                    <form onSubmit={submitWithdrawal} className="inline-form">
                        <label>Amount
                            <input type="number" step="0.01" min="0.01" required value={amount}
                                onChange={(e) => setAmount(e.target.value)} />
                        </label>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Submitting…' : 'Submit Request'}
                        </button>
                        <button type="button" className="btn" onClick={() => setActiveId(null)}>Cancel</button>
                    </form>
                </div>
            )}
        </div>
    );
}
