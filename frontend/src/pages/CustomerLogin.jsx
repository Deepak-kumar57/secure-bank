// frontend/src/pages/CustomerLogin.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CustomerLogin() {
    const { customerLogin } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [busy, setBusy] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setWarning(''); setBusy(true);
        try {
            const data = await customerLogin(form.email.trim(), form.password);
            if (data.warning) setWarning(data.warning);
            navigate('/customer');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-card card">
            <h2>Customer Login</h2>
            {error   && <div className="alert alert-error">{error}</div>}
            {warning && <div className="alert alert-warning">{warning}</div>}

            <form onSubmit={onSubmit}>
                <label>Email
                    <input type="email" required value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}/>
                </label>
                <label>Password
                    <input type="password" required value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}/>
                </label>
                <button type="submit" disabled={busy} className="btn btn-primary">
                    {busy ? 'Signing in…' : 'Sign in'}
                </button>
            </form>

            <p className="muted">
                Don't have an account? <Link to="/register">Register</Link>
            </p>
            <p className="muted small">
                Staff? <Link to="/staff/login">Staff login</Link>
            </p>
        </div>
    );
}
