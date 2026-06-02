// frontend/src/pages/Withdraw.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function Withdraw() {
    const [pending, setPending] = useState([]);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState('');
    const [busyId,  setBusyId]  = useState(null);

    // Walk-in withdrawal (single-step) form
    const [walkin, setWalkin] = useState({ from_account_id: '', amount: '' });
    const [walkBusy, setWalkBusy] = useState(false);

    async function load() {
        try {
            const { data } = await api.get('/staff/withdrawals/pending');
            setPending(data);
        } catch (err) { setError(err.message); }
    }
    useEffect(() => { load(); }, []);

    async function approve(tx) {
        if (!confirm(`Approve withdrawal of ${formatCurrency(tx.amount)} from acct #${tx.from_account_id}?`)) return;
        setBusyId(tx.transaction_id); setError(''); setSuccess('');
        try {
            const { data } = await api.post('/staff/withdraw', { transaction_id: tx.transaction_id });
            if (data.status === 'flagged') {
                setSuccess(`Withdrawal #${tx.transaction_id} was flagged for fraud review.`);
            } else {
                setSuccess(`Withdrawal #${tx.transaction_id} approved.`);
            }
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusyId(null); }
    }

    async function submitWalkin(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setWalkBusy(true);
        try {
            const { data } = await api.post('/staff/withdraw', {
                from_account_id: Number(walkin.from_account_id),
                amount:          Number(walkin.amount),
            });
            if (data.status === 'flagged') {
                setSuccess(`Walk-in withdrawal #${data.transaction.transaction_id} was flagged for review.`);
            } else {
                setSuccess(`Walk-in withdrawal #${data.transaction.transaction_id} processed.`);
            }
            setWalkin({ from_account_id: '', amount: '' });
            await load();
        } catch (err) { setError(err.message); }
        finally { setWalkBusy(false); }
    }

    return (
        <div>
            <h1>Withdrawals</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <h2>Pending customer requests</h2>
                <table className="data-table">
                    <thead>
                        <tr><th>TX</th><th>Customer</th><th>Account</th><th>When</th><th>Status</th><th className="right">Amount</th><th></th></tr>
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
                                <td>
                                    <button className="btn btn-primary"
                                        disabled={busyId === p.transaction_id}
                                        onClick={() => approve(p)}>
                                        {busyId === p.transaction_id ? 'Working…' : 'Approve'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {pending.length === 0 && (
                            <tr><td colSpan="7" className="muted center">No pending requests.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h2>Walk-in withdrawal (teller-initiated)</h2>
                <form onSubmit={submitWalkin} className="inline-form">
                    <label>From Account ID
                        <input type="number" min="1" required value={walkin.from_account_id}
                            onChange={(e) => setWalkin({ ...walkin, from_account_id: e.target.value })}/>
                    </label>
                    <label>Amount
                        <input type="number" step="0.01" min="0.01" required value={walkin.amount}
                            onChange={(e) => setWalkin({ ...walkin, amount: e.target.value })}/>
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={walkBusy}>
                        {walkBusy ? 'Processing…' : 'Process Withdrawal'}
                    </button>
                </form>
                <p className="muted small">
                    Use this when a customer is at the counter. Verify ID before processing.
                </p>
            </div>
        </div>
    );
}
