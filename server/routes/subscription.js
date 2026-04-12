const express = require('express');
const router = express.Router();
const { db } = require('../db/turso');

// Helper: Check if premium is active
function isPremiumActive(user) {
  if (!user) return false;
  if (user.subscription_type === 'free') return false;
  if (user.subscription_status !== 'active') return false;
  if (user.subscription_expiry && new Date(user.subscription_expiry) < new Date()) return false;
  return true;
}

// GET /api/subscription/status/:userId
router.get('/status/:userId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT subscription_type, subscription_status, subscription_expiry, ai_analysis_tokens, ai_tokens_reset_at, is_premium FROM users WHERE id = ?',
      args: [req.params.userId]
    });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    const isActive = isPremiumActive(user);

    // Auto-expire if needed
    if (user.subscription_status === 'active' && user.subscription_expiry && new Date(user.subscription_expiry) < new Date()) {
      await db.execute({
        sql: 'UPDATE users SET subscription_status = ?, is_premium = 0, subscription_type = ? WHERE id = ?',
        args: ['expired', 'free', req.params.userId]
      });
    }

    // Weekly AI token reset for free users
    const now = new Date();
    if (!isActive) {
      const resetAt = user.ai_tokens_reset_at ? new Date(user.ai_tokens_reset_at) : null;
      if (!resetAt || (now - resetAt) > 7 * 24 * 60 * 60 * 1000) {
        await db.execute({
          sql: 'UPDATE users SET ai_analysis_tokens = 1, ai_tokens_reset_at = ? WHERE id = ?',
          args: [now.toISOString(), req.params.userId]
        });
        user.ai_analysis_tokens = 1;
        user.ai_tokens_reset_at = now.toISOString();
      }
    }

    res.json({
      success: true,
      subscription: {
        type: user.subscription_type || 'free',
        status: user.subscription_status || 'active',
        expiry: user.subscription_expiry,
        isPremiumActive: isActive,
        aiAnalysisTokens: isActive ? 999 : (user.ai_analysis_tokens ?? 1),
        aiTokensResetAt: user.ai_tokens_reset_at
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/subscription/activate
router.post('/activate', async (req, res) => {
  try {
    const { userId, plan, durationMonths } = req.body;
    if (!userId || !plan) return res.status(400).json({ success: false, error: 'userId ve plan gerekli' });

    const validPlans = ['monthly', 'yearly'];
    if (!validPlans.includes(plan)) return res.status(400).json({ success: false, error: 'Geçersiz plan' });

    const now = new Date();
    const expiry = new Date(now);
    if (plan === 'monthly') {
      expiry.setMonth(expiry.getMonth() + (durationMonths || 1));
    } else {
      expiry.setFullYear(expiry.getFullYear() + 1);
    }

    await db.execute({
      sql: `UPDATE users SET subscription_type = ?, subscription_status = 'active', subscription_expiry = ?,
            subscription_plan = ?, is_premium = 1, premium_expires_at = ?, ai_analysis_tokens = 999
            WHERE id = ?`,
      args: [plan, expiry.toISOString(), plan, expiry.toISOString(), userId]
    });

    res.json({
      success: true,
      subscription: {
        type: plan,
        status: 'active',
        expiry: expiry,
        isPremiumActive: true
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/subscription/cancel
router.post('/cancel', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId gerekli' });

    await db.execute({
      sql: "UPDATE users SET subscription_status = 'canceled' WHERE id = ?",
      args: [userId]
    });

    res.json({ success: true, message: 'Abonelik iptal edildi. Süre sonuna kadar kullanılabilir.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/subscription/consume-ai-token
router.post('/consume-ai-token', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId gerekli' });

    const result = await db.execute({
      sql: 'SELECT subscription_type, subscription_status, subscription_expiry, ai_analysis_tokens, ai_tokens_reset_at FROM users WHERE id = ?',
      args: [userId]
    });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    const isActive = isPremiumActive(user);

    // Premium users have unlimited tokens
    if (isActive) {
      return res.json({ success: true, remaining: 999 });
    }

    // Free users: check weekly reset
    const now = new Date();
    let tokens = user.ai_analysis_tokens ?? 0;
    const resetAt = user.ai_tokens_reset_at ? new Date(user.ai_tokens_reset_at) : null;

    if (!resetAt || (now - resetAt) > 7 * 24 * 60 * 60 * 1000) {
      tokens = 1;
      await db.execute({
        sql: 'UPDATE users SET ai_analysis_tokens = 1, ai_tokens_reset_at = ? WHERE id = ?',
        args: [now.toISOString(), userId]
      });
    }

    if (tokens <= 0) {
      return res.json({ success: false, error: 'AI analiz hakkınız bu hafta dolmuştur.', remaining: 0 });
    }

    // Consume token
    await db.execute({
      sql: 'UPDATE users SET ai_analysis_tokens = ai_analysis_tokens - 1 WHERE id = ?',
      args: [userId]
    });

    res.json({ success: true, remaining: tokens - 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/subscription/webhook — Google Play RTDN (prepared)
router.post('/webhook', async (req, res) => {
  try {
    console.log('[WEBHOOK] Received:', JSON.stringify(req.body));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
