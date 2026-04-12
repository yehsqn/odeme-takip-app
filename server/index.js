const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./db/turso');

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const incomeRoutes = require('./routes/income');
const exchangeRoutes = require('./routes/exchange');
const subscriptionRoutes = require('./routes/subscription');
const dbRoutes = require('./routes/db');
const telegramRoutes = require('./routes/telegram');
const backupRoutes = require('./routes/backup');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 4000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'capacitor://localhost',
    'ionic://localhost',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/ai', aiRoutes);

// Error Reporting Endpoint
app.post('/api/errors', async (req, res) => {
  try {
    const { error, info, userId } = req.body;
    console.error('[MOBILE CRASH]', error, info);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message });
});

// Connect and start
initDb()
  .then(() => {
    console.log('[DB] Turso bağlandı ✓');
    app.listen(PORT, () => console.log(`[API] Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('[DB] Turso bağlantı hatası:', err.message);
    process.exit(1);
  });
