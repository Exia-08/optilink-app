// routes/appointments.js
const express = require('express');
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const router = express.Router();

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

// POST /api/appointments — client creates booking
router.post('/', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const { fullName, email, phone, notes, date, time, type, clinic, clinicAddress, clinicId } = req.body;
    if (!fullName || !email || !phone || !date || !time || !clinicId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const appointment = await Appointment.create({
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

// GET /api/appointments — list current user's appointments (optional)
router.get('/', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ appointments: [] });

    const appointments = await Appointment.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json({ appointments });
});

module.exports = router;
