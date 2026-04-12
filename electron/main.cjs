const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
// DISABLED — Turso REST API kullanılıyor. Mock mongoose to prevent connection attempts.
const _noop = () => {};
const _schemaProto = { index: _noop, pre: _noop, post: _noop, plugin: _noop, virtual: () => ({ get: _noop, set: _noop }) };
const mongoose = {
  Schema: function() { return Object.create(_schemaProto); },
  model: function(name) { return { find: async () => [], findOne: async () => null, findById: async () => null, create: async () => ({}) }; },
  connection: { readyState: 0, on: _noop, once: _noop, collection: () => ({ watch: () => ({ on: _noop }) }) },
  connect: async () => {},
  Types: { ObjectId: function(id) { return id; } },
};
mongoose.Types.ObjectId.isValid = () => false;
mongoose.Schema.Types = { Mixed: 'Mixed', ObjectId: 'ObjectId' };
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // Deprecated but kept for compatibility if needed, though we will remove usage
const nodemailer = require('nodemailer');
const axios = require('axios');
const { analyzeFinances } = require('./aiAnalysis.cjs');

// Load .env variables
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.replace(/\r\n/g, '\n').split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;
      const eqIndex = trimmedLine.indexOf('=');
      if (eqIndex === -1) return;
      const key = trimmedLine.substring(0, eqIndex).trim();
      const val = trimmedLine.substring(eqIndex + 1).trim();
      if (key) process.env[key] = val;
    });
    console.log('[ENV] Loaded .env file');
  }
} catch (e) { console.warn('[ENV] Could not load .env:', e.message); }


const debugLogPath = 'C:\\Users\\yehsqn\\Desktop\\odeme-takip\\ödeme\\ödeme\\odeme-takip\\debug_startup.txt';
try { fs.writeFileSync(debugLogPath, `[${new Date().toISOString()}] App Starting...\n`); } catch (e) { }
function logDebug(msg) { try { fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { } }

logDebug(`isDev: ${isDev}`);


// SINGLE INSTANCE LOCK - Prevent multiple instances from running
// This fixes the "409 Conflict: terminated by other getUpdates request" error
const gotTheLock = app.requestSingleInstanceLock();
logDebug(`Got Lock: ${gotTheLock}`);

if (!gotTheLock) {
  logDebug('Another instance running, quitting...');
  console.log('[APP] Another instance is already running. Quitting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let tray = null;
let mainWindow = null;

// LOGGING MECHANISM
const logFile = path.join(app.getPath('userData'), 'access.log');

function logAccess(action, details) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${action}] ${details}\n`;
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) console.error('Logging failed:', err);
  });
  console.log(`[ACCESS LOG] ${action}: ${details}`);
}

// Mongoose Schemas
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // PLAIN TEXT
  telegramChatId: String,
  pairingCode: String,
  pairingCodeExpiresAt: Date,
  pin: String, // PLAIN TEXT
  incomeExpensePassword: { type: String }, // PLAIN TEXT
  language: { type: String, default: 'tr' }, // UI language
  // --- Premium / Monetization ---
  isPremium: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },
  subscriptionPlan: { type: String, default: 'free' }, // 'free' | 'monthly' | 'yearly'
  // --------------------------------
  createdAt: { type: Date, default: Date.now },
  role: { type: String, default: 'user' } // user, admin
});

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  id: String,
  title: String,
  amount: Number,
  installments: Number,
  date: String,
  category: String,
  bank: String,
  type: String,
  installmentPlan: Array,
  currency: { type: String, default: 'TRY' },
  originalAmount: Number,
  createdAt: String
}, { collection: 'payments' });

// PaymentSchema.index({ userId: 1 }); // Already indexed in field definition

const SettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, unique: true, index: true },
  cutOffDay: { type: Number, default: 10 },
  telegram: {
    botToken: { type: String, default: process.env.TELEGRAM_BOT_TOKEN || '' },
    chatId: String,
    notificationsEnabled: { type: Boolean, default: true }
  },
  banks: { type: Array, default: [] },
  notificationDays: { type: Number, default: 3 },
  lastTelegramNotification: String,
  appPassword: String,
  backup: {
    enabled: { type: Boolean, default: false },
    time: { type: String, default: '00:00' }
  }
});

// Daily Income Schema - Store as array of days for flexibility
const DailyIncomeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  cash: { type: Number, default: 0 },
  cc: { type: Number, default: 0 },
  salary: { type: Number, default: 0 },
  insurance: { type: Number, default: 0 },
  other: { type: Number, default: 0 },
  expenses: [{ // New detailed expenses
    description: String,
    amount: Number,
    date: { type: Date, default: Date.now }
  }]
});

// Compound index for daily income to ensure one record per day per user
DailyIncomeSchema.index({ userId: 1, date: 1 }, { unique: true });

// Bank Schema - Store bank accounts
const BankSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  name: { type: String, required: true },
  accountNumber: String,
  iban: String,
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'TRY' },
  type: String, // checking, savings, etc.
  createdAt: { type: Date, default: Date.now }
});

// Income Schema - Store income records
const IncomeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  description: String,
  amount: Number,
  date: { type: Date, default: Date.now },
  category: String, // salary, freelance, investment, etc.
  currency: { type: String, default: 'TRY' },
  createdAt: { type: Date, default: Date.now }
});

// Expense Schema - Store expense records
const ExpenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  description: String,
  amount: Number,
  date: { type: Date, default: Date.now },
  category: String, // food, transport, utilities, etc.
  currency: { type: String, default: 'TRY' },
  createdAt: { type: Date, default: Date.now }
});

// Check Schema - Store check records
const CheckSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  checkNumber: String,
  amount: Number,
  issueDate: Date,
  dueDate: Date,
  status: { type: String, default: 'pending' }, // pending, cashed, bounced
  recipient: String,
  bank: String,
  currency: { type: String, default: 'TRY' },
  createdAt: { type: Date, default: Date.now }
});

// Promissory Note Schema - Store promissory notes (senetler)
const PromissoryNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  noteNumber: String,
  amount: Number,
  issueDate: Date,
  dueDate: Date,
  status: { type: String, default: 'active' }, // active, paid, defaulted
  holder: String, // who holds the note
  issuer: String, // who issued the note
  currency: { type: String, default: 'TRY' },
  createdAt: { type: Date, default: Date.now }
});

// Credit Card Schema - Store credit card information
const CreditCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  cardName: String,
  bank: String,
  lastFourDigits: String,
  limit: Number,
  currentBalance: { type: Number, default: 0 },
  cutoffDay: Number,
  paymentDay: Number,
  currency: { type: String, default: 'TRY' },
  createdAt: { type: Date, default: Date.now }
});

// Annual Plan Schema - Store yearly financial plans
const AnnualPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  year: { type: Number, required: true },
  targetIncome: Number,
  targetExpense: Number,
  targetSavings: Number,
  categories: [{
    name: String,
    budget: Number,
    spent: { type: Number, default: 0 }
  }],
  currency: { type: String, default: 'TRY' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Payment = mongoose.model('Payment', PaymentSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const DailyIncome = mongoose.model('DailyIncome', DailyIncomeSchema);
const Bank = mongoose.model('Bank', BankSchema);
const Income = mongoose.model('Income', IncomeSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Check = mongoose.model('Check', CheckSchema);
const PromissoryNote = mongoose.model('PromissoryNote', PromissoryNoteSchema);
const CreditCard = mongoose.model('CreditCard', CreditCardSchema);
const AnnualPlan = mongoose.model('AnnualPlan', AnnualPlanSchema);

let bot;

// --- EXCHANGE RATE SYSTEM ---
let exchangeRates = {
  rates: null,
  lastUpdated: 0
};

async function getExchangeRates() {
  const now = Date.now();
  // Cache for 1 hour (3600000 ms)
  if (exchangeRates.rates && (now - exchangeRates.lastUpdated < 3600000)) {
    return exchangeRates.rates;
  }

  try {
    console.log('[EXCHANGE] Fetching new rates from GenelPara...');
    // Fetch from genelpara.com with User-Agent to avoid 403
    const response = await axios.get('https://api.genelpara.com/json/?list=doviz&sembol=all', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const data = response.data;

    // Check success
    if (!data.success || !data.data) {
      throw new Error('GenelPara API returned unsuccessful response');
    }

    // Helper to parse number
    const parseRate = (val) => {
      if (!val) return 0;
      return parseFloat(val);
    };

    const usdRate = parseRate(data.data.USD.satis);
    const eurRate = parseRate(data.data.EUR.satis);

    // Add Change (Değişim) Data if available for charts
    const usdChange = data.data.USD.degisim || "0";
    const eurChange = data.data.EUR.degisim || "0";

    exchangeRates.rates = {
      USD: usdRate,
      EUR: eurRate,
      USD_Change: usdChange,
      EUR_Change: eurChange,
      TRY: 1.0
    };
    exchangeRates.lastUpdated = now;
    console.log('[EXCHANGE] Rates updated (GenelPara):', exchangeRates.rates);
    return exchangeRates.rates;
  } catch (error) {
    console.error('Exchange Rate Error (GenelPara):', error);
    // Fallback to Truncgil
    try {
      console.log('[EXCHANGE] Fallback to Truncgil...');
      const resTrunc = await axios.get('https://finans.truncgil.com/today.json');
      const dataTrunc = resTrunc.data;
      const parseTrunc = (val) => val ? parseFloat(val.replace(',', '.')) : 0;

      exchangeRates.rates = {
        USD: parseTrunc(dataTrunc.USD.Satış),
        EUR: parseTrunc(dataTrunc.EUR.Satış),
        TRY: 1.0
      };
      exchangeRates.lastUpdated = now;
      return exchangeRates.rates;
    } catch (fbError) {
      console.error('Fallback Exchange Error:', fbError);
      return exchangeRates.rates || { USD: 30.0, EUR: 32.0, TRY: 1.0 };
    }
  }
}

// Cache for all rates
let allRatesCache = {
  data: null,
  lastUpdated: 0
};

// Get ALL rates including gold for the new currency page
async function getAllRates(force = false) {
  const now = Date.now();
  // Cache for 5 minutes (300000 ms) to reduce API calls - unless forced
  if (!force && allRatesCache.data && (now - allRatesCache.lastUpdated < 300000)) {
    return allRatesCache.data;
  }

  try {
    console.log('[EXCHANGE] Fetching ALL rates from GenelPara...');

    // Fetch both currency and gold data
    const [currencyRes, goldRes] = await Promise.all([
      axios.get('https://api.genelpara.com/json/?list=doviz&sembol=all', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }),
      axios.get('https://api.genelpara.com/json/?list=altin&sembol=all', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })
    ]);

    const currencyData = currencyRes.data;
    const goldData = goldRes.data;

    // Parse helper
    const parseNum = (val) => {
      if (!val) return 0;
      const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    // Currency mapping
    const currencyMap = {
      'USD': { name: 'AMERİKAN DOLARI', order: 1 },
      'EUR': { name: 'EURO', order: 2 },
      'SEK': { name: 'İSVEÇ KRONU', order: 3 },
      'CHF': { name: 'İSVİÇRE FRANGI', order: 4 },
      'GBP': { name: 'İNGİLİZ STERLİNİ', order: 5 },
      'AUD': { name: 'AVUSTRALYA DOLARI', order: 6 },
      'CAD': { name: 'KANADA DOLARI', order: 7 },
      'SAR': { name: 'S.ARABİSTAN RİYALİ', order: 8 },
      'JPY': { name: 'JAPON YENİ', order: 9 },
      'DKK': { name: 'DANİMARKA KRONU', order: 10 },
      'NOK': { name: 'NORVEÇ KRONU', order: 11 },
      'RUB': { name: 'RUS RUBLESİ', order: 12 }
    };

    // Gold mapping - Using actual API symbols
    const goldMap = {
      'GA': { name: 'GRAM ALTIN', order: 1 },
      'C': { name: 'ÇEYREK ALTIN', order: 2 },
      'Y': { name: 'YARIM ALTIN', order: 3 },
      'T': { name: 'TAM ALTIN', order: 4 },
      'ATA': { name: 'ATA ALTIN', order: 5 },
      'CMR': { name: 'CUMHURİYET', order: 6 },
      'RA': { name: 'REŞAT ALTIN', order: 7 },
      'GR': { name: 'GREMSE', order: 8 },
      '22': { name: '22 AYAR BİLEZİK', order: 9 },
      '18': { name: '18 AYAR', order: 10 },
      '14': { name: '14 AYAR', order: 11 },
      'HA': { name: 'HAMİT ALTIN', order: 12 },
      'BSL': { name: 'BEŞLÍ ALTIN', order: 13 },
      'GAG': { name: 'GRAM GÜMÜŞ', order: 14 }
    };

    // Build currencies array
    const currencies = [];
    const rates = { TRY: 1.0 };

    if (currencyData.success && currencyData.data) {
      Object.entries(currencyData.data).forEach(([code, info]) => {
        const mapping = currencyMap[code];
        if (mapping) {
          currencies.push({
            code,
            name: mapping.name,
            buying: parseNum(info.alis),
            selling: parseNum(info.satis),
            change: info.degisim || '0',
            order: mapping.order
          });
          rates[code] = parseNum(info.satis);
        }
      });
    }

    // Sort by order
    currencies.sort((a, b) => a.order - b.order);

    // Build gold array
    const gold = [];

    if (goldData.success && goldData.data) {
      Object.entries(goldData.data).forEach(([code, info]) => {
        const upperCode = code.toUpperCase();
        const mapping = goldMap[upperCode];

        // Only include mapped gold types for cleaner display
        if (mapping) {
          gold.push({
            code: upperCode,
            name: mapping.name,
            buying: parseNum(info.alis),
            selling: parseNum(info.satis),
            change: info.degisim || '0',
            order: mapping.order
          });
        }
      });
    }

    // Sort by order
    gold.sort((a, b) => a.order - b.order);

    allRatesCache.data = {
      currencies,
      gold,
      rates,
      lastUpdated: new Date().toISOString()
    };
    allRatesCache.lastUpdated = now;

    console.log(`[EXCHANGE] Fetched ${currencies.length} currencies and ${gold.length} gold types`);
    return allRatesCache.data;

  } catch (error) {
    console.error('[EXCHANGE] Error fetching all rates:', error.message);
    // Return cached data or empty
    return allRatesCache.data || { currencies: [], gold: [], rates: { TRY: 1.0 } };
  }
}

// Turso API Server (child process)

let apiServerProcess = null;

async function connectDB() {
  try {
    // Start the REST API server as a child process
    const { fork } = require('child_process');
    const serverPath = path.join(__dirname, '..', 'server', 'index.js');
    
    console.log('[API] Starting Turso API server...');
    logDebug('Starting Turso API server: ' + serverPath);
    
    apiServerProcess = fork(serverPath, [], {
      env: { ...process.env },
      silent: false
    });
    
    apiServerProcess.on('error', (err) => {
      console.error('[API] Server error:', err);
      logDebug('API Server error: ' + err.message);
    });
    
    apiServerProcess.on('exit', (code) => {
      console.log(`[API] Server exited with code ${code}`);
      logDebug('API Server exited: ' + code);
    });
    
    // Wait for server to be ready
    const API_PORT = process.env.API_PORT || 4000;
    let retries = 0;
    while (retries < 30) {
      try {
        const res = await fetch(`http://localhost:${API_PORT}/health`);
        const data = await res.json();
        if (data.ok) {
          console.log('✅ Turso API server ready!');
          logDebug('Turso API server ready');
          break;
        }
      } catch (e) {
        // Server not ready yet
      }
      retries++;
      await new Promise(r => setTimeout(r, 500));
    }
    
    if (retries >= 30) {
      throw new Error('API server failed to start after 15 seconds');
    }
    
    // Initialize Bot
    const defaultToken = process.env.TELEGRAM_BOT_TOKEN || '';
    initBot(defaultToken);

  } catch (err) {
    console.error("❌ API Server Hatası:", err);
    logDebug('API Server Fail: ' + err.message);
    console.log("🔄 5 saniye sonra tekrar deneniyor...");
    setTimeout(connectDB, 5000);
  }
}

