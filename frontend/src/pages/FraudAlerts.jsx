// frontend/src/pages/FraudAlerts.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency, formatDateTime, StatusBadge, RiskBadge } from '../components/format';

export default function FraudAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [tab, setTab] = useState('pending');
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState('');
    const [reviewing, setReviewing] = useState(null);   // alert being reviewed
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            const url = tab === 'pending' ? '/fraud/alerts/pending' : '/fraud/alerts';
            const { data } = await api.get(url);
            setAlerts(data);
        } catch (err) { setError(err.message); }
    }
    useEffect(() => { load(); }, [tab]);

    async function decide(decision) {
        setBusy(true); setError(''); setSuccess('');
        try {
            await api.patch(`/fraud/alerts/${reviewing.alert_id}/${decision}`, { notes });
            setSuccess(`Alert #${reviewing.alert_id} ${decision === 'resolve' ? 'resolved' : 'rejected'}.`);
            setReviewing(null); setNotes('');
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    return (
        <div>
            <h1>Fraud Alerts</h1>
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="filter-bar">
                <button className={`btn ${tab === 'pending' ? 'btn-primary' : ''}`}
                    onClick={() => setTab('pending')}>Pending</button>
                <button className={`btn ${tab === 'all' ? 'btn-primary' : ''}`}
                    onClick={() => setTab('all')}>All</button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Alert</th><th>TX</th><th>Type</th><th>Risk</th>
                            <th>Status</th><th>Created</th><th className="right">Amount</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {alerts.map((a) => (
                            <tr key={a.alert_id}>
                                <td>#{a.alert_id}</td>
                                <td>#{a.transaction_id}</td>
                                <td>{a.alert_type}</td>
                                <td><RiskBadge level={a.risk_level} /></td>
                                <td><StatusBadge status={a.status} /></td>
                                <td>{formatDateTime(a.created_at)}</td>
                                <td className="right">{formatCurrency(a.amount)}</td>
                                <td>
                                    {a.status === 'pending' && (
                                        <button className="btn btn-link" onClick={() => { setReviewing(a); setNotes(''); }}>
                                            Review
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {alerts.length === 0 && (
                            <tr><td colSpan="8" className="muted center">No alerts {tab === 'pending' ? 'pending review' : 'recorded'}.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {reviewing && (
                <div className="card">
                    <h3>Review alert #{reviewing.alert_id} on transaction #{reviewing.transaction_id}</h3>
                    <p><strong>Type:</strong> {reviewing.alert_type}{' · '}
                        <strong>Risk:</strong> <RiskBadge level={reviewing.risk_level} /></p>
                    <p className="muted">{reviewing.description}</p>
                    <label>Review Notes
                        <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)}
                            placeholder="Why are you resolving or rejecting this alert?"/>
                    </label>
                    <div className="action-row">
                        <button className="btn btn-primary" disabled={busy} onClick={() => decide('resolve')}>
                            Mark Resolved (legitimate)
                        </button>
                        <button className="btn btn-secondary" disabled={busy} onClick={() => decide('reject')}>
                            Reject (false positive)
                        </button>
                        <button className="btn" onClick={() => setReviewing(null)}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
