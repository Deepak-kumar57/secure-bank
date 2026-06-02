// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const TOKEN_KEY = 'sb_token';
const USER_KEY  = 'sb_user';
const KIND_KEY  = 'sb_kind';   // 'customer' | 'staff'

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user,  setUser]  = useState(() => {
        try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
        catch { return null; }
    });
    const [kind, setKind] = useState(() => localStorage.getItem(KIND_KEY)); // 'customer' | 'staff'

    useEffect(() => {
        if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
        if (user)  localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY);
        if (kind)  localStorage.setItem(KIND_KEY, kind); else localStorage.removeItem(KIND_KEY);
    }, [token, user, kind]);

    async function customerLogin(email, password) {
        const { data } = await api.post('/auth/customer/login', { email, password });
        setToken(data.token); setUser(data.user); setKind('customer');
        return data;
    }

    async function customerRegister(payload) {
        const { data } = await api.post('/auth/customer/register', payload);
        setToken(data.token); setUser(data.user); setKind('customer');
        return data;
    }

    async function staffLogin(email, password) {
        const { data } = await api.post('/auth/staff/login', { email, password });
        setToken(data.token); setUser(data.staff); setKind('staff');
        return data;
    }

    function logout() {
        setToken(null); setUser(null); setKind(null);
    }

    const role = kind === 'staff' ? user?.role : null;

    return (
        <AuthContext.Provider value={{
            token, user, kind, role,
            isAuthed: !!token,
            customerLogin, customerRegister, staffLogin, logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
    return ctx;
}
