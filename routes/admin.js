// routes/admin.js
const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const StockItem = require('../models/StockItem');
const Document = require('../models/Document');

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

// ---------- Appointments ----------
router.get('/appointments', requireAdmin, async (req, res) => {
    try {
        const filter = { clinicId: req.admin.clinicId || null };
        const appointments = await Appointment.find(filter).sort({ createdAt: -1 });

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
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/appointments/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['Pending', 'Approved', 'Cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    try {
        const appointment = await Appointment.findOneAndUpdate(
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
    try {
        const stock = await StockItem.find({ clinicId: req.admin.clinicId || null }).sort({ name: 1 });
        res.json({ stock });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/stock/:id', requireAdmin, async (req, res) => {
    const { quantity, total } = req.body;
    if (typeof quantity !== 'number' || typeof total !== 'number') {
        return res.status(400).json({ error: 'Quantity and total must be numbers' });
    }
    try {
        const item = await StockItem.findOneAndUpdate(
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
    try {
        const docs = await Document.find({ clinicId: req.admin.clinicId || null })
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 });

        res.json({
            documents: docs.map(d => ({
                id: d._id,
                client: d.userId ? d.userId.fullName : d.clientEmail || 'Unknown',
                doc: d.name,
                date: d.date,
                summary: d.summary,
                downloadUrl: `/api/admin/documents/${d._id}/download`  // updated to admin endpoint
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/documents', requireAdmin, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const doc = await Document.create({
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

// Download document (admin)
router.get('/documents/:id/download', requireAdmin, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).send('Not found');
        // Check clinic ownership if needed
        if (doc.clinicId && doc.clinicId !== req.admin.clinicId) {
            return res.status(403).send('Forbidden');
        }
        res.setHeader('Content-Type', doc.fileMimetype);
        res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
        res.send(doc.fileData);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Delete document (admin)
router.delete('/documents/:id', requireAdmin, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Not found' });
        if (doc.clinicId && doc.clinicId !== req.admin.clinicId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await Document.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---------- Summary (clinic-scoped) ----------
router.get('/summary', requireAdmin, async (req, res) => {
    try {
        const clinicId = req.admin.clinicId || null;
        const appointmentFilter = { clinicId };
        const stockFilter = { clinicId };

        const totalAppointments = await Appointment.countDocuments(appointmentFilter);
        const pending = await Appointment.countDocuments({ ...appointmentFilter, status: 'Pending' });
        const lowStock = await StockItem.countDocuments({ ...stockFilter, quantity: { $lt: 10 } });
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

        const allAppointments = await Appointment.find(appointmentFilter);
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
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
