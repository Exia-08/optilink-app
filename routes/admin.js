const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getClientConnection } = require('../clientDB');

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

async function requireAdmin(req, res, next) {
    const admin = await getAdminFromToken(req);
    if (!admin) return res.status(401).json({ error: 'Admin access required' });
    req.admin = admin;
    next();
}

// Get the client DB connection and define models for client data
const clientConn = getClientConnection();

const appointmentSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    fullName: String,
    email: String,
    phone: String,
    notes: String,
    date: String,
    time: String,
    type: String,
    status: { type: String, enum: ['Pending', 'Approved', 'Cancelled'], default: 'Pending' },
    clinic: String,
    clinicAddress: String,
    createdAt: { type: Date, default: Date.now }
});

const stockItemSchema = new mongoose.Schema({
    name: String,
    type: String,
    category: String,
    quantity: Number,
    total: Number,
    color: String,
    desc: String,
    tag: String
});

const documentSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    clientEmail: String,
    name: String,
    summary: String,
    fileData: Buffer,
    fileMimetype: String,
    date: String,
    createdAt: { type: Date, default: Date.now }
});

let ClientAppointment = null;
let ClientStockItem = null;
let ClientDocument = null;

if (clientConn) {
    ClientAppointment = clientConn.model('Appointment', appointmentSchema);
    ClientStockItem = clientConn.model('StockItem', stockItemSchema);
    ClientDocument = clientConn.model('Document', documentSchema);
}

// ✅ Appointments (from client DB)
router.get('/appointments', requireAdmin, async (req, res) => {
    if (!ClientAppointment) return res.status(500).json({ error: 'Client DB not connected' });
    const appointments = await ClientAppointment.find().sort({ createdAt: -1 });
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
            notes: a.notes,
            clinic: a.clinic,
            clinicAddress: a.clinicAddress
        }))
    });
});

router.put('/appointments/:id/status', requireAdmin, async (req, res) => {
    if (!ClientAppointment) return res.status(500).json({ error: 'Client DB not connected' });
    const { status } = req.body;
    const appointment = await ClientAppointment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ appointment });
});

// ✅ Stock (from client DB)
router.get('/stock', requireAdmin, async (req, res) => {
    if (!ClientStockItem) return res.status(500).json({ error: 'Client DB not connected' });
    const stock = await ClientStockItem.find();
    res.json({ stock });
});

router.put('/stock/:id', requireAdmin, async (req, res) => {
    if (!ClientStockItem) return res.status(500).json({ error: 'Client DB not connected' });
    const { quantity, total } = req.body;
    const item = await ClientStockItem.findByIdAndUpdate(req.params.id, { quantity, total }, { new: true });
    res.json({ item });
});

// ✅ Documents (from client DB)
router.get('/documents', requireAdmin, async (req, res) => {
    if (!ClientDocument) return res.status(500).json({ error: 'Client DB not connected' });
    const docs = await ClientDocument.find().populate('userId', 'fullName email');
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

// ✅ Summary (appointments + low stock from client DB, clients from admin DB)
router.get('/summary', requireAdmin, async (req, res) => {
    if (!ClientAppointment || !ClientStockItem) return res.status(500).json({ error: 'Client DB not connected' });

    const totalAppointments = await ClientAppointment.countDocuments();
    const pending = await ClientAppointment.countDocuments({ status: 'Pending' });
    const lowStock = await ClientStockItem.countDocuments({ quantity: { $lt: 10 } });
    const totalClients = await User.countDocuments({ role: 'client' });

    res.json({ totalAppointments, pending, totalClients, lowStock });
});

module.exports = router;
