const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/emailService');

const router = express.Router();

// Generate JWT token
function generateToken(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Helper to get user from cookie token
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

// ---------- SEND VERIFICATION EMAIL ----------
router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Check if email already registered and fully verified
        const existing = await User.findOne({ email });
        if (existing && existing.isVerified && existing.password !== 'pending') {
            return res.status(400).json({ error: 'Email is already registered' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        // Create or update a temporary user record (unverified)
        await User.findOneAndUpdate(
            { email },
            {
                email,
                isVerified: false,
                verificationToken: token,
                verificationTokenExpires: expires,
                password: 'pending',
                fullName: '',
                role: 'client'
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await sendVerificationEmail(email, token);

        res.json({ message: 'Verification email sent. Please check your inbox.' });
    } catch (err) {
        console.error('Send code error:', err);
        res.status(500).json({ error: 'Could not send email' });
    }
});

// ---------- VERIFY EMAIL (link click) ----------
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send('Verification token missing.');

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpires: { $gt: Date.now() },
        });

        if (!user) return res.status(400).send('Invalid or expired verification link.');

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        res.redirect('/verify-email.html?verified=1');
    } catch (err) {
        console.error('Verify email error:', err);
        res.status(500).send('Server error');
    }
});

// ---------- CLIENT SIGNUP ----------
router.post('/signup', async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const existing = await User.findOne({ email });
        if (!existing) {
            return res.status(400).json({ error: 'Please verify your email first.' });
        }
        if (!existing.isVerified) {
            return res.status(400).json({ error: 'Email not verified yet. Please check your inbox.' });
        }

        // Password strength check
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ error: 'Password does not meet requirements' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        existing.fullName = fullName;
        existing.phone = phone;
        existing.password = hashedPassword;
        await existing.save();

        // Auto-login after signup
        const token = generateToken(existing);
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });

        res.status(201).json({
            user: {
                id: existing._id,
                fullName: existing.fullName,
                email: existing.email,
                phone: existing.phone,
                role: existing.role,
                settings: existing.settings,
                insurance: existing.insurance,
            },
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---------- LOGIN (CLIENT OR ADMIN) ----------
router.post('/login', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        const identifier = username || email;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }

        const user = await User.findOne({
            $or: [
                { username: identifier },
                { email: identifier }
            ]
        });

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Block if signup was never completed
        if (user.password === 'pending') {
            return res.status(403).json({ error: 'Please complete your signup by verifying your email.' });
        }

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
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---------- ADMIN REGISTRATION (CLINIC-SPECIFIC) ----------
router.post('/register', async (req, res) => {
    try {
        const { username, email, role, clinicId, password } = req.body;

        if (!username || !email || !role || !clinicId || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(400).json({ error: 'Username or email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const fullName = username;

        const user = await User.create({
            fullName,
            username,
            email,
            password: hashedPassword,
            role: 'admin',
            adminRole: role,
            clinicId,
            isVerified: true
        });

        res.status(201).json({ message: 'Admin account created', username: user.username });
    } catch (err) {
        console.error('Admin register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ---------- GET CURRENT USER ----------
router.get('/me', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ user: null });

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
            adminRole: user.adminRole,
            isVerified: user.isVerified,
        }
    });
});

// ---------- UPDATE SETTINGS ----------
router.put('/settings', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    user.settings = req.body;
    await user.save();
    res.json({ settings: user.settings });
});

// ---------- UPDATE PROFILE ----------
router.put('/profile', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    const { fullName, email, phone } = req.body;
    if (!fullName || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    user.fullName = fullName;
    user.email = email;
    user.phone = phone;
    await user.save();

    res.json({
        user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            settings: user.settings
        }
    });
});

// ---------- UPDATE INSURANCE ----------
router.put('/insurance', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });

    user.insurance = req.body;
    await user.save();
    res.json({ insurance: user.insurance });
});

// ---------- CHANGE PASSWORD ----------
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

// ---------- LOGOUT ----------
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

module.exports = router;
