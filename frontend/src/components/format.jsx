// frontend/src/components/format.jsx
// Small formatting helpers used across pages.

export function formatCurrency(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'PKR',
        maximumFractionDigits: 2,
    });
}

export function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return String(value);
    }
}

export function StatusBadge({ status }) {
    const map = {
        success:  'badge-success',
        pending:  'badge-pending',
        failed:   'badge-failed',
        flagged:  'badge-flagged',
        reversed: 'badge-pending',
        active:   'badge-success',
        frozen:   'badge-pending',
        closed:   'badge-failed',
        resolved: 'badge-success',
        rejected: 'badge-failed',
    };
    return <span className={`badge ${map[status] || ''}`}>{status}</span>;
}

export function RiskBadge({ level }) {
    const map = { low: 'risk-low', medium: 'risk-medium', high: 'risk-high' };
    return <span className={`badge ${map[level] || ''}`}>{level}</span>;
}