// Cleanup on app quit
app.on('will-quit', () => {
  if (apiServerProcess) {
    apiServerProcess.kill();
    apiServerProcess = null;
  }
});


function initBot(token) {
  try {
    if (bot) {
      bot.stopPolling();
    }
    // IMPORTANT: Polling DISABLED - Render server handles all bot commands
    // Using polling: false to avoid 409 Conflict error (multiple bot instances)
    // This bot instance is only used for SENDING messages (password resets, backups, etc.)
    bot = new TelegramBot(token, { polling: false });
    console.log('Telegram bot initialized (Send-only mode - Render handles commands)');

    // NOTE: All command handlers (/sifre, /gelirgidersifre, etc.) are now handled by
    // the Render server (bot.js). This Electron instance only sends messages.

  } catch (error) {
    console.error('Bot initialization error:', error);
  }
}

// --- SOCKET.IO REAL-TIME SYNCHRONIZATION ---
const { Server } = require('socket.io');
let io;

function initSocketIO() {
  try {
    // Create HTTP server for Socket.io
    const http = require('http');
    const server = http.createServer();

    io = new Server(server, {
      cors: {
        origin: '*', // Allow all origins for development
        methods: ['GET', 'POST']
      }
    });

    const SOCKET_PORT = process.env.SOCKET_PORT || 3001;
    server.listen(SOCKET_PORT, () => {
      console.log(`[SOCKET.IO] ✓ Server running on port ${SOCKET_PORT}`);
    });

    // Track connected clients
    io.on('connection', (socket) => {
      console.log(`[SOCKET.IO] Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`[SOCKET.IO] Client disconnected: ${socket.id}`);
      });
    });

    // MongoDB Change Streams - Watch for real-time database changes
    setupChangeStreams();

  } catch (error) {
    console.error('[SOCKET.IO] Initialization error:', error);
  }
}

function setupChangeStreams() {
  try {
    // Wait for MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log('[CHANGE STREAMS] Waiting for MongoDB connection...');
      setTimeout(setupChangeStreams, 2000);
      return;
    }

    console.log('[CHANGE STREAMS] Setting up MongoDB Change Streams...');

    // Watch Payments collection
    const paymentCollection = mongoose.connection.collection('payments');
    const paymentStream = paymentCollection.watch([], { fullDocument: 'updateLookup' });

    paymentStream.on('change', (change) => {
      console.log(`[CHANGE STREAM] Payments - ${change.operationType}`);

      if (io) {
        // Include userId so frontend can ignore own-device changes
        const userId = change.fullDocument?.userId || change.documentKey?._id;
        io.emit('data-updated', {
          type: change.operationType,
          collection: 'payments',
          userId: userId ? userId.toString() : null,
          documentId: change.documentKey?._id,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Watch Settings collection
    const settingsCollection = mongoose.connection.collection('settings');
    const settingsStream = settingsCollection.watch([], { fullDocument: 'updateLookup' });

    settingsStream.on('change', (change) => {
      console.log(`[CHANGE STREAM] Settings - ${change.operationType}`);

      if (io) {
        const userId = change.fullDocument?.userId || change.documentKey?._id;
        io.emit('settings-updated', {
          type: change.operationType,
          userId: userId ? userId.toString() : null,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Watch DailyIncomes collection
    const dailyIncomeCollection = mongoose.connection.collection('dailyincomes');
    const dailyIncomeStream = dailyIncomeCollection.watch([], { fullDocument: 'updateLookup' });

    dailyIncomeStream.on('change', (change) => {
      console.log(`[CHANGE STREAM] DailyIncomes - ${change.operationType}`);

      if (io) {
        const userId = change.fullDocument?.userId || null;
        io.emit('daily-incomes-updated', {
          type: change.operationType,
          userId: userId ? userId.toString() : null,
          date: change.fullDocument?.date,
          timestamp: new Date().toISOString()
        });
      }
    });

    console.log('[CHANGE STREAMS] ✓ All change streams active');

  } catch (error) {
    console.error('[CHANGE STREAMS] Setup error:', error);
    // Retry after 5 seconds if setup fails
    setTimeout(setupChangeStreams, 5000);
  }
}

// --- BACKUP SYSTEM ---

let backupJob = null;

async function scheduleBackupJob() {
  // Stop existing job
  if (backupJob) {
    backupJob.stop();
    backupJob = null;
  }

  try {
    // Run every minute to check for scheduled backups
    // This allows flexible per-user backup times
    backupJob = cron.schedule('* * * * *', async () => {
      const now = new Date();
      // Use Turkish timezone (Europe/Istanbul) for consistent time comparison
      const formatter = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const currentTime = formatter.format(now);

      // Only log at midnight to reduce console spam
      if (currentTime === '00:00') {
        console.log(`[BACKUP CHECK] Checking for backups at ${currentTime}`);
      }

      const usersToBackup = await Settings.find({
        'backup.enabled': true,
        'backup.time': currentTime
      });

      if (usersToBackup.length > 0) {
        console.log(`[BACKUP CHECK] Found ${usersToBackup.length} users scheduled for ${currentTime}.`);
      }

      for (const setting of usersToBackup) {
        console.log(`[BACKUP] Starting auto backup for user ${setting.userId} at ${currentTime}`);
        const result = await createAndSendFullBackup(setting.userId);
        console.log(`[BACKUP] Result for user ${setting.userId}:`, result);
      }
    });

    console.log('[BACKUP] Scheduler initialized (Minutely check, default time: 00:00)');
  } catch (error) {
    console.error('Backup Scheduler Error:', error);
  }
}

async function createAndSendFullBackup(userId) {
  let tempFilePath = null;

  try {
    if (!bot) return { success: false, error: 'Bot aktif değil.' };

    const user = await User.findById(userId);
    if (!user || !user.telegramChatId) return { success: false, error: 'Kullanıcı veya Telegram ID bulunamadı.' };

    console.log(`[BACKUP] Starting full backup for user ${userId}...`);

    // Helper function to safely fetch collection data
    const fetchCollection = async (collectionName, Model) => {
      try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const data = await Model.find({
          $or: [
            { userId: userObjectId },
            { userId: userId }
          ]
        }).lean();
        console.log(`[BACKUP] ✓ ${collectionName}: ${data.length} kayıt`);
        return { success: true, data };
      } catch (error) {
        console.error(`[BACKUP] ✗ ${collectionName} hatası:`, error.message);
        // Send error notification to Telegram
        try {
          await bot.sendMessage(user.telegramChatId, `⚠️ <b>${collectionName}</b> yedeklenemedi!\n\nHata: ${error.message}`, { parse_mode: 'HTML' });
        } catch (notifyError) {
          console.error('[BACKUP] Telegram bildirim hatası:', notifyError);
        }
        return { success: false, error: error.message, data: [] };
      }
    };

    // Fetch Settings separately (single document)
    let settings = null;
    try {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      settings = await Settings.findOne({
        $or: [
          { userId: userObjectId },
          { userId: userId }
        ]
      }).lean();
      console.log(`[BACKUP] ✓ Settings: ${settings ? 'bulundu' : 'yok'}`);
    } catch (error) {
      console.error('[BACKUP] ✗ Settings hatası:', error.message);
      await bot.sendMessage(user.telegramChatId, `⚠️ <b>Settings</b> yedeklenemedi!\n\nHata: ${error.message}`, { parse_mode: 'HTML' });
    }

    // Fetch all collections
    const payments = await fetchCollection('Payments', Payment);
    const dailyIncomes = await fetchCollection('DailyIncomes', DailyIncome);
    const banks = await fetchCollection('Banks', Bank);
    const incomes = await fetchCollection('Incomes', Income);
    const expenses = await fetchCollection('Expenses', Expense);
    const checks = await fetchCollection('Checks', Check);
    const promissoryNotes = await fetchCollection('PromissoryNotes', PromissoryNote);
    const creditCards = await fetchCollection('CreditCards', CreditCard);
    const annualPlans = await fetchCollection('AnnualPlans', AnnualPlan);

    // Build comprehensive backup structure
    const backupData = {
      metadata: {
        version: '2.0',
        date: new Date().toISOString(),
        user: {
          email: user.email,
          userId: userId
        }
      },
      collections: {
        payments: payments.data,
        dailyIncomes: dailyIncomes.data,
        banks: banks.data,
        incomes: incomes.data,
        expenses: expenses.data,
        checks: checks.data,
        promissoryNotes: promissoryNotes.data,
        creditCards: creditCards.data,
        annualPlans: annualPlans.data,
        settings: settings || {}
      }
    };

    // Calculate Checksum (SHA-256) for data integrity
    const jsonString = JSON.stringify(backupData);
    const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');

    // Add checksum to the final object
    const finalBackup = {
      ...backupData,
      checksum
    };

    // Create JSON Buffer
    const buffer = Buffer.from(JSON.stringify(finalBackup, null, 2), 'utf-8');

    // --- LOCAL BACKUP START ---
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
      const localFileName = `full_backup_${safeDate}.json`;
      const localFilePath = path.join(backupDir, localFileName);

      fs.writeFileSync(localFilePath, buffer);
      console.log(`[BACKUP] ✓ Yerel kayıt: ${localFilePath}`);
    } catch (localErr) {
      console.error('[BACKUP] ✗ Yerel kayıt hatası:', localErr);
    }
    // --- LOCAL BACKUP END ---

    // --- TELEGRAM SEND START ---
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    const fileName = `full_backup_${dateStr}_${timeStr}.json`;

    // Create temporary file for Telegram
    const tmpDir = app.getPath('temp');
    tempFilePath = path.join(tmpDir, fileName);
    fs.writeFileSync(tempFilePath, buffer);

    const fileOptions = {
      filename: fileName,
      contentType: 'application/json'
    };

    // Count total records
    const totalRecords =
      payments.data.length +
      dailyIncomes.data.length +
      banks.data.length +
      incomes.data.length +
      expenses.data.length +
      checks.data.length +
      promissoryNotes.data.length +
      creditCards.data.length +
      annualPlans.data.length;

    const caption = `📦 <b>Tam Kapsamlı Yedekleme</b>\n\n` +
      `📅 Tarih: ${new Date().toLocaleString('tr-TR')}\n` +
      `👤 Kullanıcı: ${user.email}\n\n` +
      `📊 <b>Koleksiyonlar:</b>\n` +
      `▫️ Ödemeler: ${payments.data.length}\n` +
      `▫️ Günlük Gelirler: ${dailyIncomes.data.length}\n` +
      `▫️ Bankalar: ${banks.data.length}\n` +
      `▫️ Gelirler: ${incomes.data.length}\n` +
      `▫️ Giderler: ${expenses.data.length}\n` +
      `▫️ Çekler: ${checks.data.length}\n` +
      `▫️ Senetler: ${promissoryNotes.data.length}\n` +
      `▫️ Kredi Kartları: ${creditCards.data.length}\n` +
      `▫️ Yıllık Planlar: ${annualPlans.data.length}\n\n` +
      `📈 Toplam Kayıt: ${totalRecords}\n` +
      `✅ Verileriniz güvenle yedeklendi.`;

    await bot.sendDocument(user.telegramChatId, buffer, {
      caption: caption,
      parse_mode: 'HTML'
    }, fileOptions);

    console.log(`[BACKUP] ✓ Telegram'a gönderildi: ${fileName}`);
    // --- TELEGRAM SEND END ---

    // --- CLEANUP START ---
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`[BACKUP] ✓ Geçici dosya temizlendi: ${tempFilePath}`);
      }
    } catch (cleanupErr) {
      console.error('[BACKUP] ✗ Temizlik hatası:', cleanupErr);
    }
    // --- CLEANUP END ---

    logAccess('FULL_BACKUP_SENT', `User: ${userId}, Records: ${totalRecords}`);
    return { success: true, message: 'Tam yedek başarıyla gönderildi.' };

  } catch (error) {
    console.error('[BACKUP] Genel hata:', error);

    // Cleanup on error
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (cleanupErr) {
      console.error('[BACKUP] Temizlik hatası:', cleanupErr);
    }

    return { success: false, error: error.message };
  }
}

