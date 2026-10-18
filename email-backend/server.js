/**
 * Lauren Apex Global — API
 * Persistent store: Firebase Realtime Database (survives Render restarts)
 * Fallback: local data-store.json
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
app.use(express.json({ limit: '2mb' }));

const FIREBASE_DB = (process.env.FIREBASE_DB_URL || 'https://laurenapexglobal-default-rtdb.firebaseio.com').replace(/\/$/, '');
const STORE_FILE = path.join(__dirname, 'data-store.json');
const EMPTY = { resets: {}, users: {}, portfolios: {} };

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function readStore() {
  // 1) Firebase RTDB (persistent across Render sleep/redeploy)
  try {
    const r = await fetch(FIREBASE_DB + '/lagStore.json', { method: 'GET' });
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === 'object') {
        return {
          resets: data.resets || {},
          users: data.users || {},
          portfolios: data.portfolios || {}
        };
      }
    }
  } catch (e) {
    console.warn('[store] firebase read failed', e && e.message);
  }
  // 2) Local file fallback
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      return {
        resets: data.resets || {},
        users: data.users || {},
        portfolios: data.portfolios || {}
      };
    }
  } catch (e) {}
  return { ...EMPTY, users: {}, portfolios: {}, resets: {} };
}

async function writeStore(data) {
  const payload = {
    resets: data.resets || {},
    users: data.users || {},
    portfolios: data.portfolios || {},
    updatedAt: new Date().toISOString()
  };
  // Always try Firebase first
  try {
    const r = await fetch(FIREBASE_DB + '/lagStore.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const t = await r.text();
      console.warn('[store] firebase write', r.status, t.slice(0, 200));
    }
  } catch (e) {
    console.warn('[store] firebase write failed', e && e.message);
  }
  // Local backup
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2));
  } catch (e) {}
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error((label || 'Operation') + ' timed out after ' + ms + 'ms'));
      }, ms);
    })
  ]);
}

app.get('/', (req, res) => {
  res.type('text').send('Lauren Apex API is running. Use /api/health');
});

app.get('/api/health', async (req, res) => {
  let storeOk = false;
  let userCount = 0;
  try {
    const store = await readStore();
    storeOk = true;
    userCount = Object.keys(store.users || {}).length;
  } catch (e) {}
  res.json({
    ok: true,
    service: 'lauren-apex-email',
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    resendConfigured: !!process.env.RESEND_API_KEY,
    firebaseDb: FIREBASE_DB,
    storeOk,
    userCount
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
    await withTimeout(sendVerificationCode(email, code, name), 20000, 'SMTP send');
    res.json({ ok: true, message: 'Verification email sent' });
  } catch (err) {
    console.error('[send-verification]', err);
    res.status(500).json({ ok: false, message: err.message || 'Failed to send email' });
  }
});

/** Password reset: send code */
app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const store = await readStore();
    store.resets = store.resets || {};
    store.resets[email] = {
      hash: hashCode(code),
      expires: Date.now() + 15 * 60 * 1000
    };
    await writeStore(store);
    await withTimeout(sendPasswordResetCode(email, code, email.split('@')[0]), 20000, 'Reset email');
    res.json({ ok: true, message: 'If that email is registered, a code was sent' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ ok: false, message: err.message || 'Failed to send reset email' });
  }
});

/** Password reset: verify code + set new password in store */
app.post('/api/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!email || !code || password.length < 6) {
      return res.status(400).json({ ok: false, message: 'email, code and password (min 6) required' });
    }
    const store = await readStore();
    const entry = (store.resets || {})[email];
    if (!entry || entry.expires < Date.now() || entry.hash !== hashCode(code)) {
      return res.status(400).json({ ok: false, message: 'Invalid or expired code' });
    }
    delete store.resets[email];
    store.users = store.users || {};
    if (store.users[email]) {
      store.users[email].password = password;
      store.users[email].emailVerified = true;
      store.users[email].updatedAt = new Date().toISOString();
    } else {
      store.users[email] = {
        email,
        password,
        emailVerified: true,
        first: email.split('@')[0],
        updatedAt: new Date().toISOString()
      };
    }
    await writeStore(store);
    res.json({ ok: true, message: 'Password reset successful', email });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ ok: false, message: err.message || 'Reset failed' });
  }
});

/** Withdrawal notice */
app.post('/api/send-withdrawal-notice', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const amount = req.body.amount;
    const details = req.body.details || '';
    const name = req.body.name || '';
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    await withTimeout(sendWithdrawalNotice(email, { amount, details, name }), 20000, 'Withdraw email');
    res.json({ ok: true });
  } catch (err) {
    console.error('[withdraw-notice]', err);
    res.status(500).json({ ok: false, message: err.message || 'Failed' });
  }
});

/** ---- Users (persistent) ---- */
app.get('/api/users', async (req, res) => {
  try {
    const store = await readStore();
    res.json({ ok: true, users: store.users || {}, count: Object.keys(store.users || {}).length });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.get('/api/users/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const store = await readStore();
    const user = (store.users || {})[email] || null;
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const store = await readStore();
    store.users = store.users || {};
    const prev = store.users[email] || {};
    // Merge — never wipe password if new body omits it
    const next = Object.assign({}, prev, req.body, { email });
    if (!next.password && prev.password) next.password = prev.password;
    next.updatedAt = new Date().toISOString();
    if (!next.createdAt) next.createdAt = prev.createdAt || next.updatedAt;
    store.users[email] = next;
    await writeStore(store);
    res.json({ ok: true, user: next });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/** Login check against persistent store */
app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'email and password required' });
    }
    const store = await readStore();
    const user = (store.users || {})[email];
    if (!user || String(user.password || '') !== password) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password' });
    }
    // Return user without forcing client to guess
    const safe = Object.assign({}, user);
    res.json({ ok: true, user: safe });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.delete('/api/users/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const store = await readStore();
    store.users = store.users || {};
    delete store.users[email];
    if (store.portfolios) delete store.portfolios[email];
    await writeStore(store);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/** ---- Portfolios ---- */
app.get('/api/portfolio/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const store = await readStore();
    store.portfolios = store.portfolios || {};
    res.json({ ok: true, portfolio: store.portfolios[email] || null });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.get('/api/portfolios', async (req, res) => {
  try {
    const store = await readStore();
    res.json({ ok: true, portfolios: store.portfolios || {} });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/portfolio/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const store = await readStore();
    store.portfolios = store.portfolios || {};
    store.portfolios[email] = Object.assign({}, req.body || {}, {
      email,
      updatedAt: new Date().toISOString()
    });
    await writeStore(store);
    res.json({ ok: true, portfolio: store.portfolios[email] });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log('Lauren Apex API on http://127.0.0.1:' + PORT);
  console.log('Firebase DB:', FIREBASE_DB);
  console.log('Resend:', !!process.env.RESEND_API_KEY, 'SMTP:', !!(process.env.SMTP_USER && process.env.SMTP_PASS));
});
