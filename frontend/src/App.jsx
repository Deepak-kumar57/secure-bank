// frontend/src/App.jsx
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Landing            from './pages/Landing';
import CustomerLogin      from './pages/CustomerLogin';
import CustomerRegister   from './pages/CustomerRegister';
import StaffLogin         from './pages/StaffLogin';

import CustomerDashboard  from './pages/CustomerDashboard';
import CustomerAccounts   from './pages/CustomerAccounts';
import CustomerTransfer   from './pages/CustomerTransfer';
import CustomerTransactions from './pages/CustomerTransactions';

import StaffDashboard     from './pages/StaffDashboard';
import CreateAccount      from './pages/CreateAccount';
import Deposit            from './pages/Deposit';
import Withdraw           from './pages/Withdraw';
import AccountManagement  from './pages/AccountManagement';
import FraudAlerts        from './pages/FraudAlerts';

import AdminDashboard     from './pages/AdminDashboard';
import ManageBranches     from './pages/ManageBranches';
import ManageStaff        from './pages/ManageStaff';
import AccountApplications from './pages/AccountApplications';
import IntegrityCheck     from './pages/IntegrityCheck';
import AuditLogs          from './pages/AuditLogs';
import Reports            from './pages/Reports';

export default function App() {
    return (
        <div className="app">
            <Navbar />
            <main className="page">
                <Routes>
                    {/* Public */}
                    <Route path="/"               element={<Landing />} />
                    <Route path="/login"          element={<CustomerLogin />} />
                    <Route path="/register"       element={<CustomerRegister />} />
                    <Route path="/staff/login"    element={<StaffLogin />} />

                    {/* Customer */}
                    <Route path="/customer"               element={<ProtectedRoute kind="customer"><CustomerDashboard /></ProtectedRoute>} />
                    <Route path="/customer/accounts"      element={<ProtectedRoute kind="customer"><CustomerAccounts /></ProtectedRoute>} />
                    <Route path="/customer/transfer"      element={<ProtectedRoute kind="customer"><CustomerTransfer /></ProtectedRoute>} />
                    <Route path="/customer/transactions"  element={<ProtectedRoute kind="customer"><CustomerTransactions /></ProtectedRoute>} />

                    {/* Staff (any role) */}
                    <Route path="/staff"                  element={<ProtectedRoute kind="staff"><StaffDashboard /></ProtectedRoute>} />
                    <Route path="/staff/accounts"         element={<ProtectedRoute kind="staff"><AccountManagement /></ProtectedRoute>} />
                    <Route path="/staff/deposit"          element={<ProtectedRoute kind="staff" roles={['admin','teller']}><Deposit /></ProtectedRoute>} />
                    <Route path="/staff/withdraw"         element={<ProtectedRoute kind="staff" roles={['admin','teller']}><Withdraw /></ProtectedRoute>} />
                    <Route path="/staff/create-account"   element={<ProtectedRoute kind="staff" roles={['admin','teller']}><CreateAccount /></ProtectedRoute>} />
                    <Route path="/staff/fraud"            element={<ProtectedRoute kind="staff" roles={['admin','manager','analyst']}><FraudAlerts /></ProtectedRoute>} />
                    <Route path="/staff/applications"    element={<ProtectedRoute kind="staff" roles={['admin','teller']}><AccountApplications /></ProtectedRoute>} />

                    {/* Admin / Manager */}
                    <Route path="/admin"                  element={<ProtectedRoute kind="staff" roles={['admin','manager']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/branches"         element={<ProtectedRoute kind="staff" roles={['admin']}><ManageBranches /></ProtectedRoute>} />
                    <Route path="/admin/staff"             element={<ProtectedRoute kind="staff" roles={['admin']}><ManageStaff /></ProtectedRoute>} />
                    <Route path="/admin/integrity"        element={<ProtectedRoute kind="staff" roles={['admin']}><IntegrityCheck /></ProtectedRoute>} />
                    <Route path="/admin/logs"             element={<ProtectedRoute kind="staff" roles={['admin','manager','analyst']}><AuditLogs /></ProtectedRoute>} />
                    <Route path="/admin/reports"          element={<ProtectedRoute kind="staff" roles={['admin','manager']}><Reports /></ProtectedRoute>} />

                    <Route path="*" element={<div className="card"><h2>404</h2><p>Page not found.</p></div>} />
                </Routes>
            </main>
            <footer className="footer">
                SecureBank · CS232 Database Management Systems · Semester Project
            </footer>
        </div>
    );
}
