import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateInstallmentPlan, generateConsecutivePlan } from '../utils/dateUtils';

const PaymentContext = createContext();

export const usePayment = () => {
  return useContext(PaymentContext);
};

export const DEFAULT_BANKS = [
  { name: 'Akbank', color: 'bg-red-600 text-white border-red-700', cutOffDay: 1, dueDay: 11 },
  { name: 'Halkbank', color: 'bg-sky-600 text-white border-sky-700', cutOffDay: 1, dueDay: 11 },
  { name: 'QNB Finansbank', color: 'bg-indigo-900 text-white border-indigo-950', cutOffDay: 1, dueDay: 11 },
  { name: 'Yapı Kredi', color: 'bg-blue-600 text-white border-blue-700', cutOffDay: 1, dueDay: 11 },
  { name: 'Vakıfbank', color: 'bg-yellow-400 text-yellow-900 border-yellow-500', cutOffDay: 1, dueDay: 11 },
  { name: 'Ziraat Bankası', color: 'bg-red-700 text-white border-red-800', cutOffDay: 1, dueDay: 11 },
  { name: 'İş Bankası', color: 'bg-blue-800 text-white border-blue-900', cutOffDay: 1, dueDay: 11 },
  { name: 'Garanti BBVA', color: 'bg-green-600 text-white border-green-700', cutOffDay: 1, dueDay: 11 },
  { name: 'Diğer', color: 'bg-gray-200 text-gray-700 border-gray-300', cutOffDay: 1, dueDay: 11 }
];

