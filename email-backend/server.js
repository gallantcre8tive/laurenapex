/**
 * Lauren Apex Global API
 * - Users & portfolios: MongoDB Atlas (persistent)
 * - Email: Resend (verified domain)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const {
  sendVerificationCode,
  sendPasswordResetCode,
  sendWithdrawalNotice
} = require('./utils/emailService');

const app = express();
const PORT = Number(process.env.PORT || 5050);
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'laurenapex';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

let client = null;
let db = null;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function connectDb() {
  if (db) return db;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set on Render Environment');
  }
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('resets').createIndex({ email: 1 }, { unique: true });
  console.log('[mongo] connected', DB_NAME);
  return db;
}

async function usersCol() {
  const d = await connectDb();
  return d.collection('users');
}
async function portfoliosCol() {
  const d = await connectDb();
  return d.collection('portfolios');
}
async function resetsCol() {
  const d = await connectDb();
  return d.collection('resets');
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error((label || 'Op') + ' timed out')), ms)
    )
  ]);
}

function publicUser(u) {
  if (!u) return null;
  const o = { ...u };
  delete o._id;
  return o;
}

app.get('/', (req, res) => {
  res.type('text').send('Lauren Apex API is running. Use /api/health');
});

app.get('/api/health', async (req, res) => {
  let storeOk = false;
  let userCount = 0;
  let mongoError = null;
  try {
    const col = await usersCol();
    userCount = await col.countDocuments();
    storeOk = true;
  } catch (e) {
    mongoError = String(e && e.message || e);
  }
  res.json({
    ok: true,
    service: 'lauren-apex-api',
    resendConfigured: !!process.env.RESEND_API_KEY,
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    mongoConfigured: !!MONGODB_URI,
    storeOk,
    userCount,
    mongoError
  });
});

/** Verification email via Resend */
app.post('/api/send-verification', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const name = String(req.body.name || '').trim();
    if (!email || !code) {
      return res.status(400).json({ ok: false, message: 'email and code required' });
    }
    await withTimeout(sendVerificationCode(email, code, name), 20000, 'email');
    res.json({ ok: true, message: 'Verification email sent' });
  } catch (err) {
    console.error('[send-verification]', err);
    res.status(500).json({ ok: false, message: err.message || 'Failed to send email' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const col = await resetsCol();
    await col.updateOne(
      { email },
      { $set: { email, hash: hashCode(code), expires: Date.now() + 15 * 60 * 1000 } },
      { upsert: true }
    );
    await withTimeout(sendPasswordResetCode(email, code, email.split('@')[0]), 20000, 'reset email');
    res.json({ ok: true, message: 'If that email is registered, a code was sent' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ ok: false, message: err.message || 'Failed to send reset email' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();
    const password = String(req.body.password || '');
    if (!email || !code || password.length < 6) {
      return res.status(400).json({ ok: false, message: 'email, code and password (min 6) required' });
    }
    const rcol = await resetsCol();
    const entry = await rcol.findOne({ email });
    if (!entry || entry.expires < Date.now() || entry.hash !== hashCode(code)) {
      return res.status(400).json({ ok: false, message: 'Invalid or expired code' });
    }
    await rcol.deleteOne({ email });
    const ucol = await usersCol();
    const existing = await ucol.findOne({ email });
    if (existing) {
      await ucol.updateOne(
        { email },
        { $set: { password, emailVerified: true, updatedAt: new Date().toISOString() } }
      );
    } else {
      await ucol.insertOne({
        email,
        password,
        emailVerified: true,
        first: email.split('@')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    res.json({ ok: true, message: 'Password reset successful', email });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ ok: false, message: err.message || 'Reset failed' });
  }
});

app.post('/api/send-withdrawal-notice', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    await withTimeout(
      sendWithdrawalNotice(email, {
        amount: req.body.amount,
        details: req.body.details || '',
        name: req.body.name || ''
      }),
      20000,
      'withdraw email'
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[withdraw-notice]', err);
    res.status(500).json({ ok: false, message: err.message || 'Failed' });
  }
});

/** ---- Users ---- */
app.get('/api/users', async (req, res) => {
  try {
    const col = await usersCol();
    const list = await col.find({}).toArray();
    const users = {};
    list.forEach((u) => {
      const p = publicUser(u);
      if (p && p.email) users[p.email] = p;
    });
    res.json({ ok: true, users, count: list.length });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.get('/api/users/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const col = await usersCol();
    const user = await col.findOne({ email });
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const col = await usersCol();
    const prev = await col.findOne({ email });
    const body = { ...req.body, email };
    delete body._id;
    // Never wipe password if omitted
    if (!body.password && prev && prev.password) body.password = prev.password;
    if (body.emailVerified === undefined && prev) body.emailVerified = !!prev.emailVerified;
    body.updatedAt = new Date().toISOString();
    if (!prev) body.createdAt = body.updatedAt;
    else body.createdAt = prev.createdAt || body.updatedAt;

    await col.updateOne({ email }, { $set: body }, { upsert: true });
    const saved = await col.findOne({ email });
    res.json({ ok: true, user: publicUser(saved) });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'email and password required' });
    }
    const col = await usersCol();
    const user = await col.findOne({ email });
    if (!user || String(user.password || '') !== password) {
      return res.status(401).json({ ok: false, message: 'Invalid email or password' });
    }
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.delete('/api/users/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const col = await usersCol();
    await col.deleteOne({ email });
    try {
      const p = await portfoliosCol();
      await p.deleteOne({ email });
    } catch (e) {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/** ---- Portfolios ---- */
app.get('/api/portfolio/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    const col = await portfoliosCol();
    const doc = await col.findOne({ email });
    if (!doc) return res.json({ ok: true, portfolio: null });
    const p = { ...doc };
    delete p._id;
    res.json({ ok: true, portfolio: p });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.get('/api/portfolios', async (req, res) => {
  try {
    const col = await portfoliosCol();
    const list = await col.find({}).toArray();
    const portfolios = {};
    list.forEach((d) => {
      const p = { ...d };
      delete p._id;
      if (p.email) portfolios[p.email] = p;
    });
    res.json({ ok: true, portfolios });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/portfolio/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: 'email required' });
    const col = await portfoliosCol();
    const body = { ...(req.body || {}), email, updatedAt: new Date().toISOString() };
    delete body._id;
    await col.updateOne({ email }, { $set: body }, { upsert: true });
    const saved = await col.findOne({ email });
    const p = { ...saved };
    delete p._id;
    res.json({ ok: true, portfolio: p });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, async () => {
  console.log('Lauren Apex API on port', PORT);
  console.log('Mongo URI set:', !!MONGODB_URI);
  console.log('Resend:', !!process.env.RESEND_API_KEY);
  try {
    await connectDb();
  } catch (e) {
    console.error('[mongo] connect on boot failed:', e && e.message);
  }
});
