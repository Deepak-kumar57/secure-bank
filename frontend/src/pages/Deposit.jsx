// frontend/src/pages/Deposit.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency } from '../components/format';

export default function Deposit() {
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState({ to_account_id: '', amount: '' });
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get('/staff/accounts')
            .then(({ data }) => setAccounts(data))
            .catch((err) => setError(err.message));
    }, []);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setResult(null); setBusy(true);
        try {
            const { data } = await api.post('/staff/deposit', {
                to_account_id: Number(form.to_account_id),
                amount:        Number(form.amount),
            });
            setResult(data);
            setForm({ to_account_id: '', amount: '' });
            const refreshed = await api.get('/staff/accounts');
            setAccounts(refreshed.data);
        } catch (err) {
            setError(err.message);
        } finally { setBusy(false); }
    }

    return (
        <div>
            <h1>Deposit</h1>
            {error && <div className="alert alert-error">{error}</div>}
            {result && (
                <div className="alert alert-success">
                    Deposit #{result.transaction.transaction_id} of {formatCurrency(result.transaction.amount)} posted.
                    {result.alerts && result.alerts.length > 0 && (
                        <> {result.alerts.length} fraud alert(s) raised for review.</>
                    )}
                </div>
            )}

            <div className="card">
                <form onSubmit={onSubmit}>
                    <label>To Account
                        <select required value={form.to_account_id}
                            onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}>
                            <option value="">Select account…</option>
                            {accounts.filter((a) => a.status === 'active').map((a) => (
                                <option key={a.account_id} value={a.account_id}>
                                    #{a.account_id} — {a.full_name} ({a.account_type}, balance {formatCurrency(a.balance)})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>Amount
                        <input type="number" step="0.01" min="0.01" required value={form.amount}
                            onChange={(e) => setForm({ ...form, amount: e.target.value })}/>
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Posting…' : 'Post Deposit'}
                    </button>
                </form>
                <p className="muted small">
                    Customers cannot deposit funds directly — only staff can post deposits to an account.
                </p>
            </div>
        </div>
    );
}
