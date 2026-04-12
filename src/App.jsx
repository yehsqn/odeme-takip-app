import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from './i18n/i18n.js'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Auth from './components/Auth'
import PinScreen from './components/PinScreen'
import CurrencyPage from './components/CurrencyPage'
import AIFinanceCoach from './components/AIFinanceCoach'
import BottomNavbar from './components/BottomNavbar'

import { PaymentProvider, usePayment } from './context/PaymentContext'
import { ToastProvider } from './components/Toast'
import { authGetLanguage, dbStatus } from './api/client'
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';


const AppContent = ({ darkMode, setDarkMode }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [pinMode, setPinMode] = useState(false);
  const { user, login, verifyPin, logout, getUser } = usePayment();
  const { t } = useTranslation();

    // Check for saved session on mount (PIN mode only)
    useEffect(() => {
        const checkSession = async () => {
            const savedUserId = localStorage.getItem('userId');
            if (!user && savedUserId) {
                const result = await getUser(savedUserId);
                if (result.success) {
                    if (result.user.hasPin) {
                        setPinMode(true);
                    }
                    // Removed automatic login without PIN as per user request
                    // MongoDB'den dil ayarını yükle
                    try {
                        const langResult = await authGetLanguage(savedUserId);
                        if (langResult.success && langResult.language) {
                            i18n.changeLanguage(langResult.language);
                        }
                    } catch (e) { /* Hata yönetimi */ }
                } else {
                    if (result.error && (result.error.includes('bulunamadı') || result.error.includes('found'))) {
                        console.log('User not found, clearing session...');
                        localStorage.removeItem('userId');
                    } else {
                        console.error('Session restore failed (transient?):', result.error);
                    }
                }
            }
        };
        checkSession();
    }, [user]);

  const [dbConnected, setDbConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const status = await dbStatus();
        if (status.connected) {
          setDbConnected(true);
        } else {
          setTimeout(checkDb, 1000);
        }
      } catch (err) {
        console.error("DB Check Error:", err);
        setError(t('dbErrorMsg'));
      }
    };
    setError(null);
    checkDb();
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 p-6 flex-col">
        <h1 className="text-2xl font-bold text-red-600 mb-4">{t('dbError')}</h1>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  if (!dbConnected) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 flex-col animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-xl font-semibold text-gray-800">{t('appLoading')}</h1>
        <p className="text-gray-500 mt-2">{t('dbWaiting')}</p>
      </div>
    );
  }

  const handlePinComplete = async (pin) => {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
      const result = await verifyPin(savedUserId, pin);
      if (result.success) {
        setPinMode(false);
      } else {
        alert('PIN Hatalı!');
      }
    }
  };

  if (pinMode) {
    return (
      <>
        <PinScreen
          mode="verify"
          onComplete={handlePinComplete}
          onCancel={() => {
            localStorage.removeItem('userId');
            setPinMode(false);
            logout();
          }}
          title={t('loginTitle')}
          subtitle={t('loginSubtitle')}
        />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Auth onLogin={(u, r) => { login(u, r); setCurrentView('dashboard'); }} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950">
      <div className="flex-grow pb-16 md:pb-0">
        {currentView === 'dashboard' ? (
          <Dashboard onNavigate={setCurrentView} />
        ) : currentView === 'ai' ? (
          <div className="animate-fade-in">
            <AIFinanceCoach onBack={() => setCurrentView('dashboard')} />
          </div>
        ) : currentView === 'currency' ? (
          <div className="animate-fade-in">
            <CurrencyPage onBack={() => setCurrentView('dashboard')} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <Settings
              onBack={() => setCurrentView('dashboard')}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
          </div>
        )}
      </div>

      <BottomNavbar currentView={currentView} onNavigate={setCurrentView} />

      <footer className="hidden md:block py-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        Created by <a href="https://www.yehsan.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">yehsqn</a>
      </footer>
    </div>
  );
};

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ToastProvider>
        <PaymentProvider>
          <AppContent darkMode={darkMode} setDarkMode={setDarkMode} />
        </PaymentProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