export const PaymentProvider = ({ children }) => {
  const [user, setUser] = useState(null); // User State
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState({ 
    banks: DEFAULT_BANKS
  }); 
  const [dailyIncomes, setDailyIncomes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Add error state
  const [storageType, setStorageType] = useState('local'); // 'local' or 'db'

  // Restore session on app start
  useEffect(() => {
    const restoreSession = async () => {
      const savedUserId = localStorage.getItem('userId');
      if (savedUserId && !user) {
        // Don't set loading true here blindly, as it might block other things
        // But we need to verify if this user actually exists in DB/Electron side
        if (window.require) {
           try {
             const { ipcRenderer } = window.require('electron');
             const result = await ipcRenderer.invoke('auth:get-user', savedUserId);
             if (result.success) {
               setUser(result.user);
             } else {
               localStorage.removeItem('userId'); // Invalid ID
             }
           } catch (error) {
             console.error('Session restore error:', error);
           }
        } else {
           // Browser dev mode
           // We can't verify easily without backend, just restore ID if we trust it
           // For now, let's not restore in browser dev mode to be safe or mock it
        }
      } else {
         // No saved user, so we are ready (loading can be false)
         if (!savedUserId) setLoading(false); 
      }
    };
    restoreSession();
  }, []);

  // Load data from Electron Store (via IPC)
  useEffect(() => {
    const loadData = async () => {
      // If no user, don't load data yet
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        if (window.require) {
          const { ipcRenderer } = window.require('electron');
          // Pass userId to db:get
          const data = await ipcRenderer.invoke('db:get', user.id);
          console.log('Data loaded from DB:', data);
          
          if (data.success === false) {
             console.error("DB Load Error:", data.error);
             setError(data.error);
             // Keep loading true or handle error state to prevent saving empty data
             return; 
          }

          if (data) {
            setPayments(data.payments || []);
            setDailyIncomes(data.dailyIncomes || {});
            
            // Merge saved settings with default structure to ensure banks array exists
            const savedBanks = data.settings?.banks || DEFAULT_BANKS;
            // Ensure all banks have cutOffDay and dueDay
            const mergedBanks = savedBanks.map(b => ({
              ...b,
              cutOffDay: b.cutOffDay || 1,
              dueDay: b.dueDay || 11
            }));
            
            // SYNC FIX: Ensure Telegram Chat ID is synced from User to Settings
            // This prevents "data reset" feeling where bot pairing seems lost
            let mergedSettings = {
              ...data.settings,
              banks: mergedBanks
            };

            if (user.telegramChatId && (!mergedSettings.telegram || !mergedSettings.telegram.chatId)) {
                console.log('Syncing Telegram Chat ID from User to Settings...');
                mergedSettings = {
                    ...mergedSettings,
                    telegram: {
                        ...(mergedSettings.telegram || {}),
                        chatId: user.telegramChatId,
                        notificationsEnabled: true
                    }
                };
                // Trigger background save to persist this sync
                if (window.require) {
                     const { ipcRenderer } = window.require('electron');
                     ipcRenderer.invoke('db:save-settings', { userId: user.id, settings: mergedSettings });
                }
            }
            
            setSettings(mergedSettings);
            setStorageType('db');
          }
        } else {
          // Fallback for browser-only dev (optional)
          console.log('Running in browser mode, using localStorage');
          const saved = localStorage.getItem(`payments_${user.id}`);
          const savedSettings = localStorage.getItem(`settings_${user.id}`);
          const savedIncomes = localStorage.getItem(`dailyIncomes_${user.id}`);
          if (saved) setPayments(JSON.parse(saved));
          if (savedIncomes) setDailyIncomes(JSON.parse(savedIncomes));
          if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            setSettings({
              ...parsed,
              banks: parsed.banks || DEFAULT_BANKS
            });
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]); // Reload when user changes

  // Save to DB whenever payments change
  useEffect(() => {
    if (loading || error || !user) return;
    
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      // Fire and forget but log result
      ipcRenderer.invoke('db:save-payments', { userId: user.id, payments })
        .then(result => {
          if (!result.success) {
            console.error('Failed to save payments to DB:', result.error);
            // Optionally set error state to warn user? 
            // setError(result.error); // Maybe too aggressive if transient
          } else {
            console.log('Payments saved successfully to DB.');
          }
        })
        .catch(err => console.error('Save IPC Error:', err));
    } else {
      localStorage.setItem(`payments_${user.id}`, JSON.stringify(payments));
    }
  }, [payments, loading, error, user]);

  // Save to DB whenever settings change
  useEffect(() => {
    if (loading || error || !user) return;

    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('db:save-settings', { userId: user.id, settings });
    } else {
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(settings));
    }
  }, [settings, loading, error, user]);

  // Save to DB whenever dailyIncomes change
  useEffect(() => {
    if (loading || error || !user) return;

    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('db:save-daily-incomes', { userId: user.id, dailyIncomes });
    } else {
      localStorage.setItem(`dailyIncomes_${user.id}`, JSON.stringify(dailyIncomes));
    }
  }, [dailyIncomes, loading, error, user]);

  const login = (userData, remember = false) => {
    setLoading(true); // Prevent race condition where default settings are saved before DB load
    setUser(userData);
    if (remember) {
      localStorage.setItem('userId', userData.id);
    } else {
      localStorage.removeItem('userId');
    }
  };

  const logout = () => {
    setUser(null);
    setPayments([]);
    setSettings({ banks: DEFAULT_BANKS });
    setDailyIncomes({});
    localStorage.removeItem('userId');
  };

  const setPin = async (pin) => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('auth:set-pin', { userId: user.id, pin });
      if (result.success) {
        // Update local user state to reflect hasPin
        setUser(prev => ({ ...prev, hasPin: true }));
      }
      return result;
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const verifyPin = async (userId, pin) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('auth:verify-pin', { userId, pin });
      if (result.success) {
        setUser(result.user);
        localStorage.setItem('userId', result.user.id);
      }
      return result;
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const setIncomePassword = async (currentPassword, newPassword) => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('auth:set-income-password', { userId: user.id, currentPassword, newPassword });
      if (result.success) {
         setUser(prev => ({ ...prev, hasIncomePassword: true }));
      }
      return result;
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const verifyIncomePassword = async (password) => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('auth:verify-income-password', { userId: user.id, password });
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const resetIncomePassword = async () => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('auth:reset-income-password', user.email);
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const recoverIncomeAccess = async () => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('income:recover-access', user.id);
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('auth:change-password', { userId: user.id, currentPassword, newPassword });
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const restoreDefaultBanks = () => {
    setSettings(prev => ({
      ...prev,
      banks: DEFAULT_BANKS
    }));
  };

  const sendTelegramMessage = async (message) => {
    // Use Electron IPC if available (More reliable)
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('telegram:send-message', { userId: user?.id, message });
      } catch (error) {
        console.error('IPC Telegram Error:', error);
        return { success: false, error: error.message };
      }
    }

    // Fallback for browser
    const { botToken, chatId } = settings.telegram || {};
    if (!botToken || !chatId) return { success: false, error: 'Telegram ayarları eksik' };

    const cleanBotToken = botToken.trim();
    const cleanChatId = chatId.trim();

    try {
      console.log(`Sending to Telegram: https://api.telegram.org/bot${cleanBotToken}/sendMessage`);
      const response = await fetch(`https://api.telegram.org/bot${cleanBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      const data = await response.json();
      if (data.ok) {
        return { success: true };
      } else {
        console.error('Telegram API Error:', data);
        return { success: false, error: `API Hatası: ${data.description} (Kod: ${data.error_code})` };
      }
    } catch (error) {
      console.error('Fetch Error:', error);
      return { success: false, error: 'Ağ Hatası: ' + error.message };
    }
  };

  const testTelegram = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      // Pass userId to identify user
      return await ipcRenderer.invoke('telegram:test', user?.id);
    }
    return await sendTelegramMessage('✅ Ödeme Takip botu başarıyla bağlandı!');
  };

  const generatePairingCode = async () => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('auth:generate-pairing-code', user.id);
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const checkPairingStatus = async () => {
    if (window.require && user) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('auth:check-pairing-status', user.id);
    }
    return { success: false };
  };

  const getUser = async (id) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke('auth:get-user', id);
    }
    return { success: false, error: 'Masaüstü uygulaması gerekli.' };
  };

  const getTelegramChatId = async () => {
    const { botToken } = settings.telegram || {};
    if (!botToken) return { success: false, error: 'Bot Token girilmemiş' };

    const cleanBotToken = botToken.trim();

    try {
      const response = await fetch(`https://api.telegram.org/bot${cleanBotToken}/getUpdates`);
      const data = await response.json();
      
      if (data.ok && data.result.length > 0) {
        // Get the last message's chat id
        const lastUpdate = data.result[data.result.length - 1];
        const chatId = lastUpdate.message?.chat?.id || lastUpdate.channel_post?.chat?.id;
        
        if (chatId) {
          return { success: true, chatId };
        }
      }
      return { success: false, error: 'Mesaj bulunamadı. Lütfen bota bir mesaj atın.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Check for due payments and notify
  const checkDuePayments = async (force = false) => {
    if (loading) return;

    if (payments.length === 0) {
      if (force) return { success: true, count: 0, message: 'Hiç ödeme kaydı bulunamadı.' };
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const notificationDays = parseInt(settings.notificationDays || 3);
    
    const upcomingPayments = payments.flatMap(p => 
      p.installmentPlan
        .filter(inst => !inst.isPaid)
        .map(inst => ({ ...inst, paymentTitle: p.title, type: p.type }))
    ).filter(inst => {
      const instDate = new Date(inst.date);
      instDate.setHours(0, 0, 0, 0);
      const diffTime = instDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Notify for today (0), future within range, and overdue (-days)
      // User request: "Son 3 günden ödeme tarihinin olduğu güne kadar"
      // This implies we should stop notifying after the due date passed (diffDays < 0), 
      // or at least prioritize the range [0, notificationDays].
      // However, usually overdue payments are critical.
      // If we strictly follow "until the day", we should use diffDays >= 0.
      return diffDays >= 0 && diffDays <= notificationDays; 
    });

    if (upcomingPayments.length > 0) {
      // Browser Notification (Only if not forced, or maybe always? Let's keep it simple)
      if (!force) {
        if (Notification.permission === 'granted') {
          new Notification('Ödeme Hatırlatıcı', {
            body: `Yaklaşan ${upcomingPayments.length} ödemeniz var.`,
            icon: '/icon.png'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('Ödeme Hatırlatıcı', {
                body: `Yaklaşan ${upcomingPayments.length} ödemeniz var.`
              });
            }
          });
        }
      }

      // Telegram Notification
      const lastNotified = localStorage.getItem('lastTelegramNotification');
      const todayStr = today.toISOString().split('T')[0];
      
      if ((force || lastNotified !== todayStr) && settings.telegram?.botToken && settings.telegram?.chatId) {
        const totalAmount = upcomingPayments.reduce((sum, p) => sum + p.amount, 0);
        const prefix = force ? '🔔 <b>TEST BİLDİRİMİ</b>\n' : '📢 <b>Ödeme Hatırlatıcı</b>\n';
        
        // List first 5 payments
        const paymentDetails = upcomingPayments.slice(0, 10).map(p => {
          const dateStr = new Date(p.date).toLocaleDateString('tr-TR');
          const pDate = new Date(p.date);
          pDate.setHours(0,0,0,0);
          const tDate = new Date();
          tDate.setHours(0,0,0,0);
          const diffTime = pDate - tDate;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let dayText = '';
          if (diffDays === 0) dayText = '(Bugün)';
          else if (diffDays === 1) dayText = '(Yarın)';
          else dayText = `(${diffDays} Gün Sonra)`;

          return `▪️ <b>${dateStr} ${dayText}</b> - ${p.paymentTitle}: <b>${p.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</b>`;
        }).join('\n');
        
        const moreCount = upcomingPayments.length - 10;
        const moreText = moreCount > 0 ? `\n<i>...ve ${moreCount} diğer ödeme.</i>` : '';

        const message = `${prefix}\nYaklaşan <b>${upcomingPayments.length}</b> adet ödemeniz var.\n\n${paymentDetails}${moreText}\n\nToplam Tutar: <b>${totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</b>\n\nLütfen kontrol ediniz.`;
        
        const result = await sendTelegramMessage(message);
        if (result.success) {
          if (!force) {
             localStorage.setItem('lastTelegramNotification', todayStr);
             localStorage.setItem('lastNotificationCount', upcomingPayments.length.toString());
          }
          return { success: true, count: upcomingPayments.length };
        } else {
          return result;
        }
      }
    } else if (force) {
      return { success: true, count: 0, message: 'Yaklaşan ödeme bulunamadı.' };
    }
    return { success: false, error: 'İşlem yapılmadı' };
  };

  useEffect(() => {
    checkDuePayments();
    
    // Optional: Set interval to check periodically (e.g., every 4 hours)
    const interval = setInterval(() => checkDuePayments(), 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);

  }, [payments, loading, settings.telegram, settings.notificationDays]);

  const addPayment = (paymentData) => {
    const { title, amount, installments, date, category, type, bank } = paymentData;
    
    // Explicitly parse date parts to avoid timezone shifts
    const [year, month, day] = date.split('-').map(Number);
    // Create date at local midnight (00:00:00)
    // Month is 0-indexed in Date constructor
    const dateObj = new Date(year, month - 1, day);

    let installmentPlan;

    // Find bank specific settings
    const bankSettings = settings.banks?.find(b => b.name === bank);
    const cutOffDay = bankSettings?.cutOffDay || 1;
    const dueDay = bankSettings?.dueDay || 11;

    if (type === 'check' || type === 'promissory_note') {
      const count = parseInt(installments) || 1;
      if (count > 1) {
        installmentPlan = generateConsecutivePlan(parseFloat(amount), count, dateObj);
      } else {
        installmentPlan = [{
          id: crypto.randomUUID(),
          installmentNumber: 1,
          date: dateObj,
          amount: parseFloat(amount),
          isPaid: false,
        }];
      }
    } else {
      installmentPlan = generateInstallmentPlan(
        parseFloat(amount),
        parseInt(installments),
        dateObj,
        cutOffDay,
        dueDay
      );
    }

    const newPayment = {
      id: crypto.randomUUID(),
      title,
      amount: parseFloat(amount),
      installments: parseInt(installments),
      date,
      category,
      bank,
      type: type || 'credit_card',
      installmentPlan,
      createdAt: new Date().toISOString(),
    };

    setPayments((prev) => [newPayment, ...prev]);

    // Check for immediate notification
    if (window.require && user) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('telegram:notify-new-payment', { userId: user.id, payment: newPayment });
    }
  };

  const updatePayment = (id, updatedData) => {
    setPayments(prev => prev.map(p => {
      if (p.id !== id) return p;

      // Check if critical fields changed
      const amountChanged = parseFloat(p.amount) !== parseFloat(updatedData.amount);
      const installmentsChanged = parseInt(p.installments) !== parseInt(updatedData.installments);
      const dateChanged = p.date !== updatedData.date;
      const typeChanged = p.type !== updatedData.type;
      const bankChanged = p.bank !== updatedData.bank;

      if (amountChanged || installmentsChanged || dateChanged || typeChanged || bankChanged) {
         // Regenerate plan
         const { title, amount, installments, date, category, type, bank } = updatedData;
         const [year, month, day] = date.split('-').map(Number);
         const dateObj = new Date(year, month - 1, day);
         
         let installmentPlan;
         const bankSettings = settings.banks?.find(b => b.name === bank);
         const cutOffDay = bankSettings?.cutOffDay || 1;
         const dueDay = bankSettings?.dueDay || 11;

         if (['check', 'promissory_note', 'salary', 'insurance'].includes(type)) {
            const count = parseInt(installments) || 1;
            if (count > 1) {
              installmentPlan = generateConsecutivePlan(parseFloat(amount), count, dateObj);
            } else {
              installmentPlan = [{
                id: crypto.randomUUID(),
                installmentNumber: 1,
                date: dateObj,
                amount: parseFloat(amount),
                isPaid: false,
              }];
            }
         } else {
            installmentPlan = generateInstallmentPlan(
              parseFloat(amount),
              parseInt(installments),
              dateObj,
              cutOffDay,
              dueDay
            );
         }
         
         return {
            ...p,
            ...updatedData,
            amount: parseFloat(amount),
            installments: parseInt(installments),
            installmentPlan
         };
      } else {
         // Just update metadata
         return { ...p, ...updatedData };
      }
    }));
  };

  const deletePayment = (id) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const updateInstallmentStatus = (paymentId, installmentId, isPaid) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.id === paymentId) {
          return {
            ...p,
            installmentPlan: p.installmentPlan.map((inst) =>
              inst.id === installmentId ? { ...inst, isPaid } : inst
            ),
          };
        }
        return p;
      })
    );
  };

  const exportData = () => {
    const data = {
      payments,
      settings,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `odeme-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importData = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          let imported = false;
          if (Array.isArray(data)) {
             // Check for old format (has 'musteri' field)
             if (data.length > 0 && data[0].hasOwnProperty('musteri')) {
               // Old format -> MERGE
               const newPayments = data.map(p => {
                 // Parse dates safely
                 const parseDate = (dateStr) => {
                   if (!dateStr) return new Date();
                   const [y, m, d] = dateStr.split('-').map(Number);
                   return new Date(y, m - 1, d);
                 };

                 const amount = parseFloat(p.tutar);
                 // Prioritize 'tarih' (Transaction Date) over 'vadeTarih' (Due Date) to fix date shifting issues in old data
                 const dateObj = parseDate(p.tarih || p.vadeTarih);
                 
               return {
                  id: p.id || crypto.randomUUID(),
                  title: p.musteri,
                  amount: amount,
                  installments: 1,
                  date: p.tarih,
                  category: p.aciklama || 'Genel',
                  bank: (() => {
                    const strip = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const raw = strip(p.banka).toUpperCase();
                    if (raw.includes('AKBANK')) return 'Akbank';
                    if (raw.includes('HALKBANK')) return 'Halkbank';
                    if (raw.includes('VAKIFBANK')) return 'Vakıfbank';
                    if (raw.includes('ZIRAAT')) return 'Ziraat Bankası';
                    if (raw.includes('YAPI KREDI') || raw.includes('YAPI KREDİ')) return 'Yapı Kredi';
                    if (raw.includes('GARANTI') || raw.includes('GARANTİ')) return 'Garanti BBVA';
                    if (raw.includes('IS BANK') || raw.includes('İS BANK')) return 'İş Bankası';
                    return 'Diğer';
                  })(),
                  type: (() => {
                    const strip = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const tip = strip(p.tip).toLowerCase().trim();
                    if (tip === 'senet' || tip === 'promissory_note') return 'promissory_note';
                    if (tip === 'cek' || tip === 'check' || tip === 'çek') return 'check';
                    return 'credit_card';
                  })(),
                  installmentPlan: [{
                     id: crypto.randomUUID(),
                     installmentNumber: 1,
                     date: dateObj,
                     amount: amount,
                     isPaid: p.durum === 'odendi'
                   }],
                   createdAt: new Date().toISOString()
                 };
               });
               
               setPayments(prev => [...prev, ...newPayments]);
               imported = true;
             } else {
               // Standard backup array (Old version of current app) -> REPLACE
               const validPayments = data.map(p => ({
                 ...p,
                 installmentPlan: Array.isArray(p.installmentPlan) ? p.installmentPlan : []
               }));
               setPayments(validPayments);
               imported = true;
             }
          } else {
             if (data.payments) {
               const validPayments = data.payments.map(p => ({
                 ...p,
                 installmentPlan: Array.isArray(p.installmentPlan) ? p.installmentPlan : []
               }));
               setPayments(validPayments);
               imported = true;
             }
             if (data.settings) {
               setSettings(data.settings);
               imported = true;
             }
          }

          if (imported) {
            resolve(true);
          } else {
            reject(new Error('Geçersiz yedek dosyası formatı'));
          }
        } catch (error) {
          console.error('Import error:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Dosya okuma hatası'));
      reader.readAsText(file);
    });
  };

  const updateDailyIncome = (date, type, amount) => {
    setDailyIncomes(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [type]: parseFloat(amount)
      }
    }));
  };

  const addDailyExpense = (date, description, amount) => {
    setDailyIncomes(prev => {
      const currentDay = prev[date] || {};
      const currentExpenses = currentDay.expenses || [];
      const newExpenses = [...currentExpenses, { description, amount: parseFloat(amount), date: new Date() }];
      
      // Calculate new total for 'other' field to keep backward compatibility or just for display
      const currentOther = parseFloat(currentDay.other || 0);
      const newOther = currentOther + parseFloat(amount);

      return {
        ...prev,
        [date]: {
          ...currentDay,
          expenses: newExpenses,
          other: newOther // Update 'other' sum automatically
        }
      };
    });
  };

  const deleteDailyExpense = (date, index) => {
    setDailyIncomes(prev => {
      const currentDay = prev[date] || {};
      const currentExpenses = currentDay.expenses || [];
      
      if (!currentExpenses[index]) return prev; // Item not found

      const amountToRemove = parseFloat(currentExpenses[index].amount);
      const newExpenses = currentExpenses.filter((_, i) => i !== index);
      
      const currentOther = parseFloat(currentDay.other || 0);
      const newOther = Math.max(0, currentOther - amountToRemove);

      return {
        ...prev,
        [date]: {
          ...currentDay,
          expenses: newExpenses,
          other: newOther
        }
      };
    });
  };

  const value = {
    payments,
    settings,
    setSettings,
    dailyIncomes,
    updateDailyIncome,
    addDailyExpense,
    deleteDailyExpense,
    clearAllData: () => {
      if (window.require) {
        setPayments([]);
        setDailyIncomes({});
      } else {
        setPayments([]);
        setDailyIncomes({});
        localStorage.removeItem('payments');
        localStorage.removeItem('dailyIncomes');
      }
    },
    addPayment,
    updatePayment,
    deletePayment,
    updateInstallmentStatus,
    exportData,
    importData,
    testTelegram,
    generatePairingCode,
    checkPairingStatus,
    getUser,
    user,
    login,
    logout,
    setPin,
    verifyPin,
    setIncomePassword,
    verifyIncomePassword,
    resetIncomePassword,
    recoverIncomeAccess,
    changePassword,
    getBackupSettings: async () => {
      if (window.require && user) {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('backup:get-settings', user.id);
      }
      return { success: false, error: 'Masaüstü uygulaması gerekli.' };
    },
    updateBackupSettings: async (backupSettings) => {
      if (window.require && user) {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('backup:update-settings', { userId: user.id, backup: backupSettings });
      }
      return { success: false, error: 'Masaüstü uygulaması gerekli.' };
    },
    createBackupNow: async () => {
      if (window.require && user) {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke('backup:create-now', user.id);
      }
      return { success: false, error: 'Masaüstü uygulaması gerekli.' };
    },
    checkDuePayments,
    restoreDefaultBanks,
    loading,
    storageType
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
    </PaymentContext.Provider>
  );
};
