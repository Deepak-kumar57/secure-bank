// frontend/src/pages/CustomerRegister.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function CustomerRegister() {
    const { customerRegister } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        full_name: '', email: '', phone: '', password: '', confirm: '',
        account_type: 'savings', preferred_branch_id: '',
    });
    const [branches, setBranches] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get('/branches')
            .then(({ data }) => {
                setBranches(data);
                if (data.length) setForm((f) => ({ ...f, preferred_branch_id: String(data[0].branch_id) }));
            })
            .catch(() => {});
    }, []);

    async function onSubmit(e) {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirm) {
            setError('Passwords do not match');
            return;
        }
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (!form.preferred_branch_id) {
            setError('Please select a branch');
            return;
        }
        setBusy(true);
        try {
            await customerRegister({
                full_name:           form.full_name.trim(),
                email:               form.email.trim(),
                phone:               form.phone.trim(),
                password:            form.password,
                account_type:        form.account_type,
                preferred_branch_id: Number(form.preferred_branch_id),
            });
            navigate('/customer');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-card card">
            <h2>Open a SecureBank Account</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={onSubmit}>
                <h3>Personal Information</h3>
                <label>Full Name
                    <input required value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}/>
                </label>
                <label>Email
                    <input type="email" required value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}/>
                </label>
                <label>Phone
                    <input value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}/>
                </label>
                <label>Password
                    <input type="password" required value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}/>
                </label>
                <label>Confirm Password
                    <input type="password" required value={form.confirm}
                        onChange={(e) => setForm({ ...form, confirm: e.target.value })}/>
                </label>

                <h3>Account Application</h3>
                <label>Account Type
                    <select value={form.account_type}
                        onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                        <option value="savings">Savings</option>
                        <option value="current">Current</option>
                    </select>
                </label>
                <label>Preferred Branch
                    <select required value={form.preferred_branch_id}
                        onChange={(e) => setForm({ ...form, preferred_branch_id: e.target.value })}>
                        <option value="">Select branch…</option>
                        {branches.map((b) => (
                            <option key={b.branch_id} value={b.branch_id}>
                                {b.name} — {b.location}
                            </option>
                        ))}
                    </select>
                </label>

                <button type="submit" disabled={busy} className="btn btn-primary">
                    {busy ? 'Submitting…' : 'Register & Apply'}
                </button>
            </form>
            <p className="muted">
                Already have an account? <Link to="/login">Sign in</Link>
            </p>
            <p className="muted small">
                Your account application will be reviewed by a bank officer.
                You will be able to use your account once it is approved.
            </p>
        </div>
    );
}
