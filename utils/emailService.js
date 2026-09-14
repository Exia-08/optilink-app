const { Resend } = require('resend');

// TEMPORARY: hardcoded key to confirm the code works
const KEY = process.env.RESEND_API_KEY || 're_MWSgeop5_erm6U5RA1jSJrUL9AfWghXgP';

console.log('🔑 Key loaded:', KEY.startsWith('re_') ? 'YES' : 'NO');

let resend = null;
if (KEY && KEY.startsWith('re_')) {
    resend = new Resend(KEY);
} else {
    console.warn('⚠️ No valid key found');
}

async function sendVerificationEmail(to, token) {
    if (!resend) {
        console.warn(`⚠️ Skipping email to ${to} (no key)`);
        return;
    }

    const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email.html?token=${token}`;

    try {
        await resend.emails.send({
            from: 'OptiLink <onboarding@resend.dev>',
            to: to,
            subject: 'Verify your OptiLink account',
            html: `
                <div style="font-family: Arial, sans-serif; background:#FAFAFD; padding:40px 0;">
                    <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:16px; padding:40px 30px; text-align:center; border:1px solid #E7E4F5;">
                        <h1 style="font-size:26px; color:#2b5876; margin:0 0 16px;">Verify your email</h1>
                        <p style="color:#4B4768; font-size:15px; margin:0 0 30px;">
                            To keep things secure, please verify your email using the button below.
                        </p>
                        <a href="${verifyUrl}"
                           style="display:inline-block; background:#22C3E6; color:#fff; text-decoration:none;
                                  padding:14px 40px; border-radius:999px; font-weight:600; font-size:16px;">
                            Click to verify
                        </a>
                        <p style="color:#8985A3; font-size:12px; margin-top:30px;">
                            Or copy this link: ${verifyUrl}
                        </p>
                    </div>
                </div>
            `,
        });
        console.log(`✅ Verification email sent to ${to}`);
    } catch (err) {
        console.error(`❌ Failed to send to ${to}:`, err.message);
        throw err;
    }
}

module.exports = { sendVerificationEmail };
