import React, { useState, useEffect } from 'react';
import { Loader2, KeyRound, Mail, Lock, User, Trash2, Plus, ArrowLeft, Building2, UserCircle2, ChevronRight, CheckCircle, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { authLogin, authRegister, authGoogleLogin, authGetUser, authForgotPassword, authVerifyResetCode, authResetPassword } from '../api/client';
import { getSavedAccounts, removeSavedAccount } from '../utils/accountStorage';
import CustomerTypeSelector from './registration/CustomerTypeSelector';
import IndividualForm from './registration/IndividualForm';
import CorporateForm from './registration/CorporateForm';
import {
  validateIndividualForm,
  validateCorporateForm,
} from '../utils/registrationValidation';
import PrivacyPolicyModal from './PrivacyPolicyModal';

// ─── Boş form state fabrikaları ──────────────────────────────────
const emptyIndividual = () => ({
  firstName: '', lastName: '',
  email: '', password: '', confirmPassword: '',
});

const emptyCorporate = () => ({
  companyName: '',
  email: '', password: '', confirmPassword: '',
});

// ─── Ortak hata kutusu ─────────────────────────────────────────
const ErrorBox = ({ msg }) => msg ? (
  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl text-center flex items-center justify-center gap-2">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
    {msg}
  </div>
) : null;

// ─── Bileşen ─────────────────────────────────────────────────────
const Auth = ({ onLogin, onSelectAccount }) => {
  const [savedAccounts, setSavedAccounts] = useState(() => getSavedAccounts());
  const [showSavedAccounts, setShowSavedAccounts] = useState(() => getSavedAccounts().length > 0);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  // Giriş formu
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);

  // Şifre sıfırlama adımları (0: kapalı, 1: e-posta gir, 2: kod gir, 3: yeni şifre)
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ type: '', text: '' });

  // Kayıt: Müşteri tipi
  const [customerType, setCustomerType] = useState('INDIVIDUAL');
  const [individualData, setIndividualData] = useState(emptyIndividual());
  const [corporateData, setCorporateData] = useState(emptyCorporate());
  const [formErrors, setFormErrors] = useState({});
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    const list = getSavedAccounts();
    setSavedAccounts(list);
  }, []);

  const handleSelectSaved = async (acc) => {
    setError('');
    if (acc.hasPin && onSelectAccount) {
      onSelectAccount(acc);
      return;
    }

    setLoading(true);
    try {
      const res = await authGetUser(acc.id);
      if (res.success && res.user) {
        setRedirecting(true);
        setTimeout(() => onLogin(res.user, true), 400);
      } else {
        setError(res.error || 'Hesap bilgileri alınamadı.');
      }
    } catch (err) {
      setError('Bağlantı hatası: ' + err.message);
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  const handleDeleteSaved = (e, accountId) => {
    e.stopPropagation();
    const updated = removeSavedAccount(accountId);
    setSavedAccounts(updated);
    if (updated.length === 0) {
      setShowSavedAccounts(false);
    }
  };

  // Lockout kontrolü
  useEffect(() => {
    const stored = localStorage.getItem('auth_lockout_until');
    if (stored) {
      const t = new Date(parseInt(stored));
      if (t > new Date()) setLockoutUntil(t);
      else localStorage.removeItem('auth_lockout_until');
    }
  }, []);

  // Tab değiştirince hataları temizle
  const switchToLogin = () => { setIsLogin(true); setForgotPasswordStep(0); setError(''); setFormErrors({}); };
  const switchToRegister = () => { setIsLogin(false); setForgotPasswordStep(0); setError(''); setFormErrors({}); };

  // Müşteri tipi değişince formErrors temizle
  const handleTypeChange = (type) => {
    setCustomerType(type);
    setFormErrors({});
    setError('');
  };

  // Bireysel alan güncelleyici
  const updateIndividual = (field, value) => {
    setIndividualData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Kurumsal alan güncelleyici
  const updateCorporate = (field, value) => {
    setCorporateData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  // ── Şifre Sıfırlama İşlemleri ────────────────────────────────
  const handleSendResetCode = async (e) => {
    if (e) e.preventDefault();
    if (!resetEmail.trim()) {
      setResetMsg({ type: 'error', text: 'Lütfen kayıtlı e-posta adresinizi girin.' });
      return;
    }
    setResetLoading(true);
    setResetMsg({ type: '', text: '' });
    try {
      const res = await authForgotPassword(resetEmail.trim());
      if (res.success) {
        setForgotPasswordStep(2);
        setResetMsg({ type: 'success', text: 'Doğrulama kodu e-postanıza gönderildi! Lütfen gelen kutunuzu kontrol edin.' });
      } else {
        setResetMsg({ type: 'error', text: res.error || 'Doğrulama kodu gönderilemedi.' });
      }
    } catch (err) {
      setResetMsg({ type: 'error', text: 'Sunucu hatası: ' + err.message });
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyResetCode = async (e) => {
    if (e) e.preventDefault();
    if (!resetCode.trim() || resetCode.trim().length !== 6) {
      setResetMsg({ type: 'error', text: 'Lütfen 6 haneli doğrulama kodunu eksiksiz girin.' });
      return;
    }
    setResetLoading(true);
    setResetMsg({ type: '', text: '' });
    try {
      const res = await authVerifyResetCode(resetEmail.trim(), resetCode.trim());
      if (res.success) {
        setForgotPasswordStep(3);
        setResetMsg({ type: 'success', text: 'Kod doğrulandı! Şimdi yeni şifrenizi belirleyin.' });
      } else {
        setResetMsg({ type: 'error', text: res.error || 'Geçersiz doğrulama kodu.' });
      }
    } catch (err) {
      setResetMsg({ type: 'error', text: 'Hata: ' + err.message });
    } finally {
      setResetLoading(false);
    }
  };

  const handleCompleteResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetMsg({ type: 'error', text: 'Yeni şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetMsg({ type: 'error', text: 'Şifreler birbiriyle eşleşmiyor.' });
      return;
    }
    setResetLoading(true);
    setResetMsg({ type: '', text: '' });
    try {
      const res = await authResetPassword(resetEmail.trim(), resetCode.trim(), resetNewPassword);
      if (res.success) {
        setResetMsg({ type: 'success', text: 'Şifreniz başarıyla yenilendi! Giriş sayfasına yönlendiriliyorsunuz...' });
        setTimeout(() => {
          setForgotPasswordStep(0);
          setIsLogin(true);
          setLoginData(prev => ({ ...prev, email: resetEmail.trim(), password: '' }));
          setResetMsg({ type: '', text: '' });
          setResetCode('');
          setResetNewPassword('');
          setResetConfirmPassword('');
        }, 1500);
      } else {
        setResetMsg({ type: 'error', text: res.error || 'Şifre güncellenemedi.' });
      }
    } catch (err) {
      setResetMsg({ type: 'error', text: 'Hata: ' + err.message });
    } finally {
      setResetLoading(false);
    }
  };

  // ── Giriş işlemi ─────────────────────────────────────────────
  const handleLogin = async () => {
    if (lockoutUntil && new Date() < lockoutUntil) {
      setError(`Çok fazla başarısız deneme. Lütfen ${Math.ceil((lockoutUntil - new Date()) / 60000)} dakika bekleyin.`);
      return;
    }
    if (!loginData.email || !loginData.password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }
    setLoading(true);
    try {
      const result = await authLogin(loginData.email.trim(), loginData.password);
      if (result.success) {
        setLoginAttempts(0);
        localStorage.removeItem('auth_lockout_until');
        setRedirecting(true);
        setTimeout(() => onLogin(result.user, rememberMe), 800);
      } else {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        if (newAttempts >= 5) {
          const lockout = new Date(Date.now() + 30 * 60000);
          setLockoutUntil(lockout);
          localStorage.setItem('auth_lockout_until', lockout.getTime().toString());
          setError('Çok fazla başarısız deneme. 30 dakika engellendiniz.');
        } else {
          setError(result.error || 'Giriş başarısız.');
        }
      }
    } catch (err) {
      setError('Sunucu hatası: ' + err.message);
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  // ── Kayıt işlemi ─────────────────────────────────────────────
  const handleRegister = async () => {
    setError('');
    const data = customerType === 'INDIVIDUAL' ? individualData : corporateData;
    const validateFn = customerType === 'INDIVIDUAL' ? validateIndividualForm : validateCorporateForm;
    const { valid, errors } = validateFn(data);

    if (!valid) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const { password, confirmPassword, email, ...profileFields } = data;
      const result = await authRegister(email.trim(), password, {
        customerType,
        ...profileFields,
      });

      if (result.success) {
        setRedirecting(true);
        setTimeout(() => onLogin(result.user, true), 800);
      } else {
        setError(result.error || 'Kayıt başarısız.');
      }
    } catch (err) {
      setError('Sunucu hatası: ' + err.message);
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  // ── Google ile Giriş işlemi ──────────────────────────────────
  const [mobileGoogleModal, setMobileGoogleModal] = useState(false);
  const [mobileGoogleEmail, setMobileGoogleEmail] = useState('');
  const [mobileGoogleName, setMobileGoogleName] = useState('');

  const processGoogleLogin = async (payload) => {
    setLoading(true);
    setError('');
    try {
      const result = await authGoogleLogin(payload);
      if (result.success) {
        setLoginAttempts(0);
        localStorage.removeItem('auth_lockout_until');
        setRedirecting(true);
        setTimeout(() => onLogin(result.user, rememberMe), 600);
      } else {
        setError(result.error || 'Google ile giriş başarısız.');
      }
    } catch (err) {
      setError('Google ile giriş hatası: ' + err.message);
    } finally {
      if (!redirecting) setLoading(false);
    }
  };

  // ── Web (desktop) Google OAuth — popup akışı ────────────────────────────
  const triggerWebGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        });
        const profile = await res.json();
        await processGoogleLogin({
          accessToken: tokenResponse.access_token,
          userInfo: profile
        });
      } catch (err) {
        setError('Google kullanıcı bilgisi alınamadı: ' + err.message);
        setLoading(false);
      }
    },
    onError: (err) => {
      console.warn('Google popup error:', err);
      setError('Google ile giriş penceresi açılamadı veya iptal edildi.');
    }
  });

  // ── Native Android / iOS Google Sign-In ─────────────────────────────────
  const triggerNativeGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await GoogleAuth.initialize({
        clientId: '214147261440-rmmia8qnauqmbo4pm382nejch7ddh99t.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      });
      const googleUser = await GoogleAuth.signIn();
      // idToken → server-side verifyIdToken ile doğrulanır (güvenli)
      const idToken = googleUser?.authentication?.idToken;
      if (!idToken) {
        throw new Error('Google ID token alınamadı.');
      }
      await processGoogleLogin({ credential: idToken });
    } catch (err) {
      if (err?.message?.includes('sign_in_cancelled') || err?.message?.includes('canceled')) {
        setError('Google girişi iptal edildi.');
      } else {
        setError('Google ile giriş hatası: ' + (err?.message || err));
      }
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    setError('');
    const isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (isCapacitor) {
      // Native Android/iOS: Google Sign-In SDK kullan
      triggerNativeGoogle();
    } else {
      // Web/Electron: OAuth popup akışı
      try {
        triggerWebGoogle();
      } catch (e) {
        setError('Google ile giriş penceresi açılamadı.');
      }
    }
  };

  // Mobil fallback modal — sadece native akış başarısız olursa (artık kullanılmıyor)
  const handleMobileGoogleSubmit = async (e) => {
    e.preventDefault();
    if (!mobileGoogleEmail || !mobileGoogleEmail.includes('@')) {
      setError('Geçerli bir Google / Gmail adresi girin.');
      return;
    }
    setMobileGoogleModal(false);
    await processGoogleLogin({
      userInfo: {
        email: mobileGoogleEmail.trim().toLowerCase(),
        name: mobileGoogleName.trim() || 'Google Kullanıcısı',
        sub: 'google_mobile_' + Date.now()
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) handleLogin();
    else handleRegister();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4 font-sans">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">

        {/* ── Kayıtlı Hesaplar Ekranı ───────────────────── */}
        {showSavedAccounts && savedAccounts.length > 0 ? (
          <div className="p-6 space-y-5 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20 text-blue-400">
                <UserCircle2 size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Kayıtlı Hesaplar</h1>
              <p className="text-gray-400 text-xs">Devam etmek istediğiniz hesabı seçin</p>
            </div>

            <ErrorBox msg={error} />

            {/* Hesap Listesi */}
            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {savedAccounts.map((acc) => {
                const isCorporate = acc.customerType === 'CORPORATE';
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectSaved(acc)}
                    className="group relative flex items-center justify-between p-3.5 rounded-xl border border-gray-700/80 bg-gray-900/50 hover:bg-gray-750 hover:border-blue-500/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.avatar ? (
                        <img src={acc.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-700 flex-shrink-0" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          isCorporate
                            ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                            : 'bg-blue-900/40 text-blue-300 border border-blue-700/50'
                        }`}>
                          {(acc.displayName || acc.email).charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm truncate">
                            {acc.displayName || acc.email}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{acc.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            isCorporate
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                              : 'bg-gray-800 text-gray-300'
                          }`}>
                            {isCorporate ? '🏢 Kurumsal' : '👤 Bireysel'}
                          </span>
                          {acc.hasPin && (
                            <span className="text-[10px] text-amber-400 font-medium flex items-center gap-0.5">
                              🔒 PIN
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSaved(e, acc.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Bu hesabı cihazdan kaldır"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={16} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Yeni Hesap Butonu */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowSavedAccounts(false);
                }}
                className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border border-gray-600 shadow-sm"
              >
                <Plus size={18} />
                <span>Başka Bir Hesapla Giriş Yap</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Sekmeler ─────────────────────────────────── */}
            <div className="flex border-b border-gray-700">
              <button
                className={`flex-1 py-4 text-sm font-medium transition-colors ${isLogin && forgotPasswordStep === 0
                  ? 'bg-gray-800 text-blue-500 border-b-2 border-blue-500'
                  : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
                onClick={switchToLogin}
              >
                Giriş Yap
              </button>
              <button
                className={`flex-1 py-4 text-sm font-medium transition-colors ${!isLogin && forgotPasswordStep === 0
                  ? `bg-gray-800 border-b-2 ${customerType === 'CORPORATE' ? 'text-emerald-500 border-emerald-500' : 'text-blue-500 border-blue-500'}`
                  : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
                onClick={switchToRegister}
              >
                Kayıt Ol
              </button>
            </div>

            {/* ── İçerik ───────────────────────────────────── */}
            <div className="p-6 max-h-[82vh] overflow-y-auto">
              {/* Kayıtlı hesaplara dön butonu */}
              {savedAccounts.length > 0 && forgotPasswordStep === 0 && (
                <button
                  type="button"
                  onClick={() => setShowSavedAccounts(true)}
                  className="mb-4 w-full py-2 px-3.5 bg-gray-900/60 hover:bg-gray-900 border border-gray-700/70 hover:border-gray-600 rounded-xl text-xs text-blue-400 font-medium flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowLeft size={14} />
                    Kayıtlı Hesaplara Dön ({savedAccounts.length})
                  </span>
                  <span className="text-gray-500 text-[11px]">Seç</span>
                </button>
              )}

          {/* Şifre sıfırlama ekranı (E-posta ile 3 Adımlı Sıfırlama) */}
          {forgotPasswordStep > 0 ? (
            <div className="space-y-5 animate-fade-in">
              {/* Üst Başlık & İkon */}
              <div className="text-center">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-500/20 shadow-inner">
                  {forgotPasswordStep === 1 && <KeyRound className="w-7 h-7 text-blue-400" />}
                  {forgotPasswordStep === 2 && <Mail className="w-7 h-7 text-sky-400" />}
                  {forgotPasswordStep === 3 && <Lock className="w-7 h-7 text-emerald-400" />}
                </div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {forgotPasswordStep === 1 && 'Şifremi Unuttum'}
                  {forgotPasswordStep === 2 && 'Doğrulama Kodu'}
                  {forgotPasswordStep === 3 && 'Yeni Şifre Belirleyin'}
                </h2>
                <p className="text-gray-400 text-xs leading-relaxed max-w-sm mx-auto">
                  {forgotPasswordStep === 1 && 'Kayıtlı e-posta adresinizi girin. Size 6 haneli bir doğrulama kodu göndereceğiz.'}
                  {forgotPasswordStep === 2 && (
                    <>
                      <span className="text-blue-400 font-medium">{resetEmail}</span> adresine gönderilen 6 haneli kodu girin.
                    </>
                  )}
                  {forgotPasswordStep === 3 && 'Hesabınız için yeni ve güvenli bir şifre girin (en az 6 karakter).'}
                </p>
              </div>

              {/* Bildirim / Hata Kutusu */}
              {resetMsg.text && (
                <div className={`p-3 rounded-xl text-xs flex items-center justify-center gap-2 border ${
                  resetMsg.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {resetMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : null}
                  <span>{resetMsg.text}</span>
                </div>
              )}

              {/* ── ADIM 1: E-posta Gir ──────────────── */}
              {forgotPasswordStep === 1 && (
                <form onSubmit={handleSendResetCode} className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Mail className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="email"
                      placeholder="Kayıtlı E-Posta Adresiniz"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm transition-all placeholder:text-gray-500"
                      autoFocus
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    <span>{resetLoading ? 'Kod Gönderiliyor...' : 'Doğrulama Kodu Gönder'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setForgotPasswordStep(0); setResetMsg({ type: '', text: '' }); }}
                    className="w-full py-2.5 text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Giriş Ekranına Dön</span>
                  </button>
                </form>
              )}

              {/* ── ADIM 2: Kod Gir ──────────────────── */}
              {forgotPasswordStep === 2 && (
                <form onSubmit={handleVerifyResetCode} className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-900/60 border border-blue-500/40 text-blue-400 font-mono text-2xl tracking-[0.6em] text-center rounded-xl py-3 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all placeholder:tracking-normal placeholder:text-gray-600"
                      autoFocus
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading || resetCode.length !== 6}
                    className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>{resetLoading ? 'Doğrulanıyor...' : 'Kodu Onayla'}</span>
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotPasswordStep(1)}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={12} />
                      <span>E-postayı Değiştir</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSendResetCode}
                      disabled={resetLoading}
                      className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                    >
                      Kodu Tekrar Gönder
                    </button>
                  </div>
                </form>
              )}

              {/* ── ADIM 3: Yeni Şifre ────────────────── */}
              {forgotPasswordStep === 3 && (
                <form onSubmit={handleCompleteResetPassword} className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      placeholder="Yeni Şifre (En az 6 karakter)"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all placeholder:text-gray-500"
                      autoFocus
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      placeholder="Yeni Şifre Tekrar"
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all placeholder:text-gray-500"
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>{resetLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle ve Giriş Yap'}</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">

              {/* ── GİRİŞ FORMU ──────────────────────── */}
              {isLogin ? (
                <>
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-white mb-1">Hoş Geldiniz</h1>
                    <p className="text-gray-400 text-sm">Ödeme Takip Sistemine devam etmek için giriş yapın</p>
                  </div>

                  {/* E-posta */}
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Mail className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input type="email" placeholder="E-Posta Adresi"
                      className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3.5 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500"
                      autoComplete="off"
                      value={loginData.email}
                      onChange={e => setLoginData(d => ({ ...d, email: e.target.value }))}
                    />
                  </div>

                  {/* Şifre */}
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Lock className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input type="password" placeholder="Şifre"
                      className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3.5 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500"
                      value={loginData.password}
                      onChange={e => setLoginData(d => ({ ...d, password: e.target.value }))}
                    />
                  </div>

                  {/* Beni Hatırla */}
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 cursor-pointer" />
                    <label htmlFor="rememberMe" className="text-sm text-gray-400 cursor-pointer select-none">Beni Hatırla</label>
                  </div>
                </>
              ) : (
                /* ── KAYIT FORMU ───────────────────────── */
                <>
                  <div className="text-center mb-2">
                    <h1 className="text-2xl font-bold text-white mb-1">Hesap Oluştur</h1>
                    <p className="text-gray-400 text-sm">Hesap türünüzü seçerek kayıt formunu doldurun</p>
                  </div>

                  {/* Müşteri Tipi Seçici */}
                  <CustomerTypeSelector value={customerType} onChange={handleTypeChange} />

                  {/* Dinamik Form */}
                  {customerType === 'INDIVIDUAL' ? (
                    <IndividualForm
                      data={individualData}
                      errors={formErrors}
                      onChange={updateIndividual}
                    />
                  ) : (
                    <CorporateForm
                      data={corporateData}
                      errors={formErrors}
                      onChange={updateCorporate}
                    />
                  )}
                </>
              )}

              {/* ── Hata kutusu ───────────────────────── */}
              <ErrorBox msg={error} />

              {/* ── Gönder butonu ─────────────────────── */}
              <button
                type="submit"
                disabled={loading || redirecting}
                className={`w-full py-3.5 px-4 rounded-xl text-white font-semibold transition-all transform active:scale-[0.98] flex items-center justify-center gap-2
                  ${loading || redirecting ? 'opacity-70 cursor-not-allowed' : ''}
                  ${isLogin
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                    : customerType === 'CORPORATE'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/20'
                  }`}
              >
                {loading || redirecting
                  ? <Loader2 className="animate-spin w-5 h-5" />
                  : isLogin ? 'Giriş Yap' : `${customerType === 'CORPORATE' ? '🏢 Kurumsal' : '👤 Bireysel'} Hesap Oluştur`
                }
              </button>

              {/* ── Ayrıcı ve Google ile Giriş ───────────── */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-800 px-3 text-gray-400 font-medium tracking-wider">veya</span>
                </div>
              </div>

              <div className="w-full">
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 active:scale-[0.99] text-gray-800 font-semibold py-2.5 px-4 rounded-xl border border-gray-300 shadow transition-all cursor-pointer disabled:opacity-50 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>{isLogin ? 'Google ile Giriş Yap' : 'Google ile Kayıt Ol'}</span>
                </button>
              </div>

              {/* Şifremi unuttum */}
              {isLogin && (
                <div className="text-center pt-1">
                  <button type="button" onClick={() => setForgotPasswordStep(1)}
                    className="text-sm text-gray-400 hover:text-white transition-colors">
                    Şifrenizi mi unuttunuz?
                  </button>
                </div>
              )}

              {/* Gizlilik ve KVKK Taahhüdü */}
              <div className="text-center pt-3 border-t border-gray-700/60 mt-4">
                <p className="text-[11px] text-gray-400">
                  Devam ederek PayPulse{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    Gizlilik Politikası ve Güvenlik İlkeleri
                  </button>
                  'ni kabul etmiş olursunuz.
                </p>
              </div>
            </form>
          )}
        </div>
      </>
    )}
      </div>

      {/* Mobil Google ile Giriş Modalı */}
      {mobileGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setMobileGoogleModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Google Hesabı ile Giriş</h3>
                <p className="text-xs text-slate-400">Google Play / Gmail hesabınız</p>
              </div>
            </div>

            <form onSubmit={handleMobileGoogleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Google / Gmail E-Posta Adresiniz
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="ornek@gmail.com"
                    value={mobileGoogleEmail}
                    onChange={(e) => setMobileGoogleEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Adınız ve Soyadınız (Opsiyonel)
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    value={mobileGoogleName}
                    onChange={(e) => setMobileGoogleName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm shadow transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <span>Google ile Devam Et</span>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Gizlilik & KVKK Modalı */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};

export default Auth;
