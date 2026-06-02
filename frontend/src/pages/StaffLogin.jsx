// frontend/src/pages/StaffLogin.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StaffLogin() {
    const { staffLogin } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setBusy(true);
        try {
            const data = await staffLogin(form.email.trim(), form.password);
            // Route by role.
            if (data.staff.role === 'admin' || data.staff.role === 'manager') navigate('/admin');
            else if (data.staff.role === 'analyst') navigate('/staff/fraud');
            else navigate('/staff');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-card card">
            <h2>Staff Login</h2>
            {error && <div className="alert alert-error">{error}</div>}
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
        </div>
    );
}
