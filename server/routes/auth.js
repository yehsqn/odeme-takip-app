const express = require('express');
const router = express.Router();
const { db } = require('../db/turso');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const crypto = require('crypto');

function genId() {
  return crypto.randomBytes(12).toString('hex');
}

// Helper: row → user response
function formatUser(row) {
  if (!row) return null;
  const isActive = row.is_premium && (!row.subscription_expiry || new Date(row.subscription_expiry) > new Date());
  return {
    id: row.id,
    email: row.email,
    telegramChatId: row.telegram_chat_id || '',
    hasPin: !!row.pin,
    hasIncomePassword: !!row.income_expense_password,
    isPremium: !!isActive,
    language: row.language || 'tr',
    pairingCode: row.pairing_code || '',
    subscriptionType: row.subscription_type || 'free',
    subscriptionStatus: row.subscription_status || 'active',
    subscriptionExpiry: row.subscription_expiry || null,
    aiAnalysisTokens: isActive ? 999 : (row.ai_analysis_tokens ?? 1),
    displayName: row.display_name || '',
    avatar: row.avatar || '',
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email ve şifre gerekli' });

    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()]
    });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (user.password !== password) return res.status(401).json({ success: false, error: 'Şifre hatalı' });

    res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email ve şifre gerekli' });

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()]
    });
    if (existing.rows.length > 0) return res.status(409).json({ success: false, error: 'Bu email zaten kayıtlı' });

    const id = genId();
    await db.execute({
      sql: 'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      args: [id, email.toLowerCase().trim(), password]
    });

    res.json({
      success: true,
      user: {
        id,
        email: email.toLowerCase().trim(),
        hasPin: false,
        hasIncomePassword: false,
        isPremium: false,
        language: 'tr'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/user/:id
router.get('/user/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [req.params.id]
    });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    res.json({ success: true, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/auth/language
router.put('/language', async (req, res) => {
  try {
    const { userId, language } = req.body;
    await db.execute({
      sql: 'UPDATE users SET language = ? WHERE id = ?',
      args: [language, userId]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/premium/:id
router.get('/premium/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT is_premium, premium_expires_at, subscription_plan FROM users WHERE id = ?',
      args: [req.params.id]
    });
    const user = result.rows[0];
    if (!user) return res.json({ success: false, isPremium: false });

    const isActive = user.is_premium && (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
    res.json({ success: true, isPremium: !!isActive, plan: isActive ? user.subscription_plan : 'free' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ success: false, error: 'Google token gerekli' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase().trim();

    // Find or create user
    let result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    let user = result.rows[0];

    if (!user) {
      const id = genId();
      await db.execute({
        sql: `INSERT INTO users (id, email, password, google_id, display_name, avatar) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, email, 'google_oauth_' + Date.now(), payload.sub, payload.name || '', payload.picture || '']
      });
      result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
      user = result.rows[0];
    } else if (!user.google_id) {
      await db.execute({
        sql: 'UPDATE users SET google_id = ?, display_name = COALESCE(NULLIF(display_name, ""), ?), avatar = COALESCE(NULLIF(avatar, ""), ?) WHERE id = ?',
        args: [payload.sub, payload.name || '', payload.picture || '', user.id]
      });
      result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [user.id] });
      user = result.rows[0];
    }

    const formatted = formatUser(user);
    formatted.displayName = formatted.displayName || payload.name || '';
    formatted.avatar = formatted.avatar || payload.picture || '';

    res.json({ success: true, user: formatted });
  } catch (err) {
    console.error('Google Auth Error:', err.message);
    res.status(401).json({ success: false, error: 'Google doğrulama başarısız: ' + err.message });
  }
});

// POST /api/auth/set-pin
router.post('/set-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    await db.execute({ sql: 'UPDATE users SET pin = ? WHERE id = ?', args: [pin, userId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/verify-pin
router.post('/verify-pin', async (req, res) => {
  try {
    const { userId, pin } = req.body;
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ? AND pin = ?',
      args: [userId, pin]
    });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ success: false, error: 'PIN hatalı.' });
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        telegramChatId: user.telegram_chat_id || '',
        hasPin: true,
        hasIncomePassword: !!user.income_expense_password
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/set-income-password
router.post('/set-income-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (user.income_expense_password && user.income_expense_password !== currentPassword) {
      return res.status(401).json({ success: false, error: 'Mevcut şifre hatalı' });
    }
    await db.execute({
      sql: 'UPDATE users SET income_expense_password = ? WHERE id = ?',
      args: [newPassword, userId]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/verify-income-password
router.post('/verify-income-password', async (req, res) => {
  try {
    const { userId, password } = req.body;
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (user.income_expense_password !== password) {
      return res.status(401).json({ success: false, error: 'Şifre hatalı' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/reset-income-password
router.post('/reset-income-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()]
    });
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    await db.execute({
      sql: 'UPDATE users SET income_expense_password = NULL WHERE email = ?',
      args: [email.toLowerCase().trim()]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (user.password !== currentPassword) {
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) return res.status(401).json({ success: false, error: 'Mevcut şifre hatalı' });
    }
    await db.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [newPassword, userId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/pairing-code
router.post('/pairing-code', async (req, res) => {
  try {
    const { userId } = req.body;
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    await db.execute({ sql: 'UPDATE users SET pairing_code = ? WHERE id = ?', args: [code, userId] });
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/pairing-status/:userId
router.get('/pairing-status/:userId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT telegram_chat_id FROM users WHERE id = ?',
      args: [req.params.userId]
    });
    const user = result.rows[0];
    if (user && user.telegram_chat_id) {
      return res.json({ success: true, chatId: user.telegram_chat_id });
    }
    res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
