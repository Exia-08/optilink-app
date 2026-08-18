require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initClientDB } = require('./clientDB');

const app = express();
const PORT = process.env.PORT || 3000;

const APP_TYPE = process.env.APP_TYPE || 'client';
const PUBLIC_DIR = APP_TYPE === 'admin' ? 'admin_public' : 'client_public';

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, PUBLIC_DIR)));

// Connect to the primary database
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ Primary MongoDB connected');
})
.catch(err => {
    console.error('❌ Primary MongoDB connection error:', err);
    process.exit(1);
});

// If this is the admin service, connect to the client DB as well
if (APP_TYPE === 'admin' && process.env.CLIENT_MONGODB_URI) {
    initClientDB(process.env.CLIENT_MONGODB_URI);
}

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const stockRoutes = require('./routes/stock');
const appointmentRoutes = require('./routes/appointments');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

const StockItem = require('./models/StockItem');
async function seedStock() {
    try {
        const count = await StockItem.countDocuments();
        if (count === 0) {
            const seedData = [
                { name: 'Classic Black Frame', type: 'frame', quantity: 25, total: 30, color: '#1B1730' },
                { name: 'Classic Brown Frame', type: 'frame', quantity: 15, total: 20, color: '#8b5a2b' },
                { name: 'Round Gold Frame', type: 'frame', quantity: 8, total: 20, color: '#d4af37' },
                { name: 'Round Silver Frame', type: 'frame', quantity: 12, total: 15, color: '#9aa0a6' },
                { name: 'Cat Eye Pink Frame', type: 'frame', quantity: 0, total: 10, color: '#f0a8c0' },
                { name: 'Wayfarer Tortoise Frame', type: 'frame', quantity: 20, total: 25, color: '#a0522d' },
                { name: 'Single Vision Standard', type: 'lens', category: 'Prescription', quantity: 60, total: 60, tag: 'Most Popular' },
                { name: 'High-Index Thin Lenses', type: 'lens', category: 'Prescription', quantity: 22, total: 30, tag: 'Recommended' },
                { name: 'Progressive (No-Line) Lenses', type: 'lens', category: 'Prescription', quantity: 3, total: 15 },
                { name: 'Bifocal Lenses', type: 'lens', category: 'Prescription', quantity: 11, total: 20 },
                { name: 'Blue Light Blocking Lenses', type: 'lens', category: 'Coatings & Enhancements', quantity: 5, total: 20 },
                { name: 'Anti-Reflective Coating', type: 'lens', category: 'Coatings & Enhancements', quantity: 42, total: 50, tag: 'Most Popular' },
                { name: 'Scratch-Resistant Coating', type: 'lens', category: 'Coatings & Enhancements', quantity: 48, total: 50 },
                { name: 'UV Protection Lenses', type: 'lens', category: 'Coatings & Enhancements', quantity: 50, total: 50 },
                { name: 'Photochromic Lenses', type: 'lens', category: 'Specialty', quantity: 30, total: 40, tag: 'Popular' },
                { name: 'Polarized Sunglass Lenses', type: 'lens', category: 'Specialty', quantity: 18, total: 30 }
            ];
            await StockItem.insertMany(seedData);
            console.log('✅ Stock data seeded');
        }
    } catch (err) {
        console.error('Seed error:', err);
    }
}
seedStock();

app.get('*', (req, res) => {
    const entryFile = APP_TYPE === 'admin' ? 'admin-login.html' : 'index.html';
    res.sendFile(path.join(__dirname, PUBLIC_DIR, entryFile));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
