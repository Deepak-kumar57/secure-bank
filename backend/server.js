// backend/server.js
// SecureBank — Express entry point.

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRoutes     = require('./src/routes/authRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const staffRoutes    = require('./src/routes/staffRoutes');
const fraudRoutes    = require('./src/routes/fraudRoutes');
const adminRoutes    = require('./src/routes/adminRoutes');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '256kb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'SecureBank API', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth',     authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/staff',    staffRoutes);
app.use('/api/fraud',    fraudRoutes);
app.use('/api/admin',    adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, () => {
    console.log(`SecureBank API listening on http://localhost:${PORT}`);
});
