const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const User = require('../models/User');
const { getClientConnection } = require('../clientDB');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Admin Auth ----------
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

// ---------- Client DB Connection ----------
const clientConn = getClientConnection();

const appointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    clinicId: String,
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
    tag: String,
    clinicId: String
});

const documentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientEmail: String,
    name: String,
    summary: String,
    fileData: Buffer,
    fileMimetype: String,
    date: String,
    clinicId: String,
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

// ---------- Appointments ----------
router.get('/appointments', requireAdmin, async (req, res) => {
    if (!ClientAppointment) return res.status(500).json({ error: 'Client DB not connected' });

    const filter = { clinicId: req.admin.clinicId || null };
    const appointments = await ClientAppointment.find(filter).sort({ createdAt: -1 });

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
            clinicAddress: a.clinicAddress,
            clinicId: a.clinicId
        }))
    });
});

router.put('/appointments/:id/status', requireAdmin, async (req, res) => {
    if (!ClientAppointment) return res.status(500).json({ error: 'Client DB not connected' });

    const { status } = req.body;
    try {
        const appointment = await ClientAppointment.findOneAndUpdate(
            { _id: req.params.id, clinicId: req.admin.clinicId || null },
            { status },
            { new: true }
        );
        if (!appointment) return res.status(404).json({ error: 'Appointment not found for this clinic' });
        res.json({ appointment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Update failed' });
    }
});

// ---------- Stock ----------
router.get('/stock', requireAdmin, async (req, res) => {
    if (!ClientStockItem) return res.status(500).json({ error: 'Client DB not connected' });

    const stock = await ClientStockItem.find({ clinicId: req.admin.clinicId || null }).sort({ name: 1 });
    res.json({ stock });
});

router.put('/stock/:id', requireAdmin, async (req, res) => {
    if (!ClientStockItem) return res.status(500).json({ error: 'Client DB not connected' });

    const { quantity, total } = req.body;
    try {
        const item = await ClientStockItem.findOneAndUpdate(
            { _id: req.params.id, clinicId: req.admin.clinicId || null },
            { quantity, total },
            { new: true }
        );
        if (!item) return res.status(404).json({ error: 'Stock item not found for this clinic' });
        res.json({ item });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Stock update failed' });
    }
});

// ---------- Documents ----------
router.get('/documents', requireAdmin, async (req, res) => {
    if (!ClientDocument) return res.status(500).json({ error: 'Client DB not connected' });

    const docs = await ClientDocument.find({ clinicId: req.admin.clinicId || null })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });

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

router.post('/documents', requireAdmin, upload.single('file'), async (req, res) => {
    if (!ClientDocument) return res.status(500).json({ error: 'Client DB not connected' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const doc = await ClientDocument.create({
            clientEmail: req.body.email,
            name: req.file.originalname,
            summary: req.body.summary || '',
            fileData: req.file.buffer,
            fileMimetype: req.file.mimetype,
            clinicId: req.admin.clinicId || null,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });

        res.status(201).json({ document: doc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// ---------- Summary (clinic-scoped) ----------
router.get('/summary', requireAdmin, async (req, res) => {
    if (!ClientAppointment || !ClientStockItem) {
        return res.status(500).json({ error: 'Client DB not connected' });
    }

    const clinicId = req.admin.clinicId || null;
    const appointmentFilter = { clinicId };
    const stockFilter = { clinicId };

    const totalAppointments = await ClientAppointment.countDocuments(appointmentFilter);
    const pending = await ClientAppointment.countDocuments({ ...appointmentFilter, status: 'Pending' });
    const lowStock = await ClientStockItem.countDocuments({ ...stockFilter, quantity: { $lt: 10 } });
    const totalClients = await User.countDocuments({ role: 'client' });

    // Weekly appointments for this clinic
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diff);

    const weeklyAppointments = [
        { label: 'Mon', value: 0 },
        { label: 'Tue', value: 0 },
        { label: 'Wed', value: 0 },
        { label: 'Thu', value: 0 },
        { label: 'Fri', value: 0 },
        { label: 'Sat', value: 0 },
        { label: 'Sun', value: 0 }
    ];

    const allAppointments = await ClientAppointment.find(appointmentFilter);
    allAppointments.forEach(app => {
        if (!app.date) return;
        const appDate = new Date(app.date);
        if (isNaN(appDate)) return;
        const appDayIndex = (appDate.getDay() + 6) % 7;
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        if (appDate >= startOfWeek && appDate < endOfWeek) {
            weeklyAppointments[appDayIndex].value += 1;
        }
    });

    res.json({
        totalAppointments,
        pending,
        totalClients,
        lowStock,
        weeklyAppointments
    });
});

module.exports = router;
