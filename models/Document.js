const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientEmail: String,
    name: String,
    summary: String,
    fileData: Buffer,
    fileMimetype: String,
    clinicId: String,
    date: { type: String, default: () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', documentSchema);
