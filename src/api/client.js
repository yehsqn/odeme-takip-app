/**
 * API Client — IPC vs HTTP transport abstraction
 *
 * Electron ortamında: ipcRenderer.invoke() kullanır (mevcut davranış)
 * Mobil/tarayıcı ortamında: REST API (fetch) kullanır
 */

// Turso geçişi: Artık tüm IPC handler'lar devre dışı.
// Hem Electron hem tarayıcı HTTP (REST API) kullanıyor.
const isElectron = () => false;

// API URL — .env'den veya varsayılan
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ─── IPC helper (Electron) ────────────────────────────────────
async function ipc(channel, ...args) {
  const { ipcRenderer } = window.require('electron');
  return ipcRenderer.invoke(channel, ...args);
}

// ─── HTTP helper (Mobile / Web) ───────────────────────────────
async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════
// DATABASE & SYSTEM
// ═══════════════════════════════════════════════════════════════
export const dbStatus = async () => {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    return { connected: data.ok === true };
  } catch {
    return { connected: false };
  }
};

export const dbLoadData = (userId) =>
  isElectron()
    ? ipc('db:load-data', userId)
    : http('GET', `/api/db/load/${userId}`);

export const dbSavePayments = (userId, payments) =>
  isElectron()
    ? ipc('db:save-payments', { userId, payments })
    : http('POST', '/api/db/save/payments', { userId, payments });

export const dbSaveSettings = (userId, settings) =>
  isElectron()
    ? ipc('db:save-settings', { userId, settings })
    : http('POST', '/api/db/save/settings', { userId, settings });

export const dbSaveDailyIncomes = (userId, dailyIncomes) =>
  isElectron()
    ? ipc('db:save-daily-incomes', { userId, dailyIncomes })
    : http('POST', '/api/db/save/daily-incomes', { userId, dailyIncomes });

// Generic save helper for other keys
export const dbSaveGeneric = (channel, userId, key, data) =>
  isElectron()
    ? ipc(channel, { userId, [key]: data })
    : http('POST', `/api/db/save/${key}`, { userId, [key]: data });

// ═══════════════════════════════════════════════════════════════
// AUTH & PIN
// ═══════════════════════════════════════════════════════════════
export const authLogin = (email, password) =>
  isElectron()
    ? ipc('auth:login', { email, password })
    : http('POST', '/api/auth/login', { email, password });

export const authRegister = (email, password) =>
  isElectron()
    ? ipc('auth:register', { email, password })
    : http('POST', '/api/auth/register', { email, password });

export const authGoogleLogin = (credential) =>
  isElectron()
    ? ipc('auth:google-login', { credential })
    : http('POST', '/api/auth/google', { credential });

export const authGetUser = (userId) =>
  isElectron()
    ? ipc('auth:get-user', userId)
    : http('GET', `/api/auth/user/${userId}`);

export const authUpdateLanguage = (userId, language) =>
  isElectron()
    ? ipc('auth:update-language', userId, language)
    : http('PUT', '/api/auth/language', { userId, language });

export const authGetLanguage = (userId) =>
  isElectron()
    ? ipc('auth:get-language', userId)
    : http('GET', `/api/auth/user/${userId}`).then(r => ({
        success: r.success,
        language: r.user?.language || 'tr'
      }));

export const authSetPin = (userId, pin) =>
  isElectron()
    ? ipc('auth:set-pin', { userId, pin })
    : http('POST', '/api/auth/set-pin', { userId, pin });

export const authVerifyPin = (userId, pin) =>
  isElectron()
    ? ipc('auth:verify-pin', { userId, pin })
    : http('POST', '/api/auth/verify-pin', { userId, pin });

export const authSetIncomePassword = (userId, currentPassword, newPassword) =>
  isElectron()
    ? ipc('auth:set-income-password', { userId, currentPassword, newPassword })
    : http('POST', '/api/auth/set-income-password', { userId, currentPassword, newPassword });

