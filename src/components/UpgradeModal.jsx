import React, { useState } from 'react';
import { Crown, X, Check, Zap, Shield, Bot, Brain, FileText, CreditCard, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const UpgradeModal = ({ isOpen, onClose, featureName }) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState('monthly');
  const [months, setMonths] = useState(1);
  const [years, setYears] = useState(1);

  if (!isOpen) return null;

  const monthlyPrice = 250;
  const yearlyPrice = 2500;

  const totalPrice = selectedType === 'monthly'
    ? monthlyPrice * months
    : yearlyPrice * years;

  const durationText = selectedType === 'monthly'
    ? `${months} ${t('upgrade.perMonth', 'Ay')}`
    : `${years} ${t('upgrade.perYear', 'Yıl')}`;

  const premiumFeatures = [
    { icon: CreditCard, text: t('upgrade.premBanks', 'Sınırsız banka hesabı') },
    { icon: Brain, text: t('upgrade.premAI', 'Sınırsız AI Finans Koçu') },
    { icon: FileText, text: t('upgrade.premPDF', 'Filigransız PDF raporları') },
    { icon: Bot, text: t('upgrade.premTelegram', 'Telegram bildirimleri') },
    { icon: Shield, text: t('upgrade.premLock', 'Hassas sayfa kilidi') },
    { icon: Zap, text: t('upgrade.premBackup', 'Otomatik yedekleme') },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div 
        className="relative w-full max-w-lg bg-gray-800 rounded-2xl shadow-2xl overflow-hidden z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="w-16 h-16 mx-auto mb-3 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Crown size={32} className="text-yellow-300" />
          </div>
          <h2 className="text-2xl font-bold mb-1">{t('upgrade.title', 'Premium\'a Yükselt')}</h2>
          <p className="text-sm text-white/80">{t('upgrade.subtitle', 'Tüm özelliklerin kilidini aç')}</p>

          {featureName && (
            <div className="mt-3 px-4 py-2 bg-white/15 rounded-lg text-sm font-medium backdrop-blur-sm inline-block">
              <Zap size={14} className="inline mr-1" />
              {featureName} — {t('upgrade.premiumOnly', 'Premium Özel')}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Plan Type Toggle */}
          <div className="flex bg-gray-700 rounded-xl p-1 mb-5">
            <button
              onClick={() => setSelectedType('monthly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                selectedType === 'monthly'
                  ? 'bg-gray-600 text-indigo-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t('upgrade.monthly', 'Aylık')}
            </button>
            <button
              onClick={() => setSelectedType('yearly')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                selectedType === 'yearly'
                  ? 'bg-gray-600 text-purple-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t('upgrade.yearly', 'Yıllık')}
            </button>
          </div>

          {/* Duration Selector */}
          <div className="flex items-center justify-center gap-6 mb-5">
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
                {selectedType === 'monthly' ? t('upgrade.howManyMonths', 'Kaç Ay?') : t('upgrade.howManyYears', 'Kaç Yıl?')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedType === 'monthly' ? setMonths(Math.max(1, months - 1)) : setYears(Math.max(1, years - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-colors text-gray-300"
                >
                  <ChevronDown size={20} />
                </button>
                <div className="w-16 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center border-2 border-indigo-700">
                  <span className="text-2xl font-black text-indigo-300">
                    {selectedType === 'monthly' ? months : years}
                  </span>
                </div>
                <button
                  onClick={() => selectedType === 'monthly' ? setMonths(Math.min(12, months + 1)) : setYears(Math.min(5, years + 1))}
                  className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center hover:bg-gray-600 transition-colors text-gray-300"
                >
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            <div className="text-center">
              <span className="text-xs text-gray-400 mb-2 block font-medium uppercase tracking-wider">
                {t('upgrade.totalPrice', 'Toplam')}
              </span>
              <div className="text-3xl font-black text-white">
                ₺{totalPrice.toLocaleString('tr-TR')}
              </div>
              <div className="text-xs text-gray-400">
                {durationText}
              </div>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex gap-2 mb-5 justify-center flex-wrap">
            {selectedType === 'monthly' ? (
              <>
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      months === m
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'bg-gray-700 text-gray-300 hover:bg-indigo-900/30'
                    }`}
                  >
                    {m} {t('upgrade.perMonth', 'Ay')}
                  </button>
                ))}
              </>
            ) : (
              <>
                {[1, 2, 3].map(y => (
                  <button
                    key={y}
                    onClick={() => setYears(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      years === y
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-gray-700 text-gray-300 hover:bg-purple-900/30'
                    }`}
                  >
                    {y} {t('upgrade.perYear', 'Yıl')}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Features */}
          <div className="space-y-2 mb-2">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              <Crown size={12} />
              {t('upgrade.includedFeatures', 'Dahil Özellikler')}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {premiumFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-200 font-medium">
                  <Check size={14} className="shrink-0 mt-0.5 text-green-500" />
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={() => {
              alert(
                t('upgrade.contactMsg', 'Premium aktivasyonu için lütfen geliştirici ile iletişime geçin.')
              );
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            <Crown size={18} />
            {t('upgrade.cta', 'Premium\'a Geç')} — ₺{totalPrice.toLocaleString('tr-TR')} / {durationText}
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            {t('upgrade.note', 'İstediğiniz zaman iptal edebilirsiniz.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
