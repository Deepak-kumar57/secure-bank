// frontend/src/pages/CustomerTransactions.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency, formatDateTime, StatusBadge } from '../components/format';

export default function CustomerTransactions() {
    const [tx, setTx] = useState([]);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        api.get('/customer/transactions')
            .then(({ data }) => setTx(data))
            .catch((err) => setError(err.message));
    }, []);

    const filtered = tx.filter((t) => filter === 'all' || t.status === filter);

    return (
        <div>
            <h1>Transaction History</h1>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="filter-bar">
                {['all', 'success', 'pending', 'flagged', 'failed'].map((s) => (
                    <button key={s} onClick={() => setFilter(s)}
                        className={`btn ${filter === s ? 'btn-primary' : ''}`}>
                        {s}
                    </button>
                ))}
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>When</th><th>Type</th>
                            <th>From</th><th>To</th><th>Status</th><th className="right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((t) => (
                            <tr key={t.transaction_id}>
                                <td>#{t.transaction_id}</td>
                                <td>{formatDateTime(t.timestamp)}</td>
                                <td>{t.transaction_type}</td>
                                <td>{t.from_account_id ? `#${t.from_account_id}` : '—'}</td>
                                <td>{t.to_account_id   ? `#${t.to_account_id}`   : '—'}</td>
                                <td><StatusBadge status={t.status} /></td>
                                <td className="right">{formatCurrency(t.amount)}</td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="7" className="muted center">No transactions match this filter.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
