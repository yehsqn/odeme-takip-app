import React, { useState, useEffect, useRef } from 'react';
import { Lock, Delete, ArrowRight } from 'lucide-react';

const PinScreen = ({ mode = 'verify', onComplete, onCancel, title, subtitle }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(mode === 'create' ? 'create' : 'verify'); // create -> confirm
  const [error, setError] = useState('');
  
  const handleNumberClick = (num) => {
    setError('');
    if (step === 'create') {
      if (pin.length < 4) setPin(prev => prev + num);
    } else if (step === 'confirm') {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + num);
    } else {
      if (pin.length < 4) setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setError('');
    if (step === 'create') {
      setPin(prev => prev.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  // Auto submit when 4 digits reached
  useEffect(() => {
    if (step === 'verify' && pin.length === 4) {
      onComplete(pin);
      // Reset handled by parent if fail, or unmount if success
    } else if (step === 'create' && pin.length === 4) {
      setTimeout(() => {
        setStep('confirm');
      }, 300);
    } else if (step === 'confirm' && confirmPin.length === 4) {
      if (pin === confirmPin) {
        onComplete(pin);
      } else {
        setError('PIN kodları eşleşmedi. Tekrar deneyin.');
        setConfirmPin('');
        setPin('');
        setStep('create');
      }
    }
  }, [pin, confirmPin, step, onComplete]);

  // Reset error on input
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumberClick(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, pin, confirmPin]);

  const getDisplayDots = () => {
    const activePin = step === 'confirm' ? confirmPin : pin;
    return (
      <div className="flex gap-4 justify-center mb-8">
        {[0, 1, 2, 3].map(i => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              i < activePin.length 
                ? 'bg-blue-600 scale-110' 
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    );
  };

  const getTitle = () => {
    if (title) return title;
    if (step === 'create') return 'PIN Oluştur';
    if (step === 'confirm') return 'PIN Tekrarı';
    return 'Giriş Yap';
  };

  const getSubtitle = () => {
    if (error) return <span className="text-red-500 font-medium">{error}</span>;
    if (subtitle) return subtitle;
    if (step === 'create') return '4 haneli bir şifre belirleyin';
    if (step === 'confirm') return 'Şifrenizi onaylamak için tekrar girin';
    return 'Devam etmek için PIN kodunuzu girin';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 transition-all">
            {getTitle()}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 h-6 transition-all">
            {getSubtitle()}
          </p>
        </div>

        {getDisplayDots()}

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="h-16 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-2xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          <div className="h-16" /> {/* Empty slot for alignment */}
          <button
            onClick={() => handleNumberClick('0')}
            className="h-16 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 text-2xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-16 rounded-xl bg-transparent text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 flex items-center justify-center active:scale-95 transition-all"
          >
            <Delete size={28} />
          </button>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full py-3 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            İptal / Çıkış Yap
          </button>
        )}
      </div>
    </div>
  );
};

export default PinScreen;
