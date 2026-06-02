// frontend/src/api/axios.js
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 15000,
});

// Attach JWT from localStorage on every outgoing request.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sb_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Surface a clean error message on every failure.
api.interceptors.response.use(
    (resp) => resp,
    (err) => {
        const msg =
            err.response?.data?.error ||
            err.response?.data?.message ||
            err.message ||
            'Network error';
        return Promise.reject(new Error(msg));
    }
);

export default api;
