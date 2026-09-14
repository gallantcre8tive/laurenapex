const nodemailer = require('nodemailer');

function fromHeader() {
  const name = process.env.MAIL_FROM_NAME || 'Lauren Apex Global';
  const email = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev';
  return `"${name}" <${email}>`;
}

function layout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#0a1628;padding:18px 24px;">
          <p style="margin:0;color:#e8b923;font-size:16px;font-weight:bold;">Lauren Apex Global</p>
        </td></tr>
        <tr><td style="padding:28px 24px;color:#0a1628;">
          <h1 style="margin:0 0 12px;font-size:20px;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#64748b;">Lauren Apex Global — if you did not request this, ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Resend.com HTTP API — reliable for OTPs (free tier) */
async function sendWithResend({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not set');
  const from =
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM_EMAIL ||
    'Lauren Apex Global <onboarding@resend.dev>';

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 15000);

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from,
        to: [to],
        subject: subject,
        html: html,
        text: text || undefined
      }),
      signal: controller.signal
    });
    const data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      throw new Error((data && data.message) || ('Resend HTTP ' + r.status));
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function createTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be set');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 12000
  });
}

async function sendWithSmtp({ to, subject, html, text }) {
  const transporter = createTransport();
  const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
  return transporter.sendMail({
    from: fromHeader(),
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    replyTo: fromEmail
  });
}

async function sendMail({ to, subject, html, text }) {
  // Prefer Resend if configured (works from Render; Gmail SMTP often blocked)
  if (process.env.RESEND_API_KEY) {
    return sendWithResend({ to, subject, html, text });
  }
  return sendWithSmtp({ to, subject, html, text });
}

async function sendVerificationCode(email, code, name) {
  const display = name || email.split('@')[0];
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;">Hello ${display},</p>
    <p style="margin:0 0 12px;font-size:15px;">Your Lauren Apex Global verification code:</p>
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;background:#0a1628;color:#e8b923;font-size:26px;font-weight:bold;letter-spacing:8px;border-radius:8px;">${code}</span>
    </p>
    <p style="margin:0;font-size:14px;color:#475569;">Expires in <strong>15 minutes</strong>. Do not share this code.</p>`;
  return sendMail({
    to: email,
    subject: 'Your Lauren Apex verification code',
    html: layout({ title: 'Email verification', bodyHtml }),
    text: `Your verification code is ${code}. Expires in 15 minutes.`
  });
}

async function sendPasswordResetCode(email, code, name) {
  const display = name || email.split('@')[0];
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hello ${display},</p>
    <p style="margin:0 0 12px;">Password reset code:</p>
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;background:#0a1628;color:#e8b923;font-size:26px;font-weight:bold;letter-spacing:8px;border-radius:8px;">${code}</span>
    </p>
    <p style="margin:0;font-size:14px;color:#475569;">Expires in 15 minutes.</p>`;
  return sendMail({
    to: email,
    subject: 'Reset your Lauren Apex password',
    html: layout({ title: 'Password reset', bodyHtml }),
    text: `Password reset code: ${code}`
  });
}

async function sendWithdrawalNotice(email, { amount, details, name }) {
  const display = name || email.split('@')[0];
  const safeDetails = String(details || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = `
    <p>Hello ${display},</p>
    <p>We received your withdrawal request.</p>
    <p><strong>Amount:</strong> ${amount || '—'}</p>
    <p><strong>Destination:</strong><br>${safeDetails}</p>
    <p><strong>Status:</strong> Pending review</p>`;
  return sendMail({
    to: email,
    subject: 'Withdrawal request received — Lauren Apex Global',
    html: layout({ title: 'Withdrawal request', bodyHtml }),
    text: `Withdrawal request received. Amount: ${amount}. Status: Pending.`
  });
}

module.exports = {
  sendVerificationCode,
  sendPasswordResetCode,
  sendWithdrawalNotice,
  sendMail
};
