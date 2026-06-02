// frontend/src/pages/CustomerTransfer.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency } from '../components/format';

export default function CustomerTransfer() {
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState({ from_account_id: '', to_account_id: '', amount: '' });
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get('/customer/accounts')
            .then(({ data }) => {
                setAccounts(data);
                const firstActive = data.find((a) => a.status === 'active');
                if (firstActive) setForm((f) => ({ ...f, from_account_id: firstActive.account_id }));
            })
            .catch((err) => setError(err.message));
    }, []);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setResult(null); setBusy(true);
        if (Number(form.from_account_id) === Number(form.to_account_id)) {
            setError('Source and destination must be different accounts.'); setBusy(false); return;
        }
        try {
            const { data } = await api.post('/customer/transfer', {
                from_account_id: Number(form.from_account_id),
                to_account_id:   Number(form.to_account_id),
                amount:          Number(form.amount),
            });
            setResult(data);
            if (data.status === 'success') setForm({ ...form, amount: '' });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <h1>Transfer Funds</h1>
            {error && <div className="alert alert-error">{error}</div>}

            {result && result.status === 'success' && (
                <div className="alert alert-success">
                    Transfer #{result.transaction.transaction_id} completed successfully.
                </div>
            )}
            {result && result.status === 'flagged' && (
                <div className="alert alert-warning">
                    Transfer #{result.transaction.transaction_id} was flagged for review and is on hold.
                    Funds were NOT moved. The fraud team will contact you if needed.
                </div>
            )}

            <div className="card">
                <form onSubmit={onSubmit}>
                    <label>From Account
                        <select required value={form.from_account_id}
                            onChange={(e) => setForm({ ...form, from_account_id: e.target.value })}>
                            <option value="">Select…</option>
                            {accounts.filter((a) => a.status === 'active').map((a) => (
                                <option key={a.account_id} value={a.account_id}>
                                    #{a.account_id} ({a.account_type}) — balance {formatCurrency(a.balance)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>To Account ID
                        <input type="number" min="1" required value={form.to_account_id}
                            onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}
                            placeholder="Enter destination account number" />
                    </label>

                    <label>Amount
                        <input type="number" step="0.01" min="0.01" required value={form.amount}
                            onChange={(e) => setForm({ ...form, amount: e.target.value })}/>
                    </label>

                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Processing…' : 'Transfer'}
                    </button>
                </form>
                <p className="muted small">
                    Large or unusual transfers may be flagged automatically by the fraud detection engine.
                </p>
            </div>
        </div>
    );
}
