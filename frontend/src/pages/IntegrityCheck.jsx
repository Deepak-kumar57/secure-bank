// frontend/src/pages/IntegrityCheck.jsx
import { useState } from 'react';
import api from '../api/axios';

export default function IntegrityCheck() {
    const [result, setResult] = useState(null);
    const [error,  setError]  = useState('');
    const [busy,   setBusy]   = useState(false);

    async function run() {
        setBusy(true); setError(''); setResult(null);
        try {
            const { data } = await api.get('/admin/integrity/verify');
            setResult(data);
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    return (
        <div>
            <h1>Hash Chain Integrity</h1>
            <p className="muted">
                Verifies the SHA-256 hash chain across the entire transaction ledger.
                Any tampered field, missing record, or broken link surfaces here.
            </p>

            <div className="card">
                <button className="btn btn-primary" onClick={run} disabled={busy}>
                    {busy ? 'Verifying…' : 'Run integrity check'}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {result && (
                <div className={`card integrity-result ${result.valid ? 'ok' : 'fail'}`}>
                    <h2>{result.valid ? '✅ Chain is valid' : '⚠️ Chain integrity FAILED'}</h2>
                    <ul>
                        <li><strong>Checked transactions:</strong> {result.checkedTransactions}</li>
                        <li><strong>Broken at:</strong> {result.brokenAt ? `#${result.brokenAt}` : '— none —'}</li>
                        <li><strong>Message:</strong> {result.message}</li>
                    </ul>
                    {result.valid ? (
                        <p className="muted small">
                            Each row's stored SHA-256 matches the recomputed hash, and every previous_hash matches its predecessor's current_hash. The ledger has not been modified.
                        </p>
                    ) : (
                        <p className="warn-text">
                            Tampering or corruption detected. Investigate before allowing further transactions.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
