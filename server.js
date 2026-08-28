require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initClientDB } = require('./clientDB');

const app = express();
const PORT = process.env.PORT || 3000;

// Determine which public folder to serve
const APP_TYPE = process.env.APP_TYPE || 'client';
const PUBLIC_DIR = APP_TYPE === 'admin' ? 'admin_public' : 'client_public';

// Middleware
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the selected public folder
app.use(express.static(path.join(__dirname, PUBLIC_DIR)));

// Serve images from the root images folder (for shared assets)
app.use('/images', express.static(path.join(__dirname, 'images')));

// Connect to primary database
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Primary MongoDB connected'))
.catch(err => {
    console.error('❌ Primary MongoDB connection error:', err);
    process.exit(1);
});

// Always connect to the client database (fallback to primary URI)
const clientUri = process.env.CLIENT_MONGODB_URI || process.env.MONGODB_URI;
if (clientUri) {
    initClientDB(clientUri);
} else {
    console.warn('⚠️ No MongoDB URI available for client DB. Client booking will not work.');
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

// Clinic list used for seeding stock
const clinics = [
    { id: 'clinic1', name: 'OptiLink Main Branch' },
    { id: 'clinic2', name: 'OptiLink SM North EDSA' },
    { id: 'clinic3', name: 'OptiLink Medical Plaza' },
    { id: 'clinic4', name: 'OptiLink Ayala Center' },
    { id: 'clinic5', name: 'OptiLink BGC' }
];

// Seed clinic-specific stock if no items exist for a clinic
const StockItem = require('./models/StockItem');
async function seedStock() {
    try {
        for (const clinic of clinics) {
            const count = await StockItem.countDocuments({ clinicId: clinic.id });
            if (count > 0) continue;

            const seedData = [
                { name: 'Classic Black Frame', type: 'frame', quantity: 25, total: 30, clinicId: clinic.id },
                { name: 'Classic Brown Frame', type: 'frame', quantity: 15, total: 20, clinicId: clinic.id },
                { name: 'Single Vision Standard', type: 'lens', category: 'Prescription', quantity: 60, total: 60, clinicId: clinic.id },
                { name: 'Blue Light Blocking Lenses', type: 'lens', category: 'Coatings & Enhancements', quantity: 5, total: 20, clinicId: clinic.id },
                { name: 'Anti-Reflective Coating', type: 'lens', category: 'Coatings & Enhancements', quantity: 42, total: 50, clinicId: clinic.id },
                { name: 'Photochromic Lenses', type: 'lens', category: 'Specialty', quantity: 30, total: 40, clinicId: clinic.id }
            ];

            await StockItem.insertMany(seedData);
            console.log(`✅ Stock seeded for ${clinic.name}`);
        }
        console.log('✅ Clinic-specific stock seeding complete');
    } catch (err) {
        console.error('Seed error:', err);
    }
}
seedStock();

// Catch-all: serve the appropriate entry HTML file
app.get('*', (req, res) => {
    const entryFile = APP_TYPE === 'admin' ? 'admin-login.html' : 'index.html';
    res.sendFile(path.join(__dirname, PUBLIC_DIR, entryFile));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
