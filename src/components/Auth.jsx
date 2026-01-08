import React, { useState, useEffect } from 'react';
import { Loader2, Mail, Lock, KeyRound } from 'lucide-react';

const Auth = ({ onLogin }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [rememberMe, setRememberMe] = useState(true);

    // Forgot Password State
    const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0: Auth, 1: Info/Bot

    // Security & UX State
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState(null);
    const [redirecting, setRedirecting] = useState(false);

    // Check Lockout on Mount
    useEffect(() => {
        const storedLockout = localStorage.getItem('auth_lockout_until');
        if (storedLockout) {
            const lockoutTime = new Date(parseInt(storedLockout));
            if (lockoutTime > new Date()) {
                setLockoutUntil(lockoutTime);
            } else {
                localStorage.removeItem('auth_lockout_until');
                setLoginAttempts(0);
            }
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Check Lockout
        if (lockoutUntil) {
            if (new Date() < lockoutUntil) {
                setError(`Çok fazla başarısız deneme. Lütfen ${Math.ceil((lockoutUntil - new Date()) / 60000)} dakika bekleyin.`);
                return;
            } else {
                setLockoutUntil(null);
                localStorage.removeItem('auth_lockout_until');
                setLoginAttempts(0);
            }
        }

        // Validation
        if (!formData.email || !formData.password) {
            setError('Lütfen tüm alanları doldurun.');
            return;
        }

        if (formData.password.length < 6) {
            setError('Şifre en az 6 karakter olmalıdır.');
            return;
        }

        if (!isLogin && formData.password !== formData.confirmPassword) {
            setError('Şifreler eşleşmiyor.');
            return;
        }

        setLoading(true);

        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const channel = isLogin ? 'auth:login' : 'auth:register';

                const result = await ipcRenderer.invoke(channel, {
                    email: formData.email,
                    password: formData.password
                });

                if (result.success) {
                    setLoginAttempts(0);
                    localStorage.removeItem('auth_lockout_until');
                    setRedirecting(true);

                    setTimeout(() => {
                        onLogin(result.user, rememberMe);
                    }, 2000);
                } else {
                    if (isLogin) {
                        const newAttempts = loginAttempts + 1;
                        setLoginAttempts(newAttempts);
                        if (newAttempts >= 5) {
                            const lockoutTime = new Date(new Date().getTime() + 30 * 60000); // 30 mins
                            setLockoutUntil(lockoutTime);
                            localStorage.setItem('auth_lockout_until', lockoutTime.getTime().toString());
                            setError('Çok fazla başarısız deneme. 30 dakika engellendiniz.');
                        } else {
                            setError(result.error || 'Giriş başarısız.');
                        }
                    } else {
                        setError(result.error || 'Bir hata oluştu.');
                    }
                }
            } else {
                // Dev mode fallback
                console.log('Browser dev mode auth bypass');
                setRedirecting(true);
                setTimeout(() => {
                    onLogin({ id: 'dev-user-id', email: formData.email }, true);
                }, 2000);
            }
        } catch (err) {
            setError('Sunucu hatası: ' + err.message);
        } finally {
            if (!redirecting) setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4 font-sans">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
                {/* Header / Tabs */}
                <div className="flex border-b border-gray-700">
                    <button
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${isLogin && forgotPasswordStep === 0
                                ? 'bg-gray-800 text-blue-500 border-b-2 border-blue-500'
                                : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                            }`}
                        onClick={() => { setIsLogin(true); setForgotPasswordStep(0); setError(''); }}
                    >
                        Giriş Yap
                    </button>
                    <button
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${!isLogin && forgotPasswordStep === 0
                                ? 'bg-gray-800 text-green-500 border-b-2 border-green-500'
                                : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                            }`}
                        onClick={() => { setIsLogin(false); setForgotPasswordStep(0); setError(''); }}
                    >
                        Kayıt Ol
                    </button>
                </div>

                <div className="p-8">
                    {forgotPasswordStep === 1 ? (
                        <div className="space-y-6 text-center animate-fade-in">
                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                <KeyRound className="w-8 h-8 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Şifre Sıfırlama</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Şifrenizi sıfırlamak için Telegram botumuzu kullanabilirsiniz.
                                </p>
                            </div>

                            <div className="bg-gray-900/80 p-5 rounded-xl border border-gray-700 flex flex-col gap-2 items-center justify-center">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Komut</p>
                                <code className="text-green-400 font-mono text-xl tracking-wide bg-green-400/10 px-4 py-1 rounded">/sifre</code>
                            </div>

                            <a
                                href="https://t.me/yehsqn_bot"
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium"
                            >
                                <span>Telegram Botunu Aç</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>

                            <button
                                onClick={() => setForgotPasswordStep(0)}
                                className="w-full py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium mt-4 border border-gray-600"
                            >
                                Giriş Ekranına Dön
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-bold text-white mb-2">
                                    {isLogin ? 'Hoş Geldiniz' : 'Hesap Oluştur'}
                                </h1>
                                <p className="text-gray-400 text-sm">
                                    {isLogin
                                        ? 'Ödeme Takip Sistemine devam etmek için giriş yapın'
                                        : 'Hemen yeni bir hesap oluşturun ve kullanmaya başlayın'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center pointer-events-none">
                                        <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="E-Posta Adresi"
                                        className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500"
                                        autoComplete="off"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center pointer-events-none">
                                        <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="Şifre"
                                        className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>

                                {!isLogin && (
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center pointer-events-none">
                                            <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-green-500 transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="Şifre Tekrar"
                                            className="w-full bg-gray-900/50 border border-gray-700 text-white rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all placeholder:text-gray-500"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Remember Me Checkbox */}
                            {isLogin && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="rememberMe"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                    />
                                    <label htmlFor="rememberMe" className="text-sm text-gray-400 cursor-pointer select-none">
                                        Beni Hatırla
                                    </label>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl text-center flex items-center justify-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3.5 px-4 rounded-xl text-white font-medium transition-all transform active:scale-[0.98] flex items-center justify-center gap-2
                            ${isLogin
                                        ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                        : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/20'
                                    }
                            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
                        `}
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin w-5 h-5" />
                                ) : (
                                    isLogin ? 'Giriş Yap' : 'Kayıt Ol'
                                )}
                            </button>

                            {isLogin && (
                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setForgotPasswordStep(1)}
                                        className="text-sm text-gray-400 hover:text-white transition-colors"
                                    >
                                        Şifrenizi mi unuttunuz?
                                    </button>
                                </div>
                            )}
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Auth;
