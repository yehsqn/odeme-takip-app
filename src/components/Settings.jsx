import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Plus, Save, Download, Upload, Lock, Eye, EyeOff, Clock } from 'lucide-react';
import { usePayment } from '../context/PaymentContext';
import PinScreen from './PinScreen';

const Settings = ({ onBack, darkMode, setDarkMode }) => {
  const { settings, setSettings, testTelegram, getTelegramChatId, generatePairingCode, checkPairingStatus, exportData, importData, clearAllData, restoreDefaultBanks, checkDuePayments, user, logout, setPin, setIncomePassword, changePassword, getBackupSettings, updateBackupSettings, createBackupNow } = usePayment();
  const [newBank, setNewBank] = useState({ name: '', cutOffDay: 1, dueDay: 11, color: 'bg-gray-200 text-gray-700 border-gray-300' });
  const [isAdding, setIsAdding] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [checkStatus, setCheckStatus] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStatus, setPinStatus] = useState(null);
  
  // Backup State
  const [backupConfig, setBackupConfig] = useState({ enabled: false, time: '00:00' });
  const [backupStatus, setBackupStatus] = useState(null);
  
  // Main Password State
  const [mainPasswordData, setMainPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showMainPassword, setShowMainPassword] = useState(false);
  const [mainPasswordStatus, setMainPasswordStatus] = useState(null);

  // Income Password State
  const [incomePasswordData, setIncomePasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showIncomePassword, setShowIncomePassword] = useState(false);
  const [incomePasswordStatus, setIncomePasswordStatus] = useState(null);

  const handleSetMainPassword = async () => {
    if (!mainPasswordData.new || !mainPasswordData.new.trim()) {
        setMainPasswordStatus({ type: 'error', message: 'Yeni şifre boş olamaz!' });
        setTimeout(() => setMainPasswordStatus(null), 3000);
        return;
    }

    if (mainPasswordData.new.length < 6 || mainPasswordData.new.length > 8) {
        setMainPasswordStatus({ type: 'error', message: 'Şifre 6-8 karakter arasında olmalıdır!' });
        setTimeout(() => setMainPasswordStatus(null), 3000);
        return;
    }

    if (mainPasswordData.new !== mainPasswordData.confirm) {
        setMainPasswordStatus({ type: 'error', message: 'Yeni şifreler eşleşmiyor!' });
        setTimeout(() => setMainPasswordStatus(null), 3000);
        return;
    }

    if (!mainPasswordData.current) {
        setMainPasswordStatus({ type: 'error', message: 'Mevcut şifrenizi girmelisiniz.' });
        setTimeout(() => setMainPasswordStatus(null), 3000);
        return;
    }

    setMainPasswordStatus({ type: 'loading', message: 'İşleniyor...' });
    
    const result = await changePassword(mainPasswordData.current, mainPasswordData.new);
    if (result.success) {
        setMainPasswordStatus({ type: 'success', message: 'Ana hesap şifresi başarıyla güncellendi!' });
        setMainPasswordData({ current: '', new: '', confirm: '' });
    } else {
        setMainPasswordStatus({ type: 'error', message: result.error });
    }
    setTimeout(() => setMainPasswordStatus(null), 3000);
  };

  const handleSetIncomePassword = async () => {
    if (!incomePasswordData.new || !incomePasswordData.new.trim()) {
        setIncomePasswordStatus({ type: 'error', message: 'Yeni şifre boş olamaz!' });
        setTimeout(() => setIncomePasswordStatus(null), 3000);
        return;
    }

    if (incomePasswordData.new !== incomePasswordData.confirm) {
        setIncomePasswordStatus({ type: 'error', message: 'Yeni şifreler eşleşmiyor!' });
        setTimeout(() => setIncomePasswordStatus(null), 3000);
        return;
    }

    if (user?.hasIncomePassword && !incomePasswordData.current) {
        setIncomePasswordStatus({ type: 'error', message: 'Mevcut şifrenizi girmelisiniz.' });
        setTimeout(() => setIncomePasswordStatus(null), 3000);
        return;
    }

    setIncomePasswordStatus({ type: 'loading', message: 'İşleniyor...' });
    
    const result = await setIncomePassword(incomePasswordData.current, incomePasswordData.new);
    if (result.success) {
        setIncomePasswordStatus({ type: 'success', message: 'Şifre başarıyla güncellendi!' });
        setIncomePasswordData({ current: '', new: '', confirm: '' });
    } else {
        setIncomePasswordStatus({ type: 'error', message: result.error });
    }
    setTimeout(() => setIncomePasswordStatus(null), 3000);
  };

  // Load Backup Settings
  useEffect(() => {
    const loadBackupSettings = async () => {
        if (getBackupSettings) {
            const result = await getBackupSettings();
            if (result.success && result.backup) {
                setBackupConfig({
                    enabled: result.backup.enabled || false,
                    time: result.backup.time || '00:00'
                });
            }
        }
    };
    loadBackupSettings();
  }, [user]);

  const handleSaveBackupSettings = async () => {
    setBackupStatus('Kaydediliyor...');
    const result = await updateBackupSettings(backupConfig);
    if (result.success) {
        setBackupStatus('Ayarlar kaydedildi! ✅');
    } else {
        setBackupStatus('Hata: ' + result.error + ' ❌');
    }
    setTimeout(() => setBackupStatus(null), 3000);
  };

  const handleCreateBackupNow = async () => {
    setBackupStatus('Yedek oluşturuluyor ve gönderiliyor...');
    const result = await createBackupNow();
    if (result.success) {
        setBackupStatus('Yedek başarıyla gönderildi! ✅');
    } else {
        setBackupStatus('Hata: ' + result.error + ' ❌');
    }
    setTimeout(() => setBackupStatus(null), 3000);
  };


  // Check for existing pairing code on mount
  useEffect(() => {
    if (user?.pairingCode) {
        setPairingCode(user.pairingCode);
    }
  }, [user]);

  // Poll for pairing status when code is active
  React.useEffect(() => {
    let interval;
    if (pairingCode) {
      interval = setInterval(async () => {
        const result = await checkPairingStatus();
        if (result.success && result.chatId) {
          setPairingCode(null);
          handleUpdateTelegram('chatId', result.chatId.toString());
          setTelegramStatus(`Eşleşme Başarılı! Chat ID: ${result.chatId} ✅`);
          setTimeout(() => setTelegramStatus(null), 5000);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [pairingCode]);

  const handleSetPin = async (pin) => {
    const result = await setPin(pin);
    if (result.success) {
      setPinStatus('PIN başarıyla oluşturuldu! ✅');
      setShowPinSetup(false);
    } else {
      setPinStatus('Hata: ' + result.error + ' ❌');
    }
    setTimeout(() => setPinStatus(null), 3000);
  };

  if (showPinSetup) {
    return (
      <PinScreen 
        mode="create" 
        onComplete={handleSetPin} 
        onCancel={() => setShowPinSetup(false)}
        title="PIN Oluştur"
        subtitle="Giriş yapmak için kullanacağınız 4 haneli PIN'i belirleyin"
      />
    );
  }

  const handleGenerateCode = async () => {
    const result = await generatePairingCode();
    if (result.success) {
      setPairingCode(result.code);
    } else {
      setTelegramStatus('Kod oluşturulamadı: ' + result.error);
    }
  };

  const handleCheckNow = async () => {
    setCheckStatus('Kontrol ediliyor...');
    const result = await checkDuePayments(true);
    if (result?.success) {
      if (result.message) {
        setCheckStatus(result.message);
      } else if (result.count !== undefined) {
        setCheckStatus(`${result.count} adet ödeme bildirildi! ✅`);
      } else {
        setCheckStatus('İşlem başarılı! ✅');
      }
    } else {
      setCheckStatus('Hata: ' + (result?.error || 'Bilinmeyen hata') + ' ❌');
    }
    setTimeout(() => setCheckStatus(null), 3000);
  };

  const handleClearData = () => {
    const first = confirm('Tüm verileri (ödemeler ve ayarlar) silmek istiyor musunuz?');
    if (!first) return;
    const second = confirm('Emin misiniz? Bu işlem geri alınamaz.');
    if (!second) return;
    clearAllData();
    setImportStatus('Tüm veriler temizlendi. ✅');
    setTimeout(() => setImportStatus(null), 3000);
  };

  const handleRestoreBanks = () => {
    if (confirm('Mevcut banka listeniz varsayılan bankalarla değiştirilecek. Onaylıyor musunuz?')) {
      restoreDefaultBanks();
      setImportStatus('Bankalar varsayılana döndürüldü. ✅');
      setTimeout(() => setImportStatus(null), 3000);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImportStatus('Yükleniyor...');
      await importData(file);
      setImportStatus('Başarılı! Veriler güncellendi. ✅');
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setImportStatus('Hata: ' + error.message + ' ❌');
    }
    // Reset input
    e.target.value = '';
  };

  const handleUpdateBank = (index, field, value) => {
    const updatedBanks = [...settings.banks];
    updatedBanks[index] = { ...updatedBanks[index], [field]: value };
    setSettings(prev => ({ ...prev, banks: updatedBanks }));
  };

  const handleUpdateTelegram = (field, value) => {
    setSettings(prev => ({
      ...prev,
      telegram: { ...prev.telegram, [field]: value }
    }));
  };

  const handleTestTelegram = async () => {
    setTelegramStatus('Gönderiliyor...');
    const result = await testTelegram();
    if (result.success) {
      setTelegramStatus('Başarılı! ✅');
    } else {
      setTelegramStatus('Hata: ' + result.error + ' ❌');
    }
    setTimeout(() => setTelegramStatus(null), 3000);
  };

  const handleGetChatId = async () => {
    setTelegramStatus('Chat ID alınıyor... Lütfen botunuza mesaj gönderin.');
    const result = await getTelegramChatId();
    if (result.success) {
      handleUpdateTelegram('chatId', result.chatId.toString());
      setTelegramStatus(`Chat ID alındı: ${result.chatId} ✅`);
    } else {
      setTelegramStatus('Hata: ' + result.error + ' ❌');
    }
    setTimeout(() => setTelegramStatus(null), 5000);
  };

  const handleAddBank = () => {
    if (!newBank.name) return;
    setSettings(prev => ({ ...prev, banks: [...(prev.banks || []), newBank] }));
    setNewBank({ name: '', cutOffDay: 1, dueDay: 10, color: 'bg-gray-200 text-gray-700 border-gray-300' });
    setIsAdding(false);
  };

  const handleDeleteBank = (index) => {
    if (confirm('Bu bankayı silmek istediğinize emin misiniz?')) {
      const updatedBanks = settings.banks.filter((_, i) => i !== index);
      setSettings(prev => ({ ...prev, banks: updatedBanks }));
    }
  };

  const colorPresets = [
    { name: 'Sarı', cls: 'bg-yellow-400 text-yellow-900 border-yellow-500' },
    { name: 'Kırmızı', cls: 'bg-red-600 text-white border-red-700' },
    { name: 'Mavi', cls: 'bg-blue-800 text-white border-blue-900' },
    { name: 'Yeşil', cls: 'bg-green-600 text-white border-green-700' },
    { name: 'Açık Mavi', cls: 'bg-blue-500 text-white border-blue-600' },
    { name: 'Turuncu', cls: 'bg-orange-500 text-white border-orange-600' },
    { name: 'Mor', cls: 'bg-indigo-900 text-white border-indigo-950' },
    { name: 'Gri', cls: 'bg-gray-200 text-gray-700 border-gray-300' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8 justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-600 dark:text-gray-300"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Ayarlar</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email}</p>
              <p className="text-xs text-gray-500">Kullanıcı</p>
            </div>
            <button 
              onClick={logout}
              className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* Hesap ve Güvenlik */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
            Hesap ve Güvenlik
          </h2>
          
          {/* Hızlı Giriş (PIN) - Devre Dışı Bırakıldı
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800 mb-4">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
                <Lock size={18} className="text-orange-600" />
                Hızlı Giriş (PIN)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {user?.hasPin 
                  ? 'PIN kodunuz aktif. Girişlerde 4 haneli şifrenizi kullanabilirsiniz.' 
                  : 'Girişlerde e-posta/şifre yerine 4 haneli PIN kullanmak için oluşturun.'}
              </p>
            </div>
            
            <button 
              onClick={() => setShowPinSetup(true)}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              {user?.hasPin ? 'PIN Değiştir' : 'PIN Oluştur'}
            </button>
          </div>
          {pinStatus && (
            <div className={`mb-4 p-2 text-sm text-center rounded-lg ${pinStatus.includes('Hata') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {pinStatus}
            </div>
          )}
          */}

          {/* Ana Hesap Şifresi */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Lock size={18} className="text-blue-600 dark:text-blue-400" />
              Ana Hesap Şifresini Değiştir
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mevcut Şifre</label>
                  <div className="relative">
                    <input 
                      type={showMainPassword ? "text" : "password"}
                      value={mainPasswordData.current}
                      onChange={(e) => setMainPasswordData(prev => ({ ...prev, current: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Mevcut giriş şifreniz"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Yeni Şifre</label>
                  <div className="relative">
                    <input 
                      type={showMainPassword ? "text" : "password"}
                      value={mainPasswordData.new}
                      onChange={(e) => setMainPasswordData(prev => ({ ...prev, new: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Yeni şifreniz"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMainPassword(!showMainPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showMainPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Şifre Tekrar</label>
                  <div className="relative">
                    <input 
                      type={showMainPassword ? "text" : "password"}
                      value={mainPasswordData.confirm}
                      onChange={(e) => setMainPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Şifreyi onaylayın"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Bilgi:</p>
                  <p className="text-xs mb-2">
                    Bu şifre uygulamaya ilk girişte kullanılır. Şifrenizi unutmamanız önemlidir.
                  </p>
                </div>
                
                <button 
                  onClick={handleSetMainPassword}
                  className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Şifreyi Güncelle
                </button>
              </div>
            </div>
            
            {mainPasswordStatus && (
               <div className={`mt-3 p-2 text-sm text-center rounded-lg ${
                 mainPasswordStatus.type === 'error' ? 'bg-red-100 text-red-700' : 
                 mainPasswordStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
               }`}>
                 {mainPasswordStatus.message}
               </div>
            )}
          </div>

          {/* Gelir/Gider Şifresi */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Lock size={18} className="text-gray-600 dark:text-gray-400" />
              Gelir / Gider Sayfası Şifresi
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {user?.hasIncomePassword && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mevcut Şifre</label>
                    <div className="relative">
                      <input 
                        type={showIncomePassword ? "text" : "password"}
                        value={incomePasswordData.current}
                        onChange={(e) => setIncomePasswordData(prev => ({ ...prev, current: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                        placeholder="Mevcut şifreniz"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Yeni Şifre</label>
                  <div className="relative">
                    <input 
                      type={showIncomePassword ? "text" : "password"}
                      value={incomePasswordData.new}
                      onChange={(e) => setIncomePasswordData(prev => ({ ...prev, new: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Yeni şifreniz"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIncomePassword(!showIncomePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showIncomePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Şifre Tekrar</label>
                  <div className="relative">
                    <input 
                      type={showIncomePassword ? "text" : "password"}
                      value={incomePasswordData.confirm}
                      onChange={(e) => setIncomePasswordData(prev => ({ ...prev, confirm: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Şifreyi onaylayın"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                  <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Şifre Bilgilendirme:</p>
                  <p className="text-xs mb-2">
                    Artık şifreleriniz için karmaşık kurallar bulunmamaktadır. İstediğiniz şifreyi belirleyebilirsiniz.
                  </p>
                </div>
                
                <button 
                  onClick={handleSetIncomePassword}
                  className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                >
                  {user?.hasIncomePassword ? 'Şifreyi Güncelle' : 'Şifre Oluştur'}
                </button>
              </div>
            </div>
            
            {incomePasswordStatus && (
               <div className={`mt-3 p-2 text-sm text-center rounded-lg ${
                 incomePasswordStatus.type === 'error' ? 'bg-red-100 text-red-700' : 
                 incomePasswordStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
               }`}>
                 {incomePasswordStatus.message}
               </div>
            )}
          </div>
        </div>

        {/* Veri Yönetimi */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-green-500 rounded-full"></span>
            Veri Yönetimi
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <Download size={18} className="text-blue-500" />
                Yedek Al
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Tüm verilerinizi (ödemeler ve ayarlar) JSON formatında bilgisayarınıza indirin.
              </p>
              <button 
                onClick={exportData}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Yedeği İndir
              </button>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <Upload size={18} className="text-green-500" />
                Yedekten Geri Yükle
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Daha önce aldığınız yedeği veya eski uygulama verisini geri yükleyin.
              </p>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  id="import-file"
                />
                <label 
                  htmlFor="import-file"
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload size={18} />
                  Dosya Seç ve Yükle
                </label>
              </div>
              {importStatus && (
                <p className={`mt-2 text-xs font-medium text-center ${importStatus.includes('Hata') ? 'text-red-500' : 'text-green-500'}`}>
                  {importStatus}
                </p>
              )}
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <Trash2 size={18} className="text-red-500" />
                Ödemeleri Temizle
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Tüm ödeme kayıtları silinir, banka ayarları korunur. İşlem geri alınamaz. İki kez onay istenir.
              </p>
              <button 
                onClick={handleClearData}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Ödemeleri Temizle
              </button>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                <Download size={18} className="text-purple-500" />
                Bankaları Geri Yükle
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Varsayılan banka listesini (Akbank, Garanti vb.) geri yükler. Mevcut banka ayarlarınız sıfırlanır.
              </p>
              <button 
                onClick={handleRestoreBanks}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Varsayılanları Yükle
              </button>
            </div>
          </div>
        </div>

        {/* Otomatik Yedekleme */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-teal-500 rounded-full"></span>
            Otomatik Yedekleme Sistemi
          </h2>
          
          <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-100 dark:border-teal-800 mb-6">
            <p className="text-sm text-teal-800 dark:text-teal-300 flex gap-2">
               <Clock size={20} className="shrink-0" />
               <span>
                 Verileriniz belirlediğiniz saatte otomatik olarak yedeklenir ve Telegram üzerinden size gönderilir.
                 Bu özelliği kullanmak için Telegram botu ile eşleşmiş olmanız gerekmektedir.
               </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
             <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                        <span className="block font-medium text-gray-700 dark:text-gray-200">Otomatik Yedekleme</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Günlük otomatik yedek al</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={backupConfig.enabled}
                            onChange={(e) => setBackupConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                    </label>
                </div>

                <div className={`transition-opacity duration-300 ${backupConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Yedekleme Saati</label>
                    <input 
                        type="time" 
                        value={backupConfig.time}
                        onChange={(e) => setBackupConfig(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <button 
                    onClick={handleSaveBackupSettings}
                    className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    Ayarları Kaydet
                </button>
             </div>

             <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Manuel Yedekleme</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                        Şu anki verilerin yedeğini oluşturup hemen Telegram üzerinden gönderir.
                    </p>
                    <button 
                        onClick={handleCreateBackupNow}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Upload size={18} />
                        Şimdi Yedekle ve Gönder
                    </button>
                </div>

                {backupStatus && (
                    <div className={`p-3 rounded-lg text-sm font-medium text-center ${backupStatus.includes('Hata') ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {backupStatus}
                    </div>
                )}
             </div>
          </div>
        </div>

        {/* Telegram Ayarları */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 mb-6">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
            Telegram Bildirim Ayarları
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telegram Eşleşme</label>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Mobil uygulamayı Telegram botuna bağlamak için bir kod oluşturun ve bu kodu <a href="https://t.me/yehsqn_bot" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">@yehsqn_bot</a> botuna gönderin.
                </p>
                
                {pairingCode ? (
                  <div className="text-center mb-3">
                    <div className="text-3xl font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-1">
                      {pairingCode}
                    </div>
                    <p className="text-xs text-red-500 animate-pulse">Bu kod tek kullanımlıktır.</p>
                  </div>
                ) : (
                  <button 
                    onClick={handleGenerateCode}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Eşleşme Kodu Oluştur
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Manuel Chat ID</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={settings.telegram?.chatId || ''}
                  onChange={(e) => handleUpdateTelegram('chatId', e.target.value)}
                  onBlur={(e) => handleUpdateTelegram('chatId', e.target.value.trim())}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Kullanıcı ID"
                />
                <button 
                  onClick={handleTestTelegram}
                  className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-800 whitespace-nowrap font-medium transition-colors"
                >
                  Test Et
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Eşleşme kodu ile otomatik bağlanmanız önerilir.
              </p>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bildirim Zamanlaması</label>
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex-1">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Ödemeye kaç gün kala bildirim gönderilsin?</span>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" 
                    max="30"
                    value={settings.notificationDays ?? 3}
                    onChange={(e) => setSettings(prev => ({ ...prev, notificationDays: parseInt(e.target.value) }))}
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Gün</span>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <div>
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Manuel Kontrol</h4>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Yaklaşan ödemeleri şimdi kontrol et ve bildirim gönder.
                  </p>
                </div>
                <button 
                  onClick={handleCheckNow}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  Şimdi Kontrol Et
                </button>
              </div>
              
              {checkStatus && (
                <div className={`mt-2 p-2 text-sm text-center rounded-lg ${checkStatus.includes('Hata') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {checkStatus}
                </div>
              )}
            </div>
          </div>
          {telegramStatus && (
            <div className={`mt-4 p-3 rounded-lg text-sm font-medium text-center ${telegramStatus.includes('Hata') ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
              {telegramStatus}
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            * Bildirimler her gün saat 09:00'da otomatik gönderilir.
          </p>
        </div>

        {/* Banka Ayarları */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
            Banka ve Kart Ayarları
          </h2>

          <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-100 dark:border-purple-800">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              Her banka için hesap kesim günü ve son ödeme gününü buradan ayarlayabilirsiniz.
              Bu ayarlar taksit planı oluşturulurken kullanılır.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 pb-3">
              <div className="col-span-4">Banka Adı</div>
              <div className="col-span-3 text-center">Hesap Kesim Günü</div>
              <div className="col-span-3 text-center">Son Ödeme Günü</div>
              <div className="col-span-2 text-right">İşlem</div>
            </div>

            {settings.banks?.map((bank, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="col-span-4 flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full shadow-sm ${bank.color.split(' ')[0]}`}></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{bank.name}</span>
                </div>
                <div className="col-span-3 flex items-center justify-center gap-2">
                  <input 
                    type="number" min="1" max="31"
                    value={bank.cutOffDay}
                    onChange={(e) => handleUpdateBank(index, 'cutOffDay', parseInt(e.target.value))}
                    className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-3 flex items-center justify-center gap-2">
                  <input 
                    type="number" min="1" max="31"
                    value={bank.dueDay}
                    onChange={(e) => handleUpdateBank(index, 'dueDay', parseInt(e.target.value))}
                    className="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2 text-right">
                  <button 
                    onClick={() => handleDeleteBank(index)} 
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {isAdding ? (
            <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600 animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Yeni Banka Ekle</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Banka Adı</label>
                  <input 
                    type="text" 
                    value={newBank.name}
                    onChange={(e) => setNewBank({...newBank, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Örn: Enpara"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Renk Seçimi</label>
                  <div className="flex flex-wrap gap-2">
                    {colorPresets.map((c) => (
                      <button 
                        key={c.name}
                        onClick={() => setNewBank({...newBank, color: c.cls})}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${c.cls.split(' ')[0]} ${newBank.color === c.cls ? 'border-black dark:border-white ring-2 ring-offset-2 ring-blue-500' : 'border-transparent'}`}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Hesap Kesim Günü</label>
                  <input 
                    type="number" min="1" max="31"
                    value={newBank.cutOffDay}
                    onChange={(e) => setNewBank({...newBank, cutOffDay: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Son Ödeme Günü</label>
                  <input 
                    type="number" min="1" max="31"
                    value={newBank.dueDay}
                    onChange={(e) => setNewBank({...newBank, dueDay: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors">İptal</button>
                <button onClick={handleAddBank} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm">Ekle</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2 group"
            >
              <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                <Plus size={20} />
              </div>
              <span className="font-medium">Yeni Banka Ekle</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
