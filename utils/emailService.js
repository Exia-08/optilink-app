const { Resend } = require('resend');

// 🔍 Diagnostic log — will show in Render startup logs
console.log('🔑 RESEND_API_KEY status:', process.env.RESEND_API_KEY
    ? `SET (starts with ${process.env.RESEND_API_KEY.slice(0, 5)}...)`
    : 'MISSING');

// Initialize Resend only if the API key exists
let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
} else {
    console.warn('⚠️ RESEND_API_KEY missing — email sending disabled.');
}

/**
 * Send a verification email with a "Click to verify" button.
 * @param {string} to - Recipient email address.
 * @param {string} token - Verification token.
 */
async function sendVerificationEmail(to, token) {
    if (!resend) {
        console.warn(`⚠️ Skipping verification email to ${to} (no API key configured)`);
        return;
    }

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html?token=${token}`;

    try {
        await resend.emails.send({
            // Use Resend's test domain for initial testing.
            // You can replace this with your own verified domain later.
            from: 'OptiLink <onboarding@resend.dev>',
            to: to,
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
        });
        console.log(`✅ Verification email sent to ${to}`);
    } catch (err) {
        console.error(`❌ Failed to send verification email to ${to}:`, err.message);
        throw err;
    }
}

module.exports = { sendVerificationEmail };
