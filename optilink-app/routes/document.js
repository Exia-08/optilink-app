const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const Document = require('../models/Document');
const User = require('../models/User');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: get user from token
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

// Upload document (client)
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const user = await getUserFromToken(req);
        if (!user) return res.status(401).json({ error: 'Not logged in' });

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const doc = await Document.create({
            userId: user._id,
            clientEmail: user.email,
            name: req.file.originalname,
            summary: req.body.summary || '',
            fileData: req.file.buffer,
            fileMimetype: req.file.mimetype
        });

        res.status(201).json({ document: doc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Get documents for current user
router.get('/', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ documents: [] });

    const docs = await Document.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json({
        documents: docs.map(d => ({
            id: d._id,
            name: d.name,
            date: d.date,
            summary: d.summary,
            downloadUrl: `/api/documents/${d._id}/download`
        }))
    });
});

// Download document
router.get('/:id/download', async (req, res) => {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).send('Not found');
    res.setHeader('Content-Type', doc.fileMimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
    res.send(doc.fileData);
});

// Delete document
router.delete('/:id', async (req, res) => {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.userId.toString() !== user._id.toString() && user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

module.exports = router;