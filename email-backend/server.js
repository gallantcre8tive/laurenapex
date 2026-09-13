/**
 * Lauren Apex Global — email API
 * Run: npm install && copy .env.example to .env && npm start
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  sendVerificationCode,
  sendPasswordResetCode,
  sendWithdrawalNotice
} = require('./utils/emailService');

const app = express();
const PORT = Number(process.env.PORT || 5050);

app.use(cors({ origin: true }));
app.use(express.json());

// Simple file store for reset codes (no DB required for this static site)
const STORE_FILE = path.join(__dirname, 'data-store.json');
function readStore() {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch (e) {}
  return { resets: {}, users: {} };
}
function writeStore(data) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}
function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

app.get('/', (req, res) => {
  res.type('text').send('Lauren Apex email API is running. Use /api/health');
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'lauren-apex-email',
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
  });
});

/** Signup verification email */
app.post('/api/send-verification', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const name = String(req.body.name || '').trim();
    if (!email || !code) {
      return res.status(400).json({ ok: false, message: 'email and code required' });
    }
    await sendVerificationCode(email, code, name);
    res.json({ ok: true, message: 'Verification email sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message || 'Failed to send email' });
  }
});

/** Forgot password — generate code, email it, store hash */
app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const store = readStore();
    store.resets[email] = {
      hash: hashCode(code),
      expires: Date.now() + 15 * 60 * 1000,
      attempts: 0
    };
    writeStore(store);

    await sendPasswordResetCode(email, code, email.split('@')[0]);
    // Always same response (no email enumeration)
    res.json({ ok: true, message: 'If the account exists, a reset code was sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message || 'Failed to send reset email' });
  }
});

/** Verify reset code only */
app.post('/api/verify-reset-code', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const store = readStore();
    const row = store.resets[email];
    if (!row || row.expires < Date.now() || row.hash !== hashCode(code)) {
      if (row) {
        row.attempts = (row.attempts || 0) + 1;
        writeStore(store);
      }
      return res.status(400).json({ ok: false, message: 'Invalid or expired code' });
    }
    res.json({ ok: true, message: 'Code valid' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/** Reset password — validates code; frontend still updates localStorage password */
app.post('/api/reset-password', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!email || !code || password.length < 6) {
      return res.status(400).json({ ok: false, message: 'Invalid request' });
    }
    const store = readStore();
    const row = store.resets[email];
    if (!row || row.expires < Date.now() || row.hash !== hashCode(code)) {
      return res.status(400).json({ ok: false, message: 'Invalid or expired code' });
    }
    delete store.resets[email];
    writeStore(store);
    // Password change is applied on the client (localStorage user record)
    res.json({ ok: true, message: 'Password reset allowed', email });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/** Withdrawal notice email */
app.post('/api/send-withdrawal-notice', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    await sendWithdrawalNotice(email, {
      amount: req.body.amount,
      details: req.body.details,
      name: req.body.name
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: err.message });
  }
});


/** ---- User registry (shared across devices via Render) ---- */
app.get('/api/users', (req, res) => {
  try {
    const store = readStore();
    res.json({ ok: true, users: store.users || {} });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const store = readStore();
    store.users = store.users || {};
    const prev = store.users[email] || {};
    store.users[email] = {
      ...prev,
      ...req.body,
      email,
      updatedAt: new Date().toISOString()
    };
    // never store plain password long-term ideally; keep for this static app admin view
    writeStore(store);
    res.json({ ok: true, user: store.users[email] });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.delete('/api/users/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const store = readStore();
    store.users = store.users || {};
    delete store.users[email];
    writeStore(store);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});


app.listen(PORT, () => {
  console.log('Lauren Apex email API on http://127.0.0.1:' + PORT);
  console.log('SMTP configured:', !!(process.env.SMTP_USER && process.env.SMTP_PASS));
});
