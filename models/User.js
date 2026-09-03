const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: String,
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    phone: String,
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    isVerified: { type: Boolean, default: false },
    verificationCode: String,
    verificationCodeExpires: Date,
    settings: {
        pushNotifications: { type: Boolean, default: true },
        emailReminders: { type: Boolean, default: true },
        faceIdLogin: { type: Boolean, default: false }
    },
    insurance: {
        provider: String,
        policyNumber: String,
        groupNumber: String,
        billingAddress: String
    },
    clinicId: String,
    adminRole: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
