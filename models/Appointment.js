const mongoose = require('mongoose');

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
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);