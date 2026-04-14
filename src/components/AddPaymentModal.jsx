import React, { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { usePayment } from '../context/PaymentContext';

const getLocalDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const AddPaymentModal = ({ isOpen, onClose, onAdd, initialData = null }) => {
  const { settings } = usePayment();
  const [formData, setFormData] = useState({
    type: 'credit_card', // credit_card, check, promissory_note
    title: '',
    amount: '',
    installments: '1',
    date: getLocalDateStr(),
    bank: settings.banks?.[0]?.name || 'Vakıfbank',
    description: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        type: initialData.type || 'credit_card',
        title: initialData.title || '',
        amount: initialData.amount || '',
        installments: initialData.installments || '1',
        date: initialData.date || new Date().toISOString().slice(0, 10),
        bank: initialData.bank || settings.banks?.[0]?.name || 'Vakıfbank',
        description: initialData.description || '',
      });
    } else if (isOpen && !initialData) {
      // Reset only if opening in Add mode (not Edit mode)
      // Use local date string instead of UTC to avoid timezone issues (e.g. returning yesterday late at night)
      const getLocalDateStr = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      setFormData({
        type: 'credit_card', // credit_card, check, promissory_note
        title: '',
        amount: '',
        installments: '1',
        date: getLocalDateStr(),
        bank: settings.banks?.[0]?.name || 'Vakıfbank',
        description: '',
        currency: localStorage.getItem('lastCurrency') || 'TRY'
      });
    }
  }, [initialData, isOpen, settings.banks]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('lastCurrency', formData.currency);
    onAdd({
      ...formData,
      originalAmount: Number(formData.amount),
      category: formData.type === 'credit_card' ? formData.bank : (formData.type === 'check' ? 'Çek' : 'Senet'), // Backward compatibility mapping
      installments: ['check', 'promissory_note'].includes(formData.type) ? '1' : formData.installments
    });
    onClose();
  };

  const banks = settings.banks || [];
  const isEdit = !!initialData;

  return (
    <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[1000] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md border border-gray-100 dark:border-gray-700 transition-all flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{isEdit ? 'Ödeme Düzenle' : 'Yeni Ekle'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tür</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'credit_card' })}
                className={`py-2 px-1 text-sm rounded-lg border transition-all ${formData.type === 'credit_card'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300 shadow-sm ring-1 ring-blue-500 dark:ring-blue-400'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
              >
                Kredi Kartı
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'check' })}
                className={`py-2 px-1 text-sm rounded-lg border transition-all ${formData.type === 'check'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300 shadow-sm ring-1 ring-blue-500 dark:ring-blue-400'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
              >
                Çek
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'promissory_note' })}
                className={`py-2 px-1 text-sm rounded-lg border transition-all ${formData.type === 'promissory_note'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300 shadow-sm ring-1 ring-blue-500 dark:ring-blue-400'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
              >
                Senet
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="payment-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {formData.type === 'credit_card' ? 'Harcama Başlığı' : 'Muhatap / Açıklama'}
            </label>
            <input
              id="payment-title"
              autoFocus
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder=""
            />
          </div>

          <div className={`grid ${['check', 'promissory_note'].includes(formData.type) ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
            <div>
              <label htmlFor="payment-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tutar</label>
              <div className="flex gap-2">
                <input
                  id="payment-amount"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="TRY">₺</option>
                  <option value="USD">$</option>
                  <option value="EUR">€</option>
                </select>
              </div>
            </div>

            {!['check', 'promissory_note'].includes(formData.type) && (
              <div>
                <label htmlFor="payment-installments" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {formData.type === 'credit_card' ? 'Taksit Sayısı' : 'Adet / Tekrar'}
                </label>
                {formData.type === 'credit_card' ? (
                  <select
                    id="payment-installments"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5, 6, 9, 12].map(n => (
                      <option key={n} value={n}>{n} Taksit</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="payment-installments"
                    type="number"
                    min="1"
                    max="60"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                    placeholder="1"
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="payment-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {formData.type === 'credit_card' ? 'Harcama Tarihi' : 'Vade Tarihi'}
              </label>
              <input
                id="payment-date"
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            {/* Bank Selection - Enabled for ALL types now */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {formData.type === 'credit_card' ? 'Banka Seçimi' : 'Banka / Ödeme Yeri'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {banks.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, bank: b.name })}
                    className={`p-2 flex flex-col items-center justify-center gap-1 text-xs font-medium rounded-lg border transition-all h-14 ${formData.bank === b.name
                        ? `${b.color} ring-2 ring-offset-1 ring-gray-300 shadow-md transform scale-105 dark:ring-gray-600`
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                  >
                    <Building2 size={16} />
                    <span className="text-center leading-tight truncate w-full">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium mt-6 shadow-lg shadow-blue-500/30"
          >
            {isEdit ? 'Güncelle' : 'Ekle'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;