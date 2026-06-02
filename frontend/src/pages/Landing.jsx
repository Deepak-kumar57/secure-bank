// frontend/src/pages/Landing.jsx
import { Link } from 'react-router-dom';

export default function Landing() {
    return (
        <div className="landing">
            <section className="hero">
                <h1>SecureBank</h1>
                <p className="lead">
                    A fraud-aware banking management system with blockchain-inspired
                    SHA-256 transaction integrity.
                </p>
                <div className="hero-actions">
                    <Link to="/login"       className="btn btn-primary">Customer Login</Link>
                    <Link to="/register"    className="btn">Create Account</Link>
                    <Link to="/staff/login" className="btn btn-secondary">Staff Login</Link>
                </div>
            </section>

            <section className="features">
                <div className="feature">
                    <h3>🔐 Hash-chained ledger</h3>
                    <p>Every transaction is linked by SHA-256. Tampering breaks the chain and is detected in O(n).</p>
                </div>
                <div className="feature">
                    <h3>🛡️ Real-time fraud detection</h3>
                    <p>Rule-based engine flags high-amount, velocity, and rapid-transfer anomalies for staff review.</p>
                </div>
                <div className="feature">
                    <h3>👥 Role-based access</h3>
                    <p>Customer, teller, analyst, manager, and admin — each with strictly enforced permissions.</p>
                </div>
            </section>
        </div>
    );
}
