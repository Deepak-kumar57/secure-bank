// frontend/src/pages/CreateAccount.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function CreateAccount() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [form, setForm] = useState({
        user_id: '', branch_id: '', account_type: 'savings', initial_balance: '0',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [b, u] = await Promise.all([
                    api.get('/admin/branches'),
                    api.get('/admin/users').catch(() => ({ data: [] })),  // managers/admin only
                ]);
                setBranches(b.data);
                setUsers(u.data);
                setForm((f) => ({ ...f, branch_id: user?.branch_id || (b.data[0]?.branch_id ?? '') }));
            } catch (err) { setError(err.message); }
        })();
    }, [user]);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setBusy(true);
        try {
            const { data } = await api.post('/staff/accounts', {
                user_id:         Number(form.user_id),
                branch_id:       Number(form.branch_id),
                account_type:    form.account_type,
                initial_balance: Number(form.initial_balance) || 0,
            });
            setSuccess(`Account #${data.account_id} created (${data.account_type}, balance ${data.balance}).`);
            setForm({ ...form, user_id: '', initial_balance: '0' });
        } catch (err) {
            setError(err.message);
        } finally { setBusy(false); }
    }

    return (
        <div>
            <h1>Create Customer Account</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <form onSubmit={onSubmit}>
                    <label>Customer
                        {users.length > 0 ? (
                            <select required value={form.user_id}
                                onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                                <option value="">Select customer…</option>
                                {users.map((u) => (
                                    <option key={u.user_id} value={u.user_id}>
                                        #{u.user_id} — {u.full_name} ({u.email})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input type="number" min="1" required value={form.user_id}
                                placeholder="Customer user_id"
                                onChange={(e) => setForm({ ...form, user_id: e.target.value })}/>
                        )}
                    </label>

                    <label>Branch
                        <select required value={form.branch_id}
                            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                            <option value="">Select branch…</option>
                            {branches.map((b) => (
                                <option key={b.branch_id} value={b.branch_id}>
                                    #{b.branch_id} {b.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>Account Type
                        <select value={form.account_type}
                            onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                            <option value="savings">Savings</option>
                            <option value="current">Current</option>
                        </select>
                    </label>

                    <label>Initial Balance
                        <input type="number" min="0" step="0.01" value={form.initial_balance}
                            onChange={(e) => setForm({ ...form, initial_balance: e.target.value })}/>
                    </label>

                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Creating…' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
