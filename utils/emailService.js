const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send a verification email with a "Click to verify" button.
 * @param {string} to - Recipient email.
 * @param {string} token - Verification token.
 */
async function sendVerificationEmail(to, token) {
    const verifyUrl = `${process.env.APP_URL}/verify-email.html?token=${token}`;

    const mailOptions = {
        from: `OptiLink <${process.env.SMTP_USER}>`,
        to,
        subject: 'Verify your OptiLink account',
        html: `
            <div style="font-family: -apple-system, Arial, sans-serif; background:#FAFAFD; padding:40px 0;">
                <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:16px; padding:40px 30px; text-align:center; border:1px solid #E7E4F5;">
                    <div style="width:50px; height:50px; border-radius:50%; background:#1B1730; display:inline-flex; align-items:center; justify-content:center; margin-bottom:20px;">
                        <span style="color:#fff; font-size:24px;">&#9993;</span>
                    </div>
                    <h1 style="font-size:26px; color:#2b5876; margin:0 0 16px; font-weight:700;">Verify your email</h1>
                    <p style="color:#4B4768; font-size:15px; line-height:1.5; margin:0 0 30px;">
                        To keep things secure and make sure your account is protected,
                        please verify your email using the button below.
                    </p>
                    <a href="${verifyUrl}"
                       style="display:inline-block; background:#22C3E6; color:#fff; text-decoration:none;
                              padding:14px 40px; border-radius:999px; font-weight:600; font-size:16px;">
                        Click to verify
                    </a>
                    <p style="color:#8985A3; font-size:12px; margin-top:30px;">
                        If the button doesn't work, copy this link into your browser:<br>
                        <a href="${verifyUrl}" style="color:#22C3E6;">${verifyUrl}</a>
                    </p>
                    <p style="color:#8985A3; font-size:12px; margin-top:20px;">
                        This link expires in 24 hours.
                    </p>
                </div>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
