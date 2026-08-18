const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function generateToken(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Helper to get user from token
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

// Client signup
router.post('/signup', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password required' });
        }
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ fullName, email, phone, password: hashedPassword, role: 'client' });

        const token = generateToken(user);
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
        res.status(201).json({ user: { id: user._id, fullName, email, phone, role: 'client', settings: user.settings } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login (client or admin)
router.post('/login', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const identifier = username || email;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier }]
        });

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        if (role && user.role !== role) {
            return res.status(403).json({ error: 'Unauthorized role' });
        }

        const token = generateToken(user);
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
        res.json({
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
                phone: user.phone,
                role: user.role,
                settings: user.settings,
                insurance: user.insurance,
                clinicId: user.clinicId,
                adminRole: user.adminRole
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin registration is intentionally disabled for security.
// To create an admin account, use a controlled seed script or insert directly into MongoDB Atlas.
router.post('/register', (req, res) => {
    res.status(403).json({ error: 'Admin registration is disabled' });
});

// Get current user
router.get('/me', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ user: null });
    res.json({
        user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            settings: user.settings,
            insurance: user.insurance,
            clinicId: user.clinicId,
            adminRole: user.adminRole
        }
    });
});

// Update settings
router.put('/settings', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    user.settings = req.body;
    await user.save();
    res.json({ settings: user.settings });
});

// Update profile
router.put('/profile', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    const { fullName, email, phone } = req.body;
    if (!fullName || !email) return res.status(400).json({ error: 'Name and email required' });
    user.fullName = fullName;
    user.email = email;
    user.phone = phone;
    await user.save();
    res.json({ user: { id: user._id, fullName, email, phone, role: user.role, settings: user.settings } });
});

// Update insurance
router.put('/insurance', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    user.insurance = req.body;
    await user.save();
    res.json({ insurance: user.insurance });
});

// Change password
router.post('/change-password', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    const { currentPassword, newPassword } = req.body;
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated' });
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

module.exports = router;
