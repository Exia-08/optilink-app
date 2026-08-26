const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getClientConnection } = require('../clientDB');

const router = express.Router();

// ---------- Client DB model definition ----------
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

let ClientAppointment = null;

if (clientConn) {
    ClientAppointment = clientConn.models['Appointment'] || clientConn.model('Appointment', appointmentSchema);
}

// ---------- Auth helper ----------
async function getUserFromToken(req) {
    const token = req.cookies.token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return await User.findById(decoded.id);
    } catch (err) {
        return null;
    }
}

// ---------- Routes ----------
// POST /api/appointments - create booking
router.post('/', async (req, res) => {
    if (!ClientAppointment) return res.status(500).json({ error: 'Client DB not connected' });

    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const { fullName, email, phone, notes, date, time, type, clinic, clinicAddress, clinicId } = req.body;
    if (!fullName || !email || !phone || !date || !time || !clinicId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const appointment = await ClientAppointment.create({
            userId: user._id,
            fullName,
            email,
            phone,
            notes,
            date,
            time,
            type: type || 'Eye Exam',
            clinic,
            clinicAddress,
            clinicId,
            status: 'Pending'
        });
        res.status(201).json({ appointment });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/appointments - list current user's appointments
router.get('/', async (req, res) => {
    if (!ClientAppointment) return res.json({ appointments: [] });

    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ appointments: [] });

    const appointments = await ClientAppointment.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json({ appointments });
});

module.exports = router;
