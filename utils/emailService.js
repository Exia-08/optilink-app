const nodemailer = require('nodemailer');

// Create transporter using generic SMTP settings from environment variables.
// This makes it flexible for any email provider.
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send a verification code to the user's email.
 * @param {string} to - Recipient email address.
 * @param {string} code - 6-digit verification code.
 */
async function sendVerificationEmail(to, code) {
    const mailOptions = {
        from: `OptiLink <${process.env.SMTP_USER}>`,
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
