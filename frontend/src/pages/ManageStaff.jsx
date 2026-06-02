import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatDateTime, StatusBadge } from '../components/format';

export default function ManageStaff() {
    const [staff, setStaff] = useState([]);
    const [branches, setBranches] = useState([]);
    const [form, setForm] = useState({
        full_name: '', email: '', phone_number: '', password: '',
        role: 'teller', branch_id: '', access_level: '1',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            const [s, b] = await Promise.all([
                api.get('/admin/staff'),
                api.get('/admin/branches'),
            ]);
            setStaff(s.data);
            setBranches(b.data);
            if (!form.branch_id && b.data.length) {
                setForm((f) => ({ ...f, branch_id: String(b.data[0].branch_id) }));
            }
        } catch (err) { setError(err.message); }
    }
    useEffect(() => { load(); }, []);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setBusy(true);
        try {
            const { data } = await api.post('/admin/staff', {
                full_name:    form.full_name.trim(),
                email:        form.email.trim(),
                phone_number: form.phone_number.trim() || undefined,
                password:     form.password,
                role:         form.role,
                branch_id:    Number(form.branch_id) || undefined,
                access_level: Number(form.access_level) || 1,
            });
            setSuccess(`Staff "${data.full_name}" created as ${data.role} (ID #${data.staff_id}).`);
            setForm({ full_name: '', email: '', phone_number: '', password: '',
                       role: 'teller', branch_id: form.branch_id, access_level: '1' });
            await load();
        } catch (err) {
            setError(err.message);
        } finally { setBusy(false); }
    }

    return (
        <div>
            <h1>Manage Staff</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <h2>Add New Staff Member</h2>
                <form onSubmit={onSubmit}>
                    <div className="grid-2">
                        <label>Full Name
                            <input required value={form.full_name}
                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}/>
                        </label>
                        <label>Email
                            <input type="email" required value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}/>
                        </label>
                    </div>
                    <div className="grid-2">
                        <label>Phone
                            <input value={form.phone_number}
                                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}/>
                        </label>
                        <label>Password
                            <input type="password" required minLength={6} value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}/>
                        </label>
                    </div>
                    <div className="grid-2">
                        <label>Role
                            <select value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                                <option value="teller">Teller</option>
                                <option value="manager">Manager</option>
                                <option value="analyst">Analyst</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                        <label>Branch
                            <select value={form.branch_id}
                                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                                <option value="">No branch</option>
                                {branches.map((b) => (
                                    <option key={b.branch_id} value={b.branch_id}>
                                        #{b.branch_id} {b.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label>Access Level
                        <select value={form.access_level}
                            onChange={(e) => setForm({ ...form, access_level: e.target.value })}>
                            <option value="1">1 — Basic</option>
                            <option value="2">2 — Elevated</option>
                            <option value="3">3 — Full</option>
                        </select>
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Creating…' : 'Create Staff'}
                    </button>
                </form>
            </div>

            <div className="card">
                <h2>All Staff Members</h2>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Name</th><th>Email</th><th>Role</th>
                            <th>Branch</th><th>Level</th><th>Status</th><th>Last Login</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map((s) => (
                            <tr key={s.staff_id}>
                                <td>#{s.staff_id}</td>
                                <td>{s.full_name}</td>
                                <td>{s.email}</td>
                                <td><span className="badge badge-role">{s.role}</span></td>
                                <td>{s.branch_name || '—'}</td>
                                <td>{s.access_level}</td>
                                <td><StatusBadge status={s.status} /></td>
                                <td>{s.last_login ? formatDateTime(s.last_login) : '—'}</td>
                            </tr>
                        ))}
                        {staff.length === 0 && (
                            <tr><td colSpan="8" className="muted center">No staff found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