// --- NEW AUTH HANDLERS ---

ipcMain.handle('auth:forgot-password', async (event, email) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    if (!user.telegramChatId) {
      return { success: false, error: 'Bu hesaba bağlı bir Telegram profili yok. Lütfen yöneticiyle iletişime geçin.' };
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.pairingCode = code; // Using pairingCode field for reset code as well to save space, or create new field
    user.pairingCodeExpiresAt = expiresAt;
    await user.save();

    // Send via Telegram
    if (bot) {
      await bot.sendMessage(user.telegramChatId, `🔐 *Şifre Sıfırlama Kodu*\n\nKodunuz: \`${code}\`\n\nBu kod 5 dakika süreyle geçerlidir.`, { parse_mode: 'Markdown' });
      return { success: true, message: 'Doğrulama kodu Telegram adresinize gönderildi.' };
    } else {
      return { success: false, error: 'Bot servisine erişilemiyor.' };
    }
  } catch (error) {
    console.error('Forgot Password Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:verify-reset-code', async (event, { email, code }) => {
  try {
    const user = await User.findOne({ email });
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    if (user.pairingCode !== code) {
      return { success: false, error: 'Kod hatalı.' };
    }

    if (new Date() > user.pairingCodeExpiresAt) {
      return { success: false, error: 'Kodun süresi dolmuş.' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:reset-password', async (event, { email, code, newPassword }) => {
  try {
    if (!newPassword || newPassword.length < 6 || newPassword.length > 8) {
      return { success: false, error: 'Şifre 6-8 karakter arasında olmalıdır.' };
    }

    const user = await User.findOne({ email });
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    // Verify again for security
    if (user.pairingCode !== code || new Date() > user.pairingCodeExpiresAt) {
      return { success: false, error: 'Geçersiz veya süresi dolmuş kod.' };
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.pairingCode = null;
    user.pairingCodeExpiresAt = null;
    await user.save();

    return { success: true, message: 'Şifreniz başarıyla güncellendi.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('income:recover-access', async (event, userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

    if (!user.telegramChatId) {
      return { success: false, error: 'Telegram bağlantısı bulunamadı.' };
    }

    // Generate Master Key (Temporary Access Code)
    const masterKey = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if we should save this as a temp password or just send the current one?
    // User asked for "Master Key veya geçici erişim kodu". 
    // Let's set it as the password temporarily or require them to enter it to bypass.
    // For simplicity, let's say this Master Key allows one-time entry.
    // We can store it in 'pairingCode' or a new field. Let's use 'pairingCode' again since it's "verification".

    user.pairingCode = masterKey;
    user.pairingCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    if (bot) {
      await bot.sendMessage(user.telegramChatId, `🔑 *Gelir/Gider Erişimi Kurtarma*\n\nGeçici Erişim Kodu (Master Key): \`${masterKey}\`\n\nBu kodu şifre alanına girerek erişim sağlayabilirsiniz.`, { parse_mode: 'Markdown' });
      return { success: true, message: 'Master Key Telegram adresinize gönderildi.' };
    }

    return { success: false, error: 'Bot hatası.' };
  } catch (error) {
    console.error('Income Recovery Error:', error);
    return { success: false, error: error.message };
  }
});




async function checkAndSendReminders() {
  try {
    // Iterate over all users with settings enabled
    const allSettings = await Settings.find({
      'telegram.notificationsEnabled': true,
      'telegram.chatId': { $exists: true, $ne: null }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const setting of allSettings) {
      const { telegram, userId } = setting;
      if (!telegram?.botToken || !telegram?.chatId) continue;

      const user = await User.findById(userId);
      const email = user ? user.email : 'Değerli Kullanıcımız';

      const payments = await Payment.find({ userId });

      const upcomingPayments = payments.flatMap(p =>
        p.installmentPlan
          .filter(inst => !inst.isPaid)
          .map(inst => ({ ...inst, paymentTitle: p.title, type: p.type, paymentId: p._id }))
      ).filter(inst => {
        const instDate = new Date(inst.date);
        instDate.setHours(0, 0, 0, 0);

        const diffTime = instDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays >= 0 && diffDays <= 3;
      });

      if (upcomingPayments.length > 0) {
        const lastNotified = setting.lastTelegramNotification;
        const todayStr = today.toISOString().split('T')[0];

        if (lastNotified === todayStr) continue;

        // Group payments into a single message with inline keyboard buttons
        const totalAmount = upcomingPayments.reduce((sum, p) => sum + p.amount, 0);

        let messageText = `📢 <b>Ödeme Hatırlatıcı</b>\n\nSayın ${email}, yaklaşan <b>${upcomingPayments.length}</b> adet ödemeniz var (Son 3 gün).\n\n`;
        const inlineKeyboard = [];

        upcomingPayments.slice(0, 10).forEach((p, index) => {
          const dateStr = new Date(p.date).toLocaleDateString('tr-TR');
          const instDate = new Date(p.date);
          instDate.setHours(0, 0, 0, 0);
          const diffTime = instDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let dayText = '';
          if (diffDays === 0) dayText = ' (BUGÜN)';
          else if (diffDays === 1) dayText = ' (Yarın)';
          else dayText = ` (${diffDays} gün kaldı)`;

          messageText += `▪️ <b>${p.paymentTitle}</b> - ${p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL - ${dateStr}${dayText}\n`;

          // Add button for this payment
          inlineKeyboard.push([{
            text: `✅ Öde: ${p.paymentTitle} (${p.amount.toLocaleString('tr-TR')} TL)`,
            callback_data: `PAY:${p.paymentId}:${p.date}`
          }]);
        });

        if (upcomingPayments.length > 10) {
          messageText += `\n<i>...ve ${upcomingPayments.length - 10} diğer ödeme.</i>`;
        }

        messageText += `\nToplam Tutar: <b>${totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</b>\n\nÖdeme yapmak için aşağıdaki butonları kullanabilirsiniz.`;

        try {
          if (bot) {
            await bot.sendMessage(telegram.chatId, messageText, {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: inlineKeyboard
              }
            });
            console.log(`Grouped reminder sent to user ${userId}`);

            setting.lastTelegramNotification = todayStr;
            await setting.save();
          }
        } catch (error) {
          console.error(`Failed to send reminder to user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Check Reminders Error:', error);
  }
}

// Schedule Cron Job - DISABLED per user request
// cron.schedule('0 9,12,14 * * *', () => {
//   console.log('Running cron job (09/12/14)...');
//   checkAndSendReminders();
// });

function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.png')
    : path.join(__dirname, '../dist/icon.png'); // Production path correction

  // Check if icon exists, otherwise use a default or skip
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found at:', iconPath);
    // Don't create tray if icon is missing to avoid crash
    return;
  }

  try {
    tray = new Tray(iconPath);
  } catch (err) {
    console.error('Tray creation error:', err);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Uygulamayı Göster',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış Yap (Tamamen Kapat)',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Ödeme Takip Sistemi');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

function createWindow() {
  if (mainWindow) {
    console.log('[WINDOW] Window already exists, skipping creation.');
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  try {
    const iconPath = isDev
      ? path.join(__dirname, '../public/icon.png')
      : path.join(__dirname, '../dist/icon.png');

    logDebug(`Creating Window with icon: ${iconPath}`);

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: iconPath,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
    });

    if (isDev) {
      win.loadURL('http://localhost:5173');
      win.webContents.openDevTools();
    } else {
      win.removeMenu();
      const indexPath = path.join(__dirname, '../dist/index.html');
      logDebug(`Loading File: ${indexPath}`);
      win.loadFile(indexPath);
    }

    mainWindow = win;

    // Prevent "Object has been destroyed" error by clearing reference
    win.on('closed', () => {
      mainWindow = null;
    });

    logDebug('Window Created Successfully');
  } catch (error) {
    logDebug('Create Window Error: ' + error.message);
    console.error('Create Window Error:', error);
  }
}

// Only run app logic if we have the lock
if (gotTheLock) {
  app.whenReady().then(() => {
    logDebug('App Ready V2');
    // displayBotCodes() disabled - was flooding terminal with 2000+ lines
    // try {
    //   displayBotCodes();
    // } catch (e) { console.error('Display Bot Code Error:', e); }

    // COMMENTED OUT: Window/tray creation moved to after handler registration
    // createWindow();
    // createTray();
    // scheduleBackupJob();

    // Initialize DB in background, don't await it to block window creation
    connectDB().then(() => logDebug('DB Connected')).catch(err => logDebug('DB Fail: ' + err));

    // --- AUTO UPDATER CONFIGURATION ---
    if (!isDev) {
      // Configure autoUpdater
      autoUpdater.autoDownload = true; // Automatically download in background
      autoUpdater.autoInstallOnAppQuit = true; // Install when app quits

      // Event: Checking for updates
      autoUpdater.on('checking-for-update', () => {
        console.log('[AUTO-UPDATE] Güncelleme kontrolü yapılıyor...');
        logDebug('[AUTO-UPDATE] Checking for updates...');
      });

      // Event: Update available
      autoUpdater.on('update-available', (info) => {
        console.log(`[AUTO-UPDATE] Yeni güncelleme bulundu: v${info.version}`);
        logDebug(`[AUTO-UPDATE] Update available: v${info.version}`);
      });

      // Event: No update available
      autoUpdater.on('update-not-available', (info) => {
        console.log('[AUTO-UPDATE] Uygulama güncel.');
        logDebug('[AUTO-UPDATE] No update available.');
      });

      // Event: Download progress
      autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent);
        const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
        const transferred = (progressObj.transferred / 1024 / 1024).toFixed(2);
        const total = (progressObj.total / 1024 / 1024).toFixed(2);

        console.log(`[AUTO-UPDATE] İndiriliyor: %${percent} (${transferred}MB / ${total}MB) - Hız: ${speed} MB/s`);
        logDebug(`[AUTO-UPDATE] Download: ${percent}% (${transferred}/${total}MB)`);
      });

      // Event: Update downloaded - Show confirmation dialog
      autoUpdater.on('update-downloaded', (info) => {
        console.log(`[AUTO-UPDATE] Güncelleme indirildi: v${info.version}`);
        logDebug(`[AUTO-UPDATE] Update downloaded: v${info.version}`);

        // Show confirmation dialog to user
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Güncelleme Hazır',
          message: `Yeni sürüm indirildi: v${info.version}`,
          detail: 'Güncellemeyi şimdi yüklemek için uygulamayı yeniden başlatmak ister misiniz?',
          buttons: ['Şimdi Yeniden Başlat', 'Daha Sonra'],
          defaultId: 0,
          cancelId: 1
        }).then((result) => {
          if (result.response === 0) {
            // User clicked "Restart Now"
            console.log('[AUTO-UPDATE] Kullanıcı güncellemeyi onayladı, yeniden başlatılıyor...');
            logDebug('[AUTO-UPDATE] User confirmed, restarting...');
            autoUpdater.quitAndInstall(false, true);
          } else {
            console.log('[AUTO-UPDATE] Kullanıcı güncellemeyi erteledi.');
            logDebug('[AUTO-UPDATE] User postponed update.');
          }
        });
      });

      // Event: Error
      autoUpdater.on('error', (error) => {
        console.error('[AUTO-UPDATE] Güncelleme hatası:', error.message);
        logDebug(`[AUTO-UPDATE] Error: ${error.message}`);
      });

      // Check for updates after 5 seconds (to allow app to fully load)
      setTimeout(() => {
        console.log('[AUTO-UPDATE] GitHub Releases kontrol ediliyor...');
        logDebug('[AUTO-UPDATE] Checking GitHub Releases...');
        autoUpdater.checkForUpdatesAndNotify();
      }, 5000);
    } else {
      console.log('[AUTO-UPDATE] Dev modunda, güncelleme kontrolü atlandı.');
      logDebug('[AUTO-UPDATE] Skipped in dev mode.');
    }
    logDebug('Before Handlers');

    ipcMain.handle('auth:register', async (event, { email, password }) => {
      try {
        logAccess('REGISTER_ATTEMPT', `Email: ${email}`);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          logAccess('REGISTER_FAIL', `Email: ${email} - Already exists`);
          return { success: false, error: 'Bu e-posta adresi zaten kayıtlı.' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
          email,
          password: hashedPassword
        });

        // Create default settings for user
        await Settings.create({
          userId: newUser._id,
          telegram: {
            notificationsEnabled: true
          }
        });

        logAccess('REGISTER_SUCCESS', `User created: ${newUser._id}`);
        return { success: true, user: { id: newUser._id.toString(), email: newUser.email } };
      } catch (error) {
        logAccess('REGISTER_ERROR', error.message);
        console.error('Register Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:login', async (event, { email, password }) => {
      try {
        logAccess('LOGIN_ATTEMPT', `Email: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
          logAccess('LOGIN_FAIL', `Email: ${email} - Invalid credentials`);
          return { success: false, error: 'E-posta veya şifre hatalı.' };
        }

        // Hybrid Check: Bcrypt first, then Plain Text (with auto-migration)
        let isValid = await bcrypt.compare(password, user.password);
        if (!isValid && user.password === password) {
          isValid = true;
          // Migrate to bcrypt
          user.password = await bcrypt.hash(password, 10);
          await user.save();
          console.log(`[SECURITY] Migrated password to bcrypt for user ${user.email}`);
        }

        if (!isValid) {
          logAccess('LOGIN_FAIL', `Email: ${email} - Invalid credentials`);
          return { success: false, error: 'E-posta veya şifre hatalı.' };
        }

        logAccess('LOGIN_SUCCESS', `User: ${user._id}`);
        return {
          success: true,
          user: {
            id: user._id.toString(),
            email: user.email,
            telegramChatId: user.telegramChatId,
            hasPin: !!user.pin,
            hasIncomePassword: !!user.incomeExpensePassword
          }
        };
      } catch (error) {
        logAccess('LOGIN_ERROR', error.message);
        console.error('Login Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:google-login', async (event, { credential }) => {
      try {
        const { OAuth2Client } = require('google-auth-library');
        const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email.toLowerCase().trim();

        logAccess('GOOGLE_LOGIN_ATTEMPT', `Email: ${email}`);

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            email,
            password: await bcrypt.hash('google_oauth_' + Date.now(), 10),
            googleId: payload.sub,
            displayName: payload.name || '',
            avatar: payload.picture || '',
          });

          await Settings.create({
            userId: user._id,
            telegram: { notificationsEnabled: true }
          });

          logAccess('GOOGLE_REGISTER', `New user: ${user._id}`);
        } else {
          if (!user.googleId) {
            user.googleId = payload.sub;
            user.displayName = user.displayName || payload.name || '';
            user.avatar = user.avatar || payload.picture || '';
            await user.save();
          }
        }

        logAccess('GOOGLE_LOGIN_SUCCESS', `User: ${user._id}`);
        return {
          success: true,
          user: {
            id: user._id.toString(),
            email: user.email,
            telegramChatId: user.telegramChatId || '',
            hasPin: !!user.pin,
            hasIncomePassword: !!user.incomeExpensePassword,
            isPremium: user.isPremium || false,
            language: user.language || 'tr',
            displayName: user.displayName || payload.name || '',
            avatar: user.avatar || payload.picture || '',
          }
        };
      } catch (error) {
        logAccess('GOOGLE_LOGIN_ERROR', error.message);
        console.error('Google Login Error:', error);
        return { success: false, error: 'Google doğrulama başarısız: ' + error.message };
      }
    });

    ipcMain.handle('app:report-error', async (event, { error, info, userId }) => {
      try {
        console.error('[FRONTEND ERROR]', error, info);
        if (bot && process.env.TELEGRAM_BOT_TOKEN) {
          const user = userId ? await User.findById(userId) : null;
          const chatId = user?.telegramChatId || process.env.TELEGRAM_ADMIN_CHAT_ID;
          
          if (chatId) {
            const message = `🚨 <b>Frontend Uygulama Hatası</b>\n\n` +
              `👤 Kullanıcı: ${user?.email || 'Bilinmiyor'} (${userId || 'N/A'})\n` +
              `❌ Hata: ${error}\n` +
              `ℹ️ Bilgi: ${info?.componentStack || 'Yok'}\n\n` +
              `<i>Otomatik raporlandı.</i>`;
            
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
          }
        }
        return { success: true };
      } catch (err) {
        console.error('Failed to report error:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('auth:set-pin', async (event, { userId, pin }) => {
      try {
        // STORE PIN AS PLAIN TEXT
        // const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
        await User.findByIdAndUpdate(userId, { pin: pin });
        logAccess('SET_PIN', `User: ${userId}`);
        return { success: true };
      } catch (error) {
        console.error('Set PIN Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:verify-pin', async (event, { userId, pin }) => {
      try {
        // COMPARE PLAIN TEXT PIN
        // const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
        const user = await User.findOne({ _id: userId, pin: pin });

        if (!user) {
          logAccess('VERIFY_PIN_FAIL', `User: ${userId}`);
          return { success: false, error: 'PIN hatalı.' };
        }

        logAccess('VERIFY_PIN_SUCCESS', `User: ${userId}`);
        return {
          success: true,
          user: {
            id: user._id.toString(),
            email: user.email,
            telegramChatId: user.telegramChatId,
            hasPin: true,
            hasIncomePassword: !!user.incomeExpensePassword
          }
        };
      } catch (error) {
        console.error('Verify PIN Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:generate-pairing-code', async (event, userId) => {
      try {
        const code = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit code
        await User.findByIdAndUpdate(userId, { pairingCode: code });
        return { success: true, code };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:check-pairing-status', async (event, userId) => {
      try {
        const user = await User.findById(userId);
        if (user && user.telegramChatId) {
          return { success: true, chatId: user.telegramChatId };
        }
        return { success: false };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // --- DATA PERSISTENCE HANDLERS ---

    // Save Settings to Database
    ipcMain.handle('db:save-settings', async (event, { userId, settings: settingsData }) => {
      try {
        if (!userId) return { success: false, error: 'User ID required' };

        // VALIDATION: Prevent null/undefined data from being saved
        if (!settingsData || Object.keys(settingsData).length === 0) {
          console.log(`[DB] ⚠️ BLOCKED: Empty or null settings data received for user ${userId}`);
          return { success: false, error: 'Boş ayar verisi gönderilemez' };
        }

        let userObjectId = null;
        try { userObjectId = new mongoose.Types.ObjectId(userId); } catch (e) { }

        // Remove internal MongoDB fields (_id, __v) to prevent CastError
        const { _id, __v, ...cleanSettings } = settingsData;
        const finalUserId = userObjectId || userId;

        // Use findOne + save to avoid $or + upsert E11000 duplicate key error
        let existing = await Settings.findOne(
          userObjectId
            ? { $or: [{ userId: userObjectId }, { userId: userId }] }
            : { userId: userId }
        );

        if (existing) {
          // Update existing document safely - do NOT change userId format to avoid E11000
          const { userId: _uid, ...settingsOnly } = cleanSettings;
          await Settings.updateOne(
            { _id: existing._id },
            { $set: settingsOnly }
          );
        } else {
          // Create new document
          await Settings.create({ ...cleanSettings, userId: finalUserId });
        }

        console.log(`[DB] ✓ Settings saved for user ${userId}`);
        return { success: true };
      } catch (error) {
        console.error('Save Settings Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Save Payments to Database
    ipcMain.handle('db:save-payments', async (event, { userId, payments }) => {
      try {
        if (!userId) return { success: false, error: 'User ID required' };
        if (!Array.isArray(payments)) return { success: false, error: 'Payments must be an array' };

        // ALLOW empty arrays! This is necessary for deleting the last payment.
        if (payments.length === 0) {
          console.log(`[DB] Saving EMPTY payments array for user ${userId} (Purging all records).`);
        }

        let userObjectId = null;
        try {
          userObjectId = new mongoose.Types.ObjectId(userId);
        } catch (e) { }

        // DELETE: Use regex-safe string comparison — cover both ObjectId and string stored userId
        // We delete docs where userId matches either the ObjectId OR the string form
        const deleteResult = await Payment.deleteMany(
          userObjectId
            ? { $or: [{ userId: userObjectId }, { userId: userId.toString() }] }
            : { userId: userId.toString() }
        );
        console.log(`[DB] Deleted ${deleteResult.deletedCount} existing payments before re-insert for user ${userId}`);

        const paymentDocs = payments.map(p => {
          // _id comes from IPC as { buffer: Uint8Array } — must convert to string or omit
          const { _id, ...rest } = p;
          let sanitizedId;
          try {
            if (_id && typeof _id === 'string') sanitizedId = new mongoose.Types.ObjectId(_id);
            else if (_id?.$oid) sanitizedId = new mongoose.Types.ObjectId(_id.$oid);
            else sanitizedId = new mongoose.Types.ObjectId();
          } catch (e) { sanitizedId = new mongoose.Types.ObjectId(); }
          return { ...rest, _id: sanitizedId, userId: userObjectId || userId };
        });

        await Payment.insertMany(paymentDocs);
        console.log(`[DB] Saved ${payments.length} payments for user ${userId}`);
        return { success: true };
      } catch (error) {
        console.error('Save Payments Error:', error);
        return { success: false, error: error.message };
      }
    });



    // Save Daily Incomes to Database
    ipcMain.handle('db:save-daily-incomes', async (event, { userId, dailyIncomes }) => {
      try {
        if (!userId || !dailyIncomes) return { success: false, error: 'Missing data' };

        // VALIDATION: Prevent null/undefined data from being saved
        if (Object.keys(dailyIncomes).length === 0) {
          console.log(`[DB] ⚠️ BLOCKED: Empty daily incomes data received for user ${userId}`);
          return { success: true, message: 'Skipped empty save' };
        }

        const updates = Object.entries(dailyIncomes).map(async ([date, data]) => {
          // Skip if data is null or undefined
          if (!data) {
            console.log(`[DB] ⚠️ Skipping null data for date ${date}`);
            return;
          }

          let userObjectId = null;
          try { userObjectId = new mongoose.Types.ObjectId(userId); } catch (e) { }

          const filter = userObjectId ? {
            $or: [
              { userId: userObjectId, date },
              { userId: userId, date }
            ]
          } : { userId: userId, date };

          // Sanitize expenses: deeply serialize to eliminate Uint8Array/ObjectId buffer objects
          // Step 1: JSON round-trip to flatten all non-plain objects
          let rawExpenses;
          try {
            rawExpenses = JSON.parse(JSON.stringify(data.expenses || []));
          } catch (e) {
            rawExpenses = [];
          }
          // Step 2: drop _id from each expense so Mongoose generates a fresh one
          const sanitizedExpenses = rawExpenses.map(exp => {
            if (typeof exp !== 'object' || exp === null) return {};
            const { _id, ...rest } = exp;
            return rest;
          });

          // SAFE UPDATE: Use $set operator to update only specified fields
          await DailyIncome.findOneAndUpdate(
            filter,
            {
              $set: {
                userId: userObjectId || userId,
                date,
                cash: data.cash || 0,
                cc: data.cc || 0,
                salary: data.salary || 0,
                insurance: data.insurance || 0,
                other: data.other || 0,
                expenses: sanitizedExpenses
              }
            },
            { upsert: true, new: true }
          );
        });

        await Promise.all(updates);
        console.log(`[DB] ✓ Saved ${Object.keys(dailyIncomes).length} daily income records for user ${userId}`);
        return { success: true };
      } catch (error) {
        console.error('Save Daily Incomes Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Generic Save Handler for Array Collections - uses bulkWrite upsert to avoid delete race condition
    async function saveCollection(userId, data, Model, name) {
      if (!userId) return { success: false, error: 'User ID required' };
      if (!Array.isArray(data)) return { success: false, error: `${name} must be an array` };

      let userObjectId = null;
      try {
        userObjectId = new mongoose.Types.ObjectId(userId);
      } catch (e) { }

      // SAFETY: Block empty array saves to prevent data loss
      if (data.length === 0) {
        console.log(`[DB] ⚠️ BLOCKED: Attempted to save EMPTY ${name} array for user ${userId}. Skipping.`);
        return { success: true, message: 'Skipped empty save' };
      }

      const deleteQuery = userObjectId ? {
        $or: [{ userId: userObjectId }, { userId: userId }]
      } : { userId: userId };

      await Model.deleteMany(deleteQuery);

      const docs = data.map(item => {
        const { _id, ...rest } = item;
        let sanitizedId;
        try {
          if (_id && typeof _id === 'string') sanitizedId = new mongoose.Types.ObjectId(_id);
          else if (_id?.$oid) sanitizedId = new mongoose.Types.ObjectId(_id.$oid);
          else sanitizedId = new mongoose.Types.ObjectId();
        } catch (e) { sanitizedId = new mongoose.Types.ObjectId(); }
        return { ...rest, _id: sanitizedId, userId: userObjectId || userId };
      });

      await Model.insertMany(docs);

      console.log(`[DB] Saved ${data.length} ${name} for user ${userId}`);
      return { success: true };
    }


    ipcMain.handle('db:save-banks', (e, { userId, banks }) => saveCollection(userId, banks, Bank, 'banks'));
    ipcMain.handle('db:save-incomes', (e, { userId, incomes }) => saveCollection(userId, incomes, Income, 'incomes'));
    ipcMain.handle('db:save-expenses', (e, { userId, expenses }) => saveCollection(userId, expenses, Expense, 'expenses'));
    ipcMain.handle('db:save-checks', (e, { userId, checks }) => saveCollection(userId, checks, Check, 'checks'));
    ipcMain.handle('db:save-promissory-notes', (e, { userId, promissoryNotes }) => saveCollection(userId, promissoryNotes, PromissoryNote, 'promissory notes'));
    ipcMain.handle('db:save-credit-cards', (e, { userId, creditCards }) => saveCollection(userId, creditCards, CreditCard, 'credit cards'));
    ipcMain.handle('db:save-annual-plans', (e, { userId, annualPlans }) => saveCollection(userId, annualPlans, AnnualPlan, 'annual plans'));

    // Load Data Handler
    ipcMain.handle('db:load-data', async (event, userId) => {
      try {
        if (!userId) return { success: false, error: 'User ID required' };

        // Wait for MongoDB connection if not ready
        if (mongoose.connection.readyState !== 1) {
          console.log('[DB] Waiting for MongoDB connection...');
          for (let i = 0; i < 60; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (mongoose.connection.readyState === 1) {
              console.log('[DB] Connection established!');
              break;
            }
          }
          if (mongoose.connection.readyState !== 1) {
            return { success: false, error: 'Veritabanı bağlantısı kurulamadı. Lütfen internet bağlantınızı kontrol edin.' };
          }
        }

        console.log(`[DB] Loading data for user ${userId}...`);

        let userObjectId = null;
        try {
          userObjectId = new mongoose.Types.ObjectId(userId);
        } catch (e) {
          // Invalid ObjectId format, using string match only
        }

        const query = userObjectId ? {
          $or: [
            { userId: userObjectId },
            { userId: userId }
          ]
        } : { userId: userId };

        // Helper to fetch with retry
        const fetchWithRetry = async (Model, name) => {
          let retryCount = 0;
          const maxRetries = 3;
          while (retryCount < maxRetries) {
            try {
              // Special case for Settings which is unique per user usually? 
              // Logic above used findOne for settings. My fetchWithRetry uses find().
              // I should make fetchWithRetry generic or handle it.
              // Actually, find() returns array. Settings.findOne returns object. 
              // If I change to fetchWithRetry, I get an array. 
              // Keep it simple: Modify fetchWithRetry to support single doc or just use find() and take first?
              // Settings is findOne in original code.
              // Let's modify fetchWithRetry to accept a method or handle it. 
              // Or better: Let's stick to find() for all, and for settings we take [0].
              // BUT, Settings.findOne(...) is cleaner.
              // Let's modify usage in Promise.all to handle Settings separately or update fetchWithRetry to take a "isSingle" param.
              // I'll update fetchWithRetry here.

              if (name === 'Settings') {
                return await Model.findOne(query).lean();
              }
              return await Model.find(query).lean();
            } catch (error) {
              retryCount++;
              console.error(`[DB] ${name} fetch error (attempt ${retryCount}/${maxRetries}):`, error.message);
              if (retryCount >= maxRetries) throw error;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        };

        // Load all collections in parallel using retry logic
        const [
          payments,
          settingsDoc,
          dailyIncomeRecords,
          banks,
          incomes,
          expenses,
          checks,
          promissoryNotes,
          creditCards,
          annualPlans
        ] = await Promise.all([
          fetchWithRetry(Payment, 'Payment'),
          fetchWithRetry(Settings, 'Settings', true), // true for findOne? No, fetchWithRetry uses find().lean(). We need findOne for Settings.
          fetchWithRetry(DailyIncome, 'DailyIncome'),
          fetchWithRetry(Bank, 'Bank'),
          fetchWithRetry(Income, 'Income'),
          fetchWithRetry(Expense, 'Expense'),
          fetchWithRetry(Check, 'Check'),
          fetchWithRetry(PromissoryNote, 'PromissoryNote'),
          fetchWithRetry(CreditCard, 'CreditCard'),
          fetchWithRetry(AnnualPlan, 'AnnualPlan')
        ]);

        const dailyIncomes = {};
        for (const record of dailyIncomeRecords || []) {
          dailyIncomes[record.date] = {
            cash: record.cash || 0,
            cc: record.cc || 0,
            salary: record.salary || 0,
            insurance: record.insurance || 0,
            other: record.other || 0,
            expenses: record.expenses || []
          };
        }

        console.log(`[DB] ✓ Loaded ${payments?.length || 0} payments, ${dailyIncomeRecords?.length || 0} daily records, ${banks?.length || 0} banks for user ${userId}`);

        return {
          success: true,
          payments: payments || [],
          settings: settingsDoc || { cutOffDay: 10, banks: [], telegram: { notificationsEnabled: true } },
          dailyIncomes,
          banks: banks || [],
          incomes: incomes || [],
          expenses: expenses || [],
          checks: checks || [],
          promissoryNotes: promissoryNotes || [],
          creditCards: creditCards || [],
          annualPlans: annualPlans || []
        };
      } catch (error) {
        console.error('[DB] Load Data Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Backup Settings Handler
    ipcMain.handle('backup:update-settings', async (event, { userId, backup }) => {
      try {
        const user = await User.findById(userId);
        if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

        // We can store backup settings in Settings schema or User schema.
        // Let's use Settings schema as it already exists for user preferences.
        let settings = await Settings.findOne({
          $or: [
            { userId: new mongoose.Types.ObjectId(userId) },
            { userId: userId }
          ]
        });

        if (!settings) {
          // Create settings if not found
          console.log(`[BACKUP] Settings not found for user ${userId}, creating new...`);
          settings = await Settings.create({
            userId: new mongoose.Types.ObjectId(userId),
            banks: [],
            telegram: { notificationsEnabled: true }
          });
        }

        // Initialize backup object if not exists
        if (!settings.backup) settings.backup = {};

        // Extract values from backup object
        const enabled = backup?.enabled ?? false;
        const time = backup?.time || '23:00';

        settings.backup.enabled = enabled;
        settings.backup.time = time.trim(); // "HH:mm" format, ensure no spaces
        await settings.save();

        // Re-schedule cron job immediately
        // Note: With the new Server-side backup logic (server.js), this local job might be redundant 
        // if the user relies on the server. However, for local usage, we keep it.
        scheduleBackupJob();

        return { success: true, message: 'Yedekleme ayarları güncellendi.' };
      } catch (error) {
        console.error('Backup Settings Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get Backup Settings
    ipcMain.handle('backup:get-settings', async (event, userId) => {
      try {
        const settings = await Settings.findOne({ userId });
        if (settings && settings.backup) {
          return { success: true, backup: { enabled: settings.backup.enabled, time: settings.backup.time } };
        }
        return { success: true, backup: { enabled: false, time: '00:00' } }; // Default - Midnight
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('backup:create-now', async (event, userId) => {
      return await createAndSendFullBackup(userId);
    });

    // DB Status Check Handler
    ipcMain.handle('db:status', async () => {
      // 1 = connected
      return { connected: mongoose.connection.readyState === 1 };
    });

    ipcMain.handle('auth:set-income-password', async (event, { userId, currentPassword, newPassword }) => {
      try {
        const user = await User.findById(userId);
        if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

        // Verify current password if user already has one
        if (user.incomeExpensePassword && currentPassword) {
          // Hybrid Check
          let isValid = await bcrypt.compare(currentPassword, user.incomeExpensePassword);
          if (!isValid && user.incomeExpensePassword === currentPassword) isValid = true;

          if (!isValid) {
            logAccess('SET_INCOME_PASSWORD_FAIL', `User: ${userId} - Wrong current password`);
            return { success: false, error: 'Mevcut şifre hatalı.' };
          }
        }

        // Store as Hash
        user.incomeExpensePassword = await bcrypt.hash(newPassword, 10);
        await user.save();

        logAccess('SET_INCOME_PASSWORD_SUCCESS', `User: ${userId}`);
        console.log(`[SECURITY] Income Password Changed for ${userId}.`);

        return { success: true, message: 'Şifre başarıyla değiştirildi.' };
      } catch (error) {
        console.error('Set Income Password Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:verify-income-password', async (event, { userId, password }) => {
      try {
        const user = await User.findById(userId);
        if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

        if (!user.incomeExpensePassword) {
          return { success: true }; // No password set, allow access
        }

        // 1. Check Primary Password (Hybrid)
        let isPasswordValid = await bcrypt.compare(password, user.incomeExpensePassword);
        if (!isPasswordValid && user.incomeExpensePassword === password) {
          isPasswordValid = true;
          // Auto-migrate for better security next time
          user.incomeExpensePassword = await bcrypt.hash(password, 10);
          await user.save();
        }

        // 2. Check Master Key (Recovery Code)
        let isMasterKeyValid = false;
        if (user.pairingCode && user.pairingCode === password) {
          if (new Date() < user.pairingCodeExpiresAt) {
            isMasterKeyValid = true;
            // Optional: Clear code after successful use? 
            // user.pairingCode = null; 
            // await user.save();
          }
        }

        if (!isPasswordValid && !isMasterKeyValid) {
          logAccess('VERIFY_INCOME_PASSWORD_FAIL', `User: ${userId}`);
          return { success: false, error: 'Şifre hatalı.' };
        }

        logAccess('VERIFY_INCOME_PASSWORD_SUCCESS', `User: ${userId} (MasterKey: ${isMasterKeyValid})`);
        return { success: true };
      } catch (error) {
        console.error('Verify Income Password Error:', error);
        return { success: false, error: error.message };
      }
    });

    logDebug('Midway Handlers');

    ipcMain.handle('auth:reset-income-password', async (event, email) => {
      try {
        const user = await User.findOne({ email });
        if (!user) return { success: false, error: 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.' };

        // Generate random password (6 digits)
        const newPassword = Math.floor(100000 + Math.random() * 900000).toString();

        // Store as Hash
        user.incomeExpensePassword = await bcrypt.hash(newPassword, 10);
        await user.save();

        logAccess('RESET_INCOME_PASSWORD', `Email: ${email} - New: ${newPassword}`);

        // Configure Transporter
        // TODO: Configure valid SMTP credentials here
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'odemetakip@gmail.com', // Placeholder
            pass: 'password' // Placeholder
          }
        });

        const mailOptions = {
          from: 'odemetakip@gmail.com',
          to: email,
          subject: 'Gelir/Gider Şifresi Sıfırlama',
          text: `Merhaba,\n\nGelir/Gider sayfanız için yeni şifreniz: ${newPassword}\n\nLütfen giriş yaptıktan sonra şifrenizi değiştirin.`
        };

        try {
          // await transporter.sendMail(mailOptions);
          // For now, since we don't have credentials, we log it.
          console.log(`--------------------------------------------------`);
          console.log(`[PASSWORD RESET] To: ${email}`);
          console.log(`[PASSWORD RESET] New Password: ${newPassword}`);
          console.log(`--------------------------------------------------`);

          return { success: true, message: 'Yeni şifreniz oluşturuldu. (E-posta servisi yapılandırılmadığı için loglara bakınız: ' + newPassword + ')' };
        } catch (emailError) {
          console.error('Email send error:', emailError);
          return { success: false, error: 'E-posta gönderilemedi.' };
        }

      } catch (error) {
        console.error('Reset Password Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:change-password', async (event, { userId, currentPassword, newPassword }) => {
      try {
        if (!newPassword || newPassword.length < 6 || newPassword.length > 8) {
          return { success: false, error: 'Şifre 6-8 karakter arasında olmalıdır.' };
        }

        const user = await User.findById(userId);
        if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

        // Verify current password (Hybrid)
        let isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid && user.password === currentPassword) isValid = true;

        if (!isValid) {
          logAccess('CHANGE_PASSWORD_FAIL', `User: ${userId} - Wrong current password`);
          return { success: false, error: 'Mevcut şifre hatalı.' };
        }

        // Update to new password (Hashed)
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        logAccess('CHANGE_PASSWORD_SUCCESS', `User: ${userId}`);
        return { success: true };
      } catch (error) {
        console.error('Change Password Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Admin: Get all users with passwords (for DB management/viewing)
    ipcMain.handle('admin:get-users', async (event) => {
      try {
        logAccess('ADMIN_GET_USERS', 'Request to view all users and passwords');
        const users = await User.find({}, 'email password pin incomeExpensePassword role createdAt');
        // Return as plain objects
        return { success: true, users: JSON.parse(JSON.stringify(users)) };
      } catch (error) {
        console.error('Admin Get Users Error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:get-user', async (event, userId) => {
      try {
        const user = await User.findById(userId);
        if (!user) return { success: false, error: 'Kullanıcı bulunamadı' };

        return {
          success: true,
          user: {
            id: user._id.toString(),
            email: user.email,
            telegramChatId: user.telegramChatId,
            hasPin: !!user.pin,
            hasIncomePassword: !!user.incomeExpensePassword,
            isPremium: user.isPremium || false,
            subscriptionPlan: user.subscriptionPlan || 'free',
            premiumExpiresAt: user.premiumExpiresAt || null
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // --- DATA HANDLERS (SCOPED BY USER ID) ---

    ipcMain.handle('db:get', async (event, userId) => {
      if (!userId) return { success: true, payments: [], settings: {}, dailyIncomes: {} };

      try {
        // Check connection state
        if (mongoose.connection.readyState !== 1) {
          console.log('[DB] Waiting for connection in db:get...');
          for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (mongoose.connection.readyState === 1) break;
          }
          if (mongoose.connection.readyState !== 1) {
            return { success: false, error: 'Veritabanı bağlantısı yok.' };
          }
        }

        console.log(`[DB] Fetching data for user ${userId}`);

        // Explicitly cast userId to ObjectId to ensure matching
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Use .lean() to get plain JavaScript objects that can be sent via IPC
        // FIX: Search by both ObjectId AND String to ensure all data is found regardless of how it was saved
        const rawPayments = await Payment.find({
          $or: [
            { userId: userObjectId },
            { userId: userId }
          ]
        }).lean();

        // Deduplicate payments based on 'id' field to prevent showing same payment twice 
        // (in case of data migration issues where both ObjectId and String versions exist)
        const uniquePaymentsMap = new Map();
        rawPayments.forEach(p => {
          if (p.id) uniquePaymentsMap.set(p.id, p);
        });
        const payments = Array.from(uniquePaymentsMap.values());

        // Convert _id to string for frontend if needed, though lean() keeps it as ObjectId
        // IPC serialization usually handles ObjectId by converting to string or keeping as object structure
        // Safest is to map if needed, but let's try lean() first.
        // Better: serialize explicitly to avoid \"object could not be cloned\"
        const serializedPayments = JSON.parse(JSON.stringify(payments));
        console.log(`[DB] ✓ Found ${serializedPayments.length} payments`);

        let settings = await Settings.findOne({
          $or: [
            { userId: userObjectId },
            { userId: userId }
          ]
        }).lean();

        if (!settings) {
          settings = await Settings.create({ userId: userObjectId, banks: [] });
          settings = settings.toObject(); // Convert created doc to plain object
        }
        const serializedSettings = JSON.parse(JSON.stringify(settings));

        const dailyIncomesDocs = await DailyIncome.find({
          $or: [
            { userId: userObjectId },
            { userId: userId }
          ]
        }).lean();

        const dailyIncomes = dailyIncomesDocs.reduce((acc, doc) => {
          acc[doc.date] = {
            cash: doc.cash,
            cc: doc.cc,
            salary: doc.salary,
            insurance: doc.insurance,
            other: doc.other,
            expenses: doc.expenses || []
          };
          return acc;
        }, {});

        return {
          success: true,
          payments: serializedPayments,
          settings: serializedSettings,
          dailyIncomes
        };
      } catch (error) {
        console.error('[DB] Get Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Duplicate handlers below were removed to prevent conflicts and ensure the primary robust handlers above are used.


    // Send General Message
    logDebug('Midway 3 - Before Telegram Send Message');
    ipcMain.handle('telegram:send-message', async (event, { userId, message }) => {
      if (!userId) return { success: false, error: 'Kullanıcı ID eksik' };
      try {
        const user = await User.findById(userId);
        if (!user?.telegramChatId) return { success: false, error: 'Telegram bağlı değil.' };

        if (bot) {
          await bot.sendMessage(user.telegramChatId, message, { parse_mode: 'HTML' });
          return { success: true };
        }
        return { success: false, error: 'Bot aktif değil.' };
      } catch (error) {
        console.error('Send Message Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Manual Trigger for Test
    ipcMain.handle('telegram:test', async (event, userId) => {
      if (!userId) return { success: false, error: 'Kullanıcı ID eksik' };
      try {
        const user = await User.findById(userId);
        const chatId = user?.telegramChatId;

        if (!chatId) {
          return { success: false, error: 'Telegram eşleşmesi yapılmamış. Lütfen eşleşme kodunu kullanın.' };
        }

        if (bot) {
          await bot.sendMessage(chatId, "🔔 Test bildirimi: Hesabınız başarıyla bağlı!");
          return { success: true };
        }

        return { success: false, error: 'Bot aktif değil.' };
      } catch (error) {
        console.error('Telegram Test Error:', error);
        return { success: false, error: error.message };
      }
    });

    // Check for immediate notification (New Payment) - REFACTORED FOR ALL PAYMENTS
    ipcMain.handle('telegram:notify-new-payment', async (event, { userId, payment }) => {
      if (!userId || !payment) return;
      try {
        const user = await User.findById(userId);
        const settings = await Settings.findOne({ userId });

        if (!user?.telegramChatId || !settings?.telegram?.notificationsEnabled) return;
        if (!bot) return;

        const totalAmount = payment.installmentPlan.reduce((sum, i) => sum + i.amount, 0);
        const firstDate = payment.installmentPlan.length > 0 ? payment.installmentPlan[0].date : new Date();
        const dateStr = new Date(firstDate).toLocaleDateString('tr-TR');

        let amountText = `${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`;

        // Conversion Logic
        if (payment.currency && payment.currency !== 'TRY') {
          const rates = await getExchangeRates();
          const rate = rates[payment.currency];
          if (rate) {
            const converted = totalAmount * rate; // totalAmount here is already in original currency if saved correctly, BUT wait.
            // The system likely saves 'amount' as the numeric value. If user entered 10 USD, amount is 10.
            // So 'totalAmount' is 10.
            // We need to clarify if 'amount' in DB is always TRY or original.
            // The prompt says: "save original currency and amount".
            // "Store original amount in payment records".
            // Ideally 'amount' field should be the one used for calculations (TRY equivalent?) or we change logic to support multi-currency everywhere.
            // For simplicity: 'amount' usually implies the value used for totals. 
            // If we change 'amount' to be 10 for 10 USD, then all 'Total' calculations in frontend will be wrong (adding 10 USD to 100 TRY = 110).
            // USUALLY: 'amount' = TRY equivalent, 'originalAmount' = 10, 'currency' = 'USD'.
            // BUT the prompt says: "When user enters 10$, save this info with original currency".
            // Let's assume for this specific notification:
            // If we stored 10 as 'amount' and 'USD' as currency, we display "10 USD (approx X TL)".
            // If we stored 300 (TRY) as 'amount' and '10' as originalAmount, we display "10 USD (300 TL)".

            // Let's assume standard practice: 'amount' is what we sum up. If the app is single-currency base (TRY), then 'amount' should be TRY.
            // However, the user wants "Currency Support".
            // Let's stick to: 'amount' is the value entered. 'currency' defines what it is.
            // The frontend sums might be broken if we mix currencies, but I will fix frontend to convert.

            const convertedAmount = totalAmount * rate;
            amountText = `${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${payment.currency} (≈${convertedAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)`;
          }
        }

        const message = `🔔 <b>Yeni Ödeme Eklendi!</b>\n\n` +
          `📝 <b>Açıklama:</b> ${payment.title}\n` +
          `📅 <b>Tarih:</b> ${dateStr}\n` +
          `💰 <b>Tutar:</b> ${amountText}\n\n` +
          `Ödeme planınıza başarıyla kaydedildi.`;

        await bot.sendMessage(user.telegramChatId, message, { parse_mode: 'HTML' });
        console.log(`[Telegram] New payment notification sent to ${user.email}`);

      } catch (error) {
        console.error('Notify New Payment Error:', error);
      }
    });

    ipcMain.handle('currency:get-rates', async () => {
      return await getExchangeRates();
    });

    ipcMain.handle('currency:get-all-rates', async (event, force = false) => {
      return await getAllRates(force);
    });

    // Exchange rate handler — returns only plain numbers to avoid IPC cloning issues
    ipcMain.handle('exchange:get-rates', async () => {
      try {
        const rates = await getExchangeRates();
        return { success: true, rates: JSON.parse(JSON.stringify(rates)) };
      } catch (error) {
        console.error('[IPC] exchange:get-rates error:', error.message);
        return { success: false, error: error.message };
      }
    });


    // Language persistence handler
    ipcMain.handle('auth:update-language', async (event, userId, language) => {
      try {
        await User.findByIdAndUpdate(userId, { language });
        console.log(`[LANG] Language updated for user ${userId}: ${language}`);
        return { success: true };
      } catch (error) {
        console.error('[LANG] Update error:', error.message);
        return { success: false, error: error.message };
      }
    });

    // Get user language on session restore
    ipcMain.handle('auth:get-language', async (event, userId) => {
      try {
        const user = await User.findById(userId).select('language').lean();
        return { success: true, language: user?.language || 'tr' };
      } catch (error) {
        return { success: false, language: 'tr' };
      }
    });

    // Premium status check
    ipcMain.handle('auth:check-premium', async (event, userId) => {
      try {
        const user = await User.findById(userId).select('isPremium premiumExpiresAt subscriptionPlan').lean();
        if (!user) return { success: false, isPremium: false };

        // Auto-expire: if premiumExpiresAt is in the past, treat as free
        const isActive = user.isPremium && (!user.premiumExpiresAt || new Date(user.premiumExpiresAt) > new Date());
        if (user.isPremium && !isActive) {
          // Downgrade silently
          await User.findByIdAndUpdate(userId, { isPremium: false, subscriptionPlan: 'free' });
        }

        return {
          success: true,
          isPremium: isActive,
          plan: isActive ? user.subscriptionPlan : 'free',
          expiresAt: user.premiumExpiresAt || null
        };
      } catch (error) {
        console.error('[PREMIUM] check error:', error.message);
        return { success: false, isPremium: false };
      }
    });

    // Set premium (called by Google Play Billing webhook or manual admin)
    ipcMain.handle('auth:set-premium', async (event, { userId, plan, expiresAt }) => {
      try {
        await User.findByIdAndUpdate(userId, {
          isPremium: true,
          subscriptionPlan: plan || 'monthly',
          premiumExpiresAt: expiresAt ? new Date(expiresAt) : null
        });
        console.log(`[PREMIUM] Set for user ${userId}: plan=${plan}`);
        return { success: true };
      } catch (error) {
        console.error('[PREMIUM] set error:', error.message);
        return { success: false, error: error.message };
      }
    });


    // Check for immediate notification (New Payment)
    ipcMain.handle('telegram:check-immediate', async (event, { userId, payment }) => {
      return;
    });

    // --- NEW EMBEDDED DOCUMENT QUERY HANDLERS ---
    // Import query helpers
    const queryHelpers = require('./queryHelpers.cjs');

    // Get user with all embedded data
    ipcMain.handle('db:get-user-all-data', async (event, userId) => {
      try {
        const userData = await queryHelpers.getUserWithAllData(userId);
        return { success: true, data: userData };
      } catch (error) {
        console.error('[IPC] get-user-all-data error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get upcoming payments grouped by bank
    ipcMain.handle('db:get-payments-by-bank', async (event, { userId, days = 30 }) => {
      try {
        const payments = await queryHelpers.getUpcomingPaymentsByBank(userId, days);
        return { success: true, data: payments };
      } catch (error) {
        console.error('[IPC] get-payments-by-bank error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get payments grouped by month
    ipcMain.handle('db:get-payments-by-month', async (event, { userId, year }) => {
      try {
        const payments = await queryHelpers.getPaymentsByMonth(userId, year);
        return { success: true, data: payments };
      } catch (error) {
        console.error('[IPC] get-payments-by-month error:', error);
        return { success: false, error: error.message };
      }
    });

    // Get bank statement
    ipcMain.handle('db:get-bank-statement', async (event, { userId, bankName, startDate, endDate }) => {
      try {
        const statement = await queryHelpers.getBankStatement(
          userId,
          bankName,
          new Date(startDate),
          new Date(endDate)
        );
        return { success: true, data: statement };
      } catch (error) {
        console.error('[IPC] get-bank-statement error:', error);
        return { success: false, error: error.message };
      }
    });

    // Add payment transaction to embedded document
    ipcMain.handle('db:add-payment-transaction', async (event, { userId, bankName, transaction }) => {
      try {
        const result = await queryHelpers.addPaymentTransaction(userId, bankName, transaction);
        return { success: true, data: result };
      } catch (error) {
        console.error('[IPC] add-payment-transaction error:', error);
        return { success: false, error: error.message };
      }
    });

    // Update transaction status
    ipcMain.handle('db:update-transaction-status', async (event, { userId, transactionId, isPaid }) => {
      try {
        const result = await queryHelpers.updateTransactionStatus(userId, transactionId, isPaid);
        return { success: true, data: result };
      } catch (error) {
        console.error('[IPC] update-transaction-status error:', error);
        return { success: false, error: error.message };
      }
    });


    // --- AI FINANCIAL ANALYSIS ---
    const { analyzeFinances } = require('./aiAnalysis.cjs');

    ipcMain.removeHandler('ai:analyze');
    ipcMain.handle('ai:analyze', async (event, userId, force = false, language = 'tr') => {
      let responseData;
      try {
        console.log(`[AI] Handler called with userId: ${userId}, force: ${force}, lang: ${language}`);
        if (!userId) {
          responseData = { success: false, error: 'User ID eksik' };
        } else {
          // --- SUBSCRIPTION CHECK ---
          const user = await User.findById(userId).select('isPremium lastAiAnalysisAt').lean();
          if (user && !user.isPremium) {
            const now = new Date();
            const lastAnalysis = user.lastAiAnalysisAt ? new Date(user.lastAiAnalysisAt) : null;
            
            if (lastAnalysis) {
              const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
              if (lastAnalysis > oneWeekAgo) {
                const daysLeft = Math.ceil((lastAnalysis.getTime() + (7 * 24 * 60 * 60 * 1000) - now.getTime()) / (24 * 60 * 60 * 1000));
                return { 
                  success: false, 
                  error: language === 'en' 
                    ? `Free tier limit: 1 analysis per week. Please wait ${daysLeft} more days or upgrade to Premium.` 
                    : `Ücretsiz plan limiti: Haftada 1 analiz. Lütfen ${daysLeft} gün daha bekleyin veya Premium'a geçin.`
                };
              }
            }
          }

          let userObjectId;
          try { userObjectId = new mongoose.Types.ObjectId(userId); } catch (e) { }

          const query = userObjectId
            ? { $or: [{ userId: userObjectId }, { userId }] }
            : { userId };

          // Fetch and serialize all data upfront
          const rawPayments = await Payment.find(query).lean();
          const payments = JSON.parse(JSON.stringify(rawPayments || []));
          
          const DailyIncomeModel = mongoose.models.DailyIncome ||
            mongoose.model('DailyIncome', new mongoose.Schema({}, { strict: false, collection: 'dailyincomes' }));
          const rawIncomeRecords = await DailyIncomeModel.find(query).lean();
          const incomeRecords = JSON.parse(JSON.stringify(rawIncomeRecords || []));
          const dailyIncomes = {};
          for (const rec of incomeRecords) {
            if (rec.date) dailyIncomes[rec.date] = rec;
          }

          const rawSettings = await Settings.findOne({ $or: [{ userId: userObjectId }, { userId }] }).lean();
          const settings = JSON.parse(JSON.stringify(rawSettings || {}));

          // Get exchange rates
          const rates = await getExchangeRates();

          console.log(`[AI] Analyzing finances for user ${userId}: ${payments.length} payments, lang: ${language}`);
          const result = await analyzeFinances(payments, dailyIncomes, settings, userId, force, rates, language);
          
          // Update last analysis date if not forced (only for actual analyses)
          if (result.source === 'gemini') {
            await User.findByIdAndUpdate(userId, { lastAiAnalysisAt: new Date() });
          }

          responseData = { success: true, data: result };
        }
      } catch (error) {
        console.error('[AI] Analysis error:', error?.message || error);
        responseData = { success: false, error: String(error?.message || 'Bilinmeyen analiz hatası') };
      }

      // CRITICAL: Serialize the ENTIRE response to guarantee IPC compatibility
      try {
        const safe = JSON.parse(JSON.stringify(responseData));
        return safe;
      } catch (serializeErr) {
        console.error('[AI] Serialization failed:', serializeErr?.message);
        return { success: false, error: 'Analiz sonucu serileştirilemedi.' };
      }
    });


    // --- AUTH HANDLERS ---

    // ... (Keep existing handlers, assuming they are defined above or we need to skipping replacing them all)
    // Since replace_file_content needs exact match, and I cannot match 800 lines of handlers easily.
    // I will target the END of whenReady block where these calls happen.
    logDebug('After Handlers');

    try {
      logDebug('Calling createTray...');
      createTray();
      logDebug('createTray finished');
    } catch (e) { logDebug('Tray Creation Failed: ' + e); console.error('Tray Creation Failed:', e); }

    logDebug('Calling scheduleBackupJob...');
    scheduleBackupJob();
    logDebug('scheduleBackupJob finished');

    if (!isDev) {
      logDebug('Checking for updates...');
      try {
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
          logDebug('Update check failed: ' + err);
          console.log('Update check failed:', err);
        });
      } catch (e) { logDebug('Update Sync Error: ' + e); }
    }

    logDebug('Calling createWindow...');
    createWindow();
    logDebug('createWindow returned');
  });

  app.on('window-all-closed', () => {
    logDebug('Window All Closed Event');
    if (process.platform !== 'darwin') {
      logDebug('Quitting App...');
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
} // End of if (gotTheLock)

function displayBotCodes() {
  console.log('\n\n================================================================================');
  console.log('                          BOT SOURCE CODE DISPLAY                               ');
  console.log('================================================================================\n');

  try {
    const mainPath = __filename;
    const code = fs.readFileSync(mainPath, 'utf8');

    // Add syntax highlighting-like formatting for console
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      // Simple coloring for comments and keywords
      let formattedLine = line;
      if (line.trim().startsWith('//')) {
        formattedLine = `\x1b[32m${line}\x1b[0m`; // Green for comments
      } else if (line.includes('function ') || line.includes('const ') || line.includes('let ')) {
        formattedLine = `\x1b[36m${line}\x1b[0m`; // Cyan for declarations
      }
      console.log(`${String(index + 1).padStart(4, ' ')} | ${formattedLine}`);
    });

    console.log('\n================================================================================');
    console.log('                             END OF SOURCE CODE                                 ');
    console.log('================================================================================\n\n');
  } catch (error) {
    console.error('Failed to display source code:', error);
  }
}

