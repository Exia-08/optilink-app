const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const StockItem = require('../models/StockItem');
const Document = require('../models/Document');

const router = express.Router();

async function getAdminFromToken(req) {
    const token = req.cookies.token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        return user && user.role === 'admin' ? user : null;
    } catch (err) {
        return null;
    }
}

// Middleware to require admin
async function requireAdmin(req, res, next) {
    const admin = await getAdminFromToken(req);
    if (!admin) return res.status(401).json({ error: 'Admin access required' });
    req.admin = admin;
    next();
}

// Get all appointments
router.get('/appointments', requireAdmin, async (req, res) => {
    const appointments = await Appointment.find().sort({ createdAt: -1 });
    res.json({
        appointments: appointments.map(a => ({
            id: a._id,
            name: a.fullName,
            type: a.type,
            date: a.date,
            time: a.time,
            status: a.status,
            email: a.email,
            phone: a.phone,
            notes: a.notes
        }))
    });
});

// Update appointment status
router.put('/appointments/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ appointment });
});

// Get all stock (same as public stock)
router.get('/stock', requireAdmin, async (req, res) => {
    const stock = await StockItem.find();
    res.json({ stock });
});

// Update stock item
router.put('/stock/:id', requireAdmin, async (req, res) => {
    const { quantity, total } = req.body;
    const item = await StockItem.findByIdAndUpdate(req.params.id, { quantity, total }, { new: true });
    res.json({ item });
});

// Get all documents
router.get('/documents', requireAdmin, async (req, res) => {
    const docs = await Document.find().populate('userId', 'fullName email');
    res.json({
        documents: docs.map(d => ({
            id: d._id,
            client: d.userId ? d.userId.fullName : d.clientEmail || 'Unknown',
            doc: d.name,
            date: d.date,
            summary: d.summary,
            downloadUrl: `/api/documents/${d._id}/download`
        }))
    });
});

// Upload document for a client (admin)
router.post('/documents', requireAdmin, async (req, res) => {
    // For simplicity, we'll accept JSON metadata only (no file upload in admin)
    // Use the normal document upload route for actual files.
    res.status(501).json({ error: 'Use client upload endpoint' });
});

// Summary stats
router.get('/summary', requireAdmin, async (req, res) => {
    const totalAppointments = await Appointment.countDocuments();
    const pending = await Appointment.countDocuments({ status: 'Pending' });
    const totalClients = await User.countDocuments({ role: 'client' });
    const lowStock = await StockItem.countDocuments({ quantity: { $lt: 10 } });
    res.json({ totalAppointments, pending, totalClients, lowStock });
});

module.exports = router;