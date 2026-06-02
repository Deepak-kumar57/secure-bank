// frontend/src/pages/AuditLogs.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatDateTime } from '../components/format';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');
    const [limit, setLimit] = useState(100);

    useEffect(() => {
        api.get(`/admin/logs?limit=${limit}`)
            .then(({ data }) => setLogs(data))
            .catch((err) => setError(err.message));
    }, [limit]);

    const filtered = logs.filter((l) =>
        !filter ||
        l.action.toLowerCase().includes(filter.toLowerCase()) ||
        (l.description || '').toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div>
            <h1>Audit Logs</h1>
            <p className="muted small">
                Append-only audit trail. Records cannot be modified or deleted (enforced by DB triggers).
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="filter-bar">
                <input className="search" placeholder="Filter by action or description…"
                    value={filter} onChange={(e) => setFilter(e.target.value)}/>
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                    <option value={50}>Last 50</option>
                    <option value={100}>Last 100</option>
                    <option value={250}>Last 250</option>
                    <option value={500}>Last 500</option>
                </select>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Log</th><th>TX</th><th>Action</th><th>By</th>
                            <th>When</th><th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((l) => (
                            <tr key={l.log_id}>
                                <td>#{l.log_id}</td>
                                <td>{l.transaction_id ? `#${l.transaction_id}` : '—'}</td>
                                <td>{l.action}</td>
                                <td>{l.staff_name || l.user_name || '—'}</td>
                                <td>{formatDateTime(l.timestamp)}</td>
                                <td className="muted">{l.description}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="6" className="muted center">No logs match.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
