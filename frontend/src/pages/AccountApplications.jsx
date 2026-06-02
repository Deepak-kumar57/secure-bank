import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatDateTime, StatusBadge } from '../components/format';

export default function AccountApplications() {
    const [apps, setApps] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [rejectId, setRejectId] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');

    async function load() {
        try {
            const { data } = await api.get('/staff/applications');
            setApps(data);
        } catch (err) { setError(err.message); }
    }
    useEffect(() => { load(); }, []);

    async function approve(app) {
        if (!confirm(`Approve ${app.account_type} account application for ${app.customer_name}?`)) return;
        setBusyId(app.application_id); setError(''); setSuccess('');
        try {
            const { data } = await api.patch(`/staff/applications/${app.application_id}/approve`);
            setSuccess(`Application #${app.application_id} approved — Account #${data.account.account_id} created.`);
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusyId(null); }
    }

    async function reject(appId) {
        setBusyId(appId); setError(''); setSuccess('');
        try {
            await api.patch(`/staff/applications/${appId}/reject`, { review_notes: rejectNotes });
            setSuccess(`Application #${appId} rejected.`);
            setRejectId(null); setRejectNotes('');
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusyId(null); }
    }

    const pending = apps.filter(a => a.status === 'pending');
    const resolved = apps.filter(a => a.status !== 'pending');

    return (
        <div>
            <h1>Account Applications</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="card">
                <h2>Pending Applications</h2>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Customer</th><th>Email</th><th>Type</th>
                            <th>Branch</th><th>Applied</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {pending.map((a) => (
                            <tr key={a.application_id}>
                                <td>#{a.application_id}</td>
                                <td>{a.customer_name}</td>
                                <td>{a.customer_email}</td>
                                <td>{a.account_type}</td>
                                <td>{a.branch_name || '—'}</td>
                                <td>{formatDateTime(a.created_at)}</td>
                                <td>
                                    {rejectId === a.application_id ? (
                                        <div>
                                            <input placeholder="Reason (optional)" value={rejectNotes}
                                                onChange={(e) => setRejectNotes(e.target.value)}
                                                style={{ marginBottom: '0.5rem', width: '100%' }}/>
                                            <button className="btn btn-danger" disabled={busyId === a.application_id}
                                                onClick={() => reject(a.application_id)}>
                                                Confirm Reject
                                            </button>
                                            <button className="btn btn-link" onClick={() => setRejectId(null)}>Cancel</button>
                                        </div>
                                    ) : (
                                        <>
                                            <button className="btn btn-primary" disabled={busyId === a.application_id}
                                                onClick={() => approve(a)}>
                                                {busyId === a.application_id ? 'Working…' : 'Approve'}
                                            </button>
                                            {' '}
                                            <button className="btn btn-danger" disabled={busyId === a.application_id}
                                                onClick={() => { setRejectId(a.application_id); setRejectNotes(''); }}>
                                                Reject
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {pending.length === 0 && (
                            <tr><td colSpan="7" className="muted center">No pending applications.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {resolved.length > 0 && (
                <div className="card">
                    <h2>Resolved Applications</h2>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th><th>Customer</th><th>Type</th><th>Branch</th>
                                <th>Status</th><th>Applied</th><th>Reviewed</th><th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resolved.map((a) => (
                                <tr key={a.application_id}>
                                    <td>#{a.application_id}</td>
                                    <td>{a.customer_name}</td>
                                    <td>{a.account_type}</td>
                                    <td>{a.branch_name || '—'}</td>
                                    <td><StatusBadge status={a.status} /></td>
                                    <td>{formatDateTime(a.created_at)}</td>
                                    <td>{a.reviewed_at ? formatDateTime(a.reviewed_at) : '—'}</td>
                                    <td>{a.review_notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
