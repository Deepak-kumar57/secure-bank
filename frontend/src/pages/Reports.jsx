// frontend/src/pages/Reports.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatCurrency } from '../components/format';

export default function Reports() {
    const [r, setR] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/admin/reports/summary')
            .then(({ data }) => setR(data))
            .catch((err) => setError(err.message));
    }, []);

    if (error) return <div className="alert alert-error">{error}</div>;
    if (!r)    return <div className="muted">Loading…</div>;

    return (
        <div>
            <h1>Reports</h1>

            <div className="grid-2">
                <div className="card">
                    <h2>Transactions by day (last 30)</h2>
                    <table className="data-table">
                        <thead>
                            <tr><th>Day</th><th className="right">Count</th><th className="right">Total</th></tr>
                        </thead>
                        <tbody>
                            {r.transactions_by_day.map((row) => (
                                <tr key={row.day}>
                                    <td>{new Date(row.day).toLocaleDateString()}</td>
                                    <td className="right">{row.count}</td>
                                    <td className="right">{formatCurrency(row.total_amount)}</td>
                                </tr>
                            ))}
                            {r.transactions_by_day.length === 0 &&
                                <tr><td colSpan="3" className="muted center">No transactions in the last 30 days.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h2>By type and status</h2>
                    <table className="data-table">
                        <thead>
                            <tr><th>Type</th><th>Status</th><th className="right">Count</th></tr>
                        </thead>
                        <tbody>
                            {r.transactions_by_type.map((row, i) => (
                                <tr key={i}>
                                    <td>{row.transaction_type}</td>
                                    <td>{row.status}</td>
                                    <td className="right">{row.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h2>Fraud alerts breakdown</h2>
                    <table className="data-table">
                        <thead>
                            <tr><th>Risk</th><th>Status</th><th className="right">Count</th></tr>
                        </thead>
                        <tbody>
                            {r.alerts_by_risk.map((row, i) => (
                                <tr key={i}>
                                    <td>{row.risk_level}</td>
                                    <td>{row.status}</td>
                                    <td className="right">{row.count}</td>
                                </tr>
                            ))}
                            {r.alerts_by_risk.length === 0 &&
                                <tr><td colSpan="3" className="muted center">No alerts on record.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h2>Balance by branch</h2>
                    <table className="data-table">
                        <thead>
                            <tr><th>Branch</th><th className="right">Accounts</th><th className="right">Total balance</th></tr>
                        </thead>
                        <tbody>
                            {r.balance_by_branch.map((row) => (
                                <tr key={row.branch_id}>
                                    <td>{row.name}</td>
                                    <td className="right">{row.account_count}</td>
                                    <td className="right">{formatCurrency(row.total_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
