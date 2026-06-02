// frontend/src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protects a route based on auth state.
 * Props:
 *   kind:  'customer' | 'staff'         (required)
 *   roles: array of staff roles allowed (optional; staff only)
 */
export default function ProtectedRoute({ kind, roles, children }) {
    const { isAuthed, kind: currentKind, role } = useAuth();
    const location = useLocation();

    if (!isAuthed) {
        const redirect = kind === 'staff' ? '/staff/login' : '/login';
        return <Navigate to={redirect} state={{ from: location }} replace />;
    }
    if (currentKind !== kind) {
        return <Navigate to="/" replace />;
    }
    if (kind === 'staff' && roles && !roles.includes(role)) {
        return <div className="page"><div className="card error">Forbidden — your role ({role}) cannot access this page.</div></div>;
    }
    return children;
}
