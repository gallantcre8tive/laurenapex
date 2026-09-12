const nodemailer = require('nodemailer');

function createTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be set in .env');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user, pass }
  });
}

function fromHeader() {
  const name = process.env.MAIL_FROM_NAME || 'Lauren Apex Global';
  const email = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = createTransport();
  const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from: fromHeader(),
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    replyTo: fromEmail,
    headers: {
      'X-Priority': '3',
      'X-Mailer': 'Lauren Apex Global',
      'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`
    }
  });
  return info;
}

function layout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#0a1628;padding:18px 24px;">
          <p style="margin:0;color:#e8b923;font-size:16px;font-weight:bold;letter-spacing:0.02em;">Lauren Apex Global</p>
        </td></tr>
        <tr><td style="padding:28px 24px;color:#0a1628;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0a1628;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">This message was sent by Lauren Apex Global regarding your account. If you did not expect this email, you can ignore it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendVerificationCode(email, code, name) {
  const display = name || email.split('@')[0];
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hello ${display},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Use the verification code below to activate your Lauren Apex Global account:</p>
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;background:#0a1628;color:#e8b923;font-size:26px;font-weight:bold;letter-spacing:8px;border-radius:8px;">${code}</span>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">This code expires in <strong>15 minutes</strong>.</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Do not share this code with anyone.</p>`;
  return sendMail({
    to: email,
    subject: 'Verify your Lauren Apex Global account',
    html: layout({ title: 'Email verification', bodyHtml }),
    text: `Hello ${display},\n\nYour Lauren Apex Global verification code is: ${code}\n\nExpires in 15 minutes.\n\nLauren Apex Global`
  });
}

async function sendPasswordResetCode(email, code, name) {
  const display = name || email.split('@')[0];
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hello ${display},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">You requested a password reset. Use this code:</p>
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;padding:14px 28px;background:#0a1628;color:#e8b923;font-size:26px;font-weight:bold;letter-spacing:8px;border-radius:8px;">${code}</span>
    </p>
    <p style="margin:0;font-size:14px;color:#475569;">Expires in <strong>15 minutes</strong>. If you did not request this, ignore this email.</p>`;
  return sendMail({
    to: email,
    subject: 'Reset your Lauren Apex Global password',
    html: layout({ title: 'Password reset', bodyHtml }),
    text: `Hello ${display},\n\nPassword reset code: ${code}\nExpires in 15 minutes.\n\nLauren Apex Global`
  });
}

async function sendWithdrawalNotice(email, { amount, details, name }) {
  const display = name || email.split('@')[0];
  const safeDetails = String(details || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;">Hello ${display},</p>
    <p style="margin:0 0 12px;font-size:15px;">We received your withdrawal request.</p>
    <p style="margin:0 0 8px;"><strong>Amount:</strong> ${amount || '—'}</p>
    <p style="margin:0 0 8px;"><strong>Destination:</strong><br>${safeDetails}</p>
    <p style="margin:0 0 12px;"><strong>Status:</strong> Pending review</p>
    <p style="margin:0;font-size:14px;color:#475569;">Our team will process this and update you.</p>`;
  return sendMail({
    to: email,
    subject: 'Withdrawal request received — Lauren Apex Global',
    html: layout({ title: 'Withdrawal request', bodyHtml }),
    text: `Withdrawal request received. Amount: ${amount}. Status: Pending review.`
  });
}

module.exports = {
  sendVerificationCode,
  sendPasswordResetCode,
  sendWithdrawalNotice,
  sendMail
};
