import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import Auth from './components/Auth'
import PinScreen from './components/PinScreen'
import CurrencyPage from './components/CurrencyPage'
import { PaymentProvider, usePayment } from './context/PaymentContext'

const AppContent = ({ darkMode, setDarkMode }) => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [pinMode, setPinMode] = useState(false); // true if we are asking for PIN
  const { user, login, verifyPin, logout, getUser } = usePayment();

  // Check for saved session on mount
  useEffect(() => {
    const checkSession = async () => {
      const savedUserId = localStorage.getItem('userId');
      if (!user && savedUserId) {
        // Fetch user info to see if PIN is required
        const result = await getUser(savedUserId);
        if (result.success) {
          if (result.user.hasPin) {
            setPinMode(true);
          } else {
            // No PIN, auto login
            login(result.user, true);
          }
        } else {
          // Invalid user ID
          localStorage.removeItem('userId');
        }
      }
    };
    checkSession();
  }, [user]);

  const handlePinComplete = async (pin) => {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
      const result = await verifyPin(savedUserId, pin);
      if (result.success) {
        setPinMode(false);
      } else {
        // Error handling is inside PinScreen ideally, or we can pass error prop
        alert('PIN Hatalı!');
      }
    }
  };

  if (pinMode) {
    return (
      <PinScreen 
        mode="verify" 
        onComplete={handlePinComplete} 
        onCancel={() => {
          localStorage.removeItem('userId');
          setPinMode(false);
          logout();
        }}
        title="Hoş Geldiniz"
        subtitle="Tekrar giriş yapmak için PIN kodunuzu girin"
      />
    );
  }

  if (!user) {
    return <Auth onLogin={(u, r) => { login(u, r); setCurrentView('dashboard'); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-grow">
        {currentView === 'dashboard' ? (
          <Dashboard onNavigate={setCurrentView} />
        ) : currentView === 'currency' ? (
            <div>
                <button 
                    onClick={() => setCurrentView('dashboard')}
                    className="m-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    &larr; Geri Dön
                </button>
                <CurrencyPage />
            </div>
        ) : (
          <Settings 
            onBack={() => setCurrentView('dashboard')} 
            darkMode={darkMode}
            setDarkMode={setDarkMode}
          />
        )}
      </div>
      <footer className="py-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
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
    <PaymentProvider>
      <AppContent darkMode={darkMode} setDarkMode={setDarkMode} />
    </PaymentProvider>
  )
}

export default App
