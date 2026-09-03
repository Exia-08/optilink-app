const nodemailer = require('nodemailer');

// Configure transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send a verification code to the user's email.
 * @param {string} to - Recipient email address.
 * @param {string} code - 6-digit verification code.
 */
async function sendVerificationEmail(to, code) {
    const mailOptions = {
        from: `OptiLink <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Verify your OptiLink account',
        html: `
            <h2>Welcome to OptiLink!</h2>
            <p>Please enter the following verification code to activate your account:</p>
            <h1 style="letter-spacing: 5px; font-size: 32px;">${code}</h1>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
        `,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };