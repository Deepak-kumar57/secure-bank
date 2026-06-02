// frontend/src/components/Navbar.jsx
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { isAuthed, kind, role, user, logout } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/');
    }

    return (
        <nav className="navbar">
            <Link to="/" className="brand">
                <span className="brand-logo">🔒</span>
                <span>SecureBank</span>
            </Link>

            <div className="nav-links">
                {!isAuthed && (
                    <>
                        <NavLink to="/login">Customer Login</NavLink>
                        <NavLink to="/register">Register</NavLink>
                        <NavLink to="/staff/login">Staff Login</NavLink>
                    </>
                )}

                {isAuthed && kind === 'customer' && (
                    <>
                        <NavLink to="/customer">Dashboard</NavLink>
                        <NavLink to="/customer/accounts">Accounts</NavLink>
                        <NavLink to="/customer/transfer">Transfer</NavLink>
                        <NavLink to="/customer/transactions">History</NavLink>
                    </>
                )}

                {isAuthed && kind === 'staff' && (
                    <>
                        <NavLink to="/staff">Dashboard</NavLink>
                        <NavLink to="/staff/accounts">Accounts</NavLink>
                        {(role === 'admin' || role === 'teller') && <NavLink to="/staff/deposit">Deposit</NavLink>}
                        {(role === 'admin' || role === 'teller') && <NavLink to="/staff/withdraw">Withdrawals</NavLink>}
                        {(role === 'admin' || role === 'teller') && <NavLink to="/staff/create-account">Create Account</NavLink>}
                        {(role === 'admin' || role === 'teller') && <NavLink to="/staff/applications">Applications</NavLink>}
                        {(role === 'analyst' || role === 'admin' || role === 'manager') && <NavLink to="/staff/fraud">Fraud</NavLink>}
                        {(role === 'admin' || role === 'manager') && <NavLink to="/admin">Admin</NavLink>}
                        {role === 'admin' && <NavLink to="/admin/branches">Branches</NavLink>}
                        {role === 'admin' && <NavLink to="/admin/staff">Staff</NavLink>}
                        {role === 'admin' && <NavLink to="/admin/integrity">Integrity</NavLink>}
                        {(role === 'admin' || role === 'manager' || role === 'analyst') && <NavLink to="/admin/logs">Logs</NavLink>}
                        {(role === 'admin' || role === 'manager') && <NavLink to="/admin/reports">Reports</NavLink>}
                    </>
                )}

                {isAuthed && (
                    <span className="nav-user">
                        <span className="badge badge-role">{kind === 'staff' ? role : 'customer'}</span>
                        <span className="nav-name">{user?.full_name || user?.email}</span>
                        <button onClick={handleLogout} className="btn btn-link">Logout</button>
                    </span>
                )}
            </div>
        </nav>
    );
}
