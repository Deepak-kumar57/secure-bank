import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function ManageBranches() {
    const [branches, setBranches] = useState([]);
    const [form, setForm] = useState({ name: '', location: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            const { data } = await api.get('/admin/branches');
            setBranches(data);
        } catch (err) { setError(err.message); }
    }
    useEffect(() => { load(); }, []);

    async function onSubmit(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setBusy(true);
        try {
            const { data } = await api.post('/admin/branches', {
                name: form.name.trim(),
                location: form.location.trim(),
            });
            setSuccess(`Branch "${data.name}" created (ID #${data.branch_id}).`);
            setForm({ name: '', location: '' });
            await load();
        } catch (err) {
            setError(err.message);
        } finally { setBusy(false); }
    }

    return (
        <div>
            <h1>Manage Branches</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <h2>Create New Branch</h2>
                <form onSubmit={onSubmit}>
                    <label>Branch Name
                        <input required value={form.name} placeholder="e.g. SecureBank — Karachi Branch"
                            onChange={(e) => setForm({ ...form, name: e.target.value })}/>
                    </label>
                    <label>Location
                        <input required value={form.location} placeholder="e.g. Karachi, Sindh"
                            onChange={(e) => setForm({ ...form, location: e.target.value })}/>
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? 'Creating…' : 'Create Branch'}
                    </button>
                </form>
            </div>

            <div className="card">
                <h2>All Branches</h2>
                <table className="data-table">
                    <thead>
                        <tr><th>ID</th><th>Name</th><th>Location</th></tr>
                    </thead>
                    <tbody>
                        {branches.map((b) => (
                            <tr key={b.branch_id}>
                                <td>#{b.branch_id}</td>
                                <td>{b.name}</td>
                                <td>{b.location}</td>
                            </tr>
                        ))}
                        {branches.length === 0 && (
                            <tr><td colSpan="3" className="muted center">No branches found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
