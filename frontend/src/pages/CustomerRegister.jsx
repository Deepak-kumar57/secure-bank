// frontend/src/pages/CustomerRegister.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CustomerRegister() {
    const { customerRegister } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

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
        setBusy(true);
        try {
            await customerRegister({
                full_name: form.full_name.trim(),
                email:     form.email.trim(),
                phone:     form.phone.trim(),
                password:  form.password,
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
            <h2>Create Customer Account</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={onSubmit}>
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
                <button type="submit" disabled={busy} className="btn btn-primary">
                    {busy ? 'Creating…' : 'Register'}
                </button>
            </form>
            <p className="muted">
                Already have an account? <Link to="/login">Sign in</Link>
            </p>
            <p className="muted small">
                Note: only staff can create bank accounts. After registering you'll need a teller
                to open your first account, or use a seeded customer login.
            </p>
        </div>
    );
}