export const authVerifyIncomePassword = (userId, password) =>
  isElectron()
    ? ipc('auth:verify-income-password', { userId, password })
    : http('POST', '/api/auth/verify-income-password', { userId, password });

export const authResetIncomePassword = (email) =>
  isElectron()
    ? ipc('auth:reset-income-password', email)
    : http('POST', '/api/auth/reset-income-password', { email });

export const authChangePassword = (userId, currentPassword, newPassword) =>
  isElectron()
    ? ipc('auth:change-password', { userId, currentPassword, newPassword })
    : http('POST', '/api/auth/change-password', { userId, currentPassword, newPassword });

export const authGeneratePairingCode = (userId) =>
  isElectron()
    ? ipc('auth:generate-pairing-code', userId)
    : http('POST', '/api/auth/pairing-code', { userId });

export const authCheckPairingStatus = (userId) =>
  isElectron()
    ? ipc('auth:check-pairing-status', userId)
    : http('GET', `/api/auth/pairing-status/${userId}`);

// ═══════════════════════════════════════════════════════════════
// TELEGRAM
// ═══════════════════════════════════════════════════════════════
export const telegramSendMessage = (userId, message) =>
  isElectron()
    ? ipc('telegram:send-message', { userId, message })
    : http('POST', '/api/telegram/send', { userId, message });

export const telegramNotifyNewPayment = (userId, payment) =>
  isElectron()
    ? ipc('telegram:notify-new-payment', { userId, payment })
    : http('POST', '/api/telegram/notify', { userId, payment });

export const telegramTest = (userId) =>
  isElectron()
    ? ipc('telegram:test', userId)
    : http('POST', '/api/telegram/test', { userId });

// ═══════════════════════════════════════════════════════════════
// OTHER
// ═══════════════════════════════════════════════════════════════
export const incomeRecoverAccess = (userId) =>
  isElectron()
    ? ipc('income:recover-access', userId)
    : http('POST', '/api/income/recover', { userId });

export const exchangeGetRates = () =>
  isElectron()
    ? ipc('exchange:get-rates')
    : http('GET', '/api/exchange/rates');

export const exchangeGetAllRates = (force) =>
  isElectron()
    ? ipc('currency:get-all-rates', force)
    : http('GET', `/api/exchange/all?force=${force}`);

export const aiAnalyze = (userId, force = false, lang = 'tr') =>
  http('GET', `/api/ai/analyze?userId=${userId}&force=${force}&lang=${lang}`);
export const appReportError = (error, info, userId) =>
  isElectron()
    ? ipc('app:report-error', { error, info, userId })
    : http('POST', '/api/errors', { error, info, userId });

export const backupGetSettings = (userId) =>
  isElectron()
    ? ipc('backup:get-settings', userId)
    : http('GET', `/api/backup/settings/${userId}`);

export const backupUpdateSettings = (userId, settings) =>
  isElectron()
    ? ipc('backup:update-settings', { userId, settings })
    : http('POST', '/api/backup/settings', { userId, settings });

export const backupCreateNow = (userId) =>
  isElectron()
    ? ipc('backup:create-now', userId)
    : http('POST', '/api/backup/create', { userId });

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════
export const subscriptionGetStatus = (userId) =>
  isElectron()
    ? ipc('subscription:status', userId)
    : http('GET', `/api/subscription/status/${userId}`);

export const subscriptionActivate = (userId, plan) =>
  isElectron()
    ? ipc('subscription:activate', { userId, plan })
    : http('POST', '/api/subscription/activate', { userId, plan });

export const subscriptionCancel = (userId) =>
  isElectron()
    ? ipc('subscription:cancel', { userId })
    : http('POST', '/api/subscription/cancel', { userId });

export const subscriptionConsumeAiToken = (userId) =>
  isElectron()
    ? ipc('subscription:consume-ai-token', { userId })
    : http('POST', '/api/subscription/consume-ai-token', { userId });
