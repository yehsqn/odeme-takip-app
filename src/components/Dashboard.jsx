import React, { useState, useRef, useEffect } from 'react';
import { CreditCard, Wallet, FileText, Upload, Save, Plus, Trash2, Settings, Landmark, ScrollText, X, Send, Moon, Sun, Pencil, ChevronDown, ChevronUp, DollarSign, RefreshCw, Brain } from 'lucide-react';
import { usePayment } from '../context/PaymentContext';
import { useTranslation } from 'react-i18next';
import AddPaymentModal from './AddPaymentModal';
import MonthlyProjection from './MonthlyProjection';
import IncomeExpense from './IncomeExpense';
import PaymentStatusList from './PaymentStatusList';
import { generatePDFReport } from '../utils/pdfGenerator';
import { format } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';


const PaymentGroupRow = ({ payment, activeTab, onUpdateStatus, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const dateLocale = language === 'tr' ? trLocale : enUS;
  const hasMultipleInstallments = payment.installmentPlan.length > 1;

  // For single installment, just show it
  if (!hasMultipleInstallments) {
    const inst = payment.installmentPlan[0];
    if (!inst) return null;
    return (
      <tr className="hover:bg-gray-50 transition-colors group">
        <td className="px-6 py-4 text-sm text-gray-600">
          {format(new Date(inst.date), 'dd MMMM yyyy', { locale: dateLocale })}
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-medium">{payment.title}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {activeTab === 'credit_card' ? (
            <span className="flex items-center gap-1">
              <Landmark size={14} />
              {payment.bank || payment.category || t('other')}
            </span>
          ) : (
            <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-semibold">
              {payment.type === 'check' ? t('check') : t('note')}
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-800">
          {inst.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </td>
        {activeTab === 'credit_card' && (
          <td className="px-6 py-4 text-sm text-gray-600">
            {inst.installmentNumber} / {payment.installments}
          </td>
        )}
        <td className="px-6 py-4">
          <button
            onClick={() => onUpdateStatus(payment.id, inst.id, !inst.isPaid)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              inst.isPaid
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : new Date(inst.date) < new Date()
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            }`}
          >
            {inst.isPaid ? t('paid') : new Date(inst.date) < new Date() ? t('overdue') || 'Geçti' : t('pending')}
          </button>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 transition-colors" title={t('edit')}>
              <Pencil size={18} />
            </button>
            <button onClick={onDelete} className="text-red-500 hover:text-red-700 transition-colors" title={t('delete')}>
              <Trash2 size={18} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // For multiple installments (Grouped)
  const totalAmount = payment.installmentPlan.reduce((sum, i) => sum + i.amount, 0);
  const paidCount = payment.installmentPlan.filter(i => i.isPaid).length;
  const isFullyPaid = paidCount === payment.installmentPlan.length;
  const firstDate = payment.installmentPlan[0].date;
  const lastDate = payment.installmentPlan[payment.installmentPlan.length - 1].date;

  return (
    <>
      <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`} onClick={() => setIsExpanded(!isExpanded)}>
        <td className="px-6 py-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span className="font-medium">
              {format(new Date(firstDate), 'dd MMM', { locale: dateLocale })} - {format(new Date(lastDate), 'dd MMM yyyy', { locale: dateLocale })}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">{payment.title}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {activeTab === 'credit_card' ? (
            <span className="flex items-center gap-1">
              <Landmark size={14} />
              {payment.bank || payment.category || t('other')}
            </span>
          ) : (
            <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-semibold">
              {payment.type === 'check' ? t('check') : t('note')}
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">
          {totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </td>
        {activeTab === 'credit_card' && (
          <td className="px-6 py-4 text-sm text-gray-600">
            {t('installments', { count: payment.installments })}
          </td>
        )}
        <td className="px-6 py-4">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            isFullyPaid 
              ? 'bg-green-100 text-green-700' 
              : payment.installmentPlan.some(i => !i.isPaid && new Date(i.date) < new Date())
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {payment.installmentPlan.some(i => !i.isPaid && new Date(i.date) < new Date()) && !isFullyPaid ? (t('overdue') || 'Geçti') : t('paidOf', { paid: paidCount, total: payment.installmentPlan.length })}
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 transition-colors" title={t('edit')}><Pencil size={18} /></button>
            <button onClick={onDelete} className="text-red-500 hover:text-red-700 transition-colors" title={t('delete')}><Trash2 size={18} /></button>
          </div>
        </td>
      </tr>
      {isExpanded && payment.installmentPlan.map(inst => (
        <tr key={inst.id} className="bg-gray-50/50">
          <td className="px-6 py-3 text-sm text-gray-500 pl-12">
            {format(new Date(inst.date), 'dd MMMM yyyy', { locale: dateLocale })}
          </td>
          <td className="px-6 py-3 text-sm text-gray-500">
            {inst.installmentNumber}. {i18n.language === 'tr' ? 'Taksit/Ödeme' : 'Installment'}
          </td>
          <td className="px-6 py-3"></td>
          <td className="px-6 py-3 text-sm text-gray-600">
            {inst.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
          </td>
          {activeTab === 'credit_card' && <td className="px-6 py-3"></td>}
          <td className="px-6 py-3">
            <button
              onClick={() => onUpdateStatus(payment.id, inst.id, !inst.isPaid)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                inst.isPaid
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : new Date(inst.date) < new Date()
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              {inst.isPaid ? t('paid') : new Date(inst.date) < new Date() ? t('overdue') || 'Geçti' : t('pending')}
            </button>
          </td>
          <td className="px-6 py-3"></td>
        </tr>
      ))}
    </>
  );
};

const TitleGroupRow = ({ title, items, activeTab, onUpdateStatus, onEditPayment, onDeletePayment }) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'tr' ? trLocale : enUS;
  const [expanded, setExpanded] = useState(false);
  const allInst = items.flatMap(p => p.installmentPlan);
  const totalAmount = allInst.reduce((s, i) => s + i.amount, 0);
  const paidCount = allInst.filter(i => i.isPaid).length;
  const firstDate = allInst.length ? allInst[0].date : null;
  const lastDate = allInst.length ? allInst[allInst.length - 1].date : null;
  return (
    <>
      <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${expanded ? 'bg-gray-50' : ''}`} onClick={() => setExpanded(v => !v)}>
        <td className="px-6 py-4 text-sm text-gray-600">
          {firstDate && lastDate ? (
            <div className="flex items-center gap-2">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="font-medium">
                {format(new Date(firstDate), 'dd MMM', { locale: dateLocale })} - {format(new Date(lastDate), 'dd MMM yyyy', { locale: dateLocale })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="font-medium">—</span>
            </div>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">{title || 'İsimsiz'}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
          <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-semibold">{t('groupLabel') || 'Grup'}</span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">
          {totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </td>
        {activeTab === 'credit_card' && (
          <td className="px-6 py-4 text-sm text-gray-600">
            {items.reduce((s, p) => s + (p.installments || p.installmentPlan.length || 0), 0)} {t('installment')}
          </td>
        )}
        <td className="px-6 py-4">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${paidCount === allInst.length ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
            {paidCount}/{allInst.length} {t('paid')}
          </span>
        </td>
        <td className="px-6 py-4"></td>
      </tr>
      {expanded && (
        <>
          {items.map(p => (
            <PaymentGroupRow
              key={p.id}
              payment={p}
              activeTab={activeTab}
              onUpdateStatus={onUpdateStatus}
              onEdit={() => onEditPayment(p)}
              onDelete={() => onDeletePayment(p)}
            />
          ))}
        </>
      )}
    </>
  );
};



const Dashboard = ({ onNavigate }) => {
  const { payments, settings, setSettings, addPayment, updatePayment, deletePayment, updateInstallmentStatus, exportData, importData, storageType, testTelegram, loading, error, refreshData, user } = usePayment();
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const dateLocale = language === 'tr' ? trLocale : enUS;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [activeTab, setActiveTab] = useState('credit_card'); // 'credit_card', 'check_note', 'yearly', 'income_expense'
  const [showTotals, setShowTotals] = useState(true);
  const fileInputRef = useRef(null);

  // Helper to mask amounts
  const formatAmount = (amount) => {
    if (!showTotals) return '*** ₺';
    return amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
  };

  // PDF Generation Handler
  const handleGeneratePDF = async () => {
    try {
      if (payments.length === 0) {
        alert('Rapor oluşturulacak ödeme kaydı bulunamadı.');
        return;
      }
      generatePDFReport(payments, user?.isPremium);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('PDF raporu oluşturulurken bir hata meydana geldi. Lütfen konsolu kontrol edin.');
    }
  };

  // Filter payments based on active tab
  const filteredPayments = payments.filter(p => {
    if (activeTab === 'credit_card' || activeTab === 'yearly') {
      return p.type === 'credit_card' || (!p.type && p.category !== 'Çek' && p.category !== 'Senet'); // Backward compat
    } else {
      return p.type === 'check' || p.type === 'promissory_note' || p.category === 'Çek' || p.category === 'Senet';
    }
  });

  // Stats Calculation
  const totalDebt = payments.reduce((acc, p) => acc + p.installmentPlan.reduce((sum, i) => !i.isPaid ? sum + i.amount : sum, 0), 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const thisMonthDebt = payments.reduce((acc, p) => {
    const monthInst = p.installmentPlan.find(i => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return monthInst ? acc + monthInst.amount : acc;
  }, 0);

  const thisMonthPaid = payments.reduce((acc, p) => {
    const monthInst = p.installmentPlan.find(i => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return monthInst && monthInst.isPaid ? acc + monthInst.amount : acc;
  }, 0);

  const nextMonthDebt = payments.reduce((acc, p) => {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    const monthInst = p.installmentPlan.find(i => {
      const d = new Date(i.date);
      return d.getMonth() === nextMonth && d.getFullYear() === nextYear;
    });
    return monthInst ? acc + monthInst.amount : acc;
  }, 0);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await importData(file);
        alert('Yedek başarıyla yüklendi!');
      } catch (error) {
        alert('Yedek yüklenirken hata oluştu: ' + error.message);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen pb-24 md:pb-6">
      <AddPaymentModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingPayment(null); }}
        onAdd={(data) => {
          if (editingPayment) {
            updatePayment(editingPayment.id, data);
          } else {
            addPayment(data);
          }
          setEditingPayment(null);
        }}
        initialData={editingPayment}
      />

      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">{t('appTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('appSubtitle')}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1">
          <button
            onClick={refreshData}
            disabled={loading}
            className="flex-shrink-0 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={t('refresh')}
          >
            <div className={`${loading ? 'animate-spin' : ''}`}>
              <RefreshCw size={20} />
            </div>
          </button>
          <button
            onClick={() => onNavigate('currency')}
            className="flex-shrink-0 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Döviz Kurları"
          >
            <DollarSign size={20} />
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className="flex-shrink-0 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Ayarlar"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => onNavigate('ai')}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm whitespace-nowrap"
            title="AI Finansal Koç"
          >
            <Brain size={20} />
            <span>AI Koç</span>
          </button>
          <button
            onClick={() => generatePDFReport(payments, user?.isPremium)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
          >
            <FileText size={20} />
            <span>Rapor</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm ml-auto md:ml-0 whitespace-nowrap"
          >
            <Plus size={20} />
            <span>{t('add')}</span>
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <Trash2 className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">Veri Yükleme Hatası</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              <button
                onClick={refreshData}
                className="mt-2 text-sm font-semibold text-red-800 hover:text-red-900 underline"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm">{t('thisMonthDue')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatAmount(thisMonthDebt)}</h3>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Wallet className="text-blue-500" size={24} />
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${thisMonthDebt > 0 ? (thisMonthPaid / thisMonthDebt) * 100 : 0}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('paidPercent', { count: thisMonthDebt > 0 ? Math.round((thisMonthPaid / thisMonthDebt) * 100) : 0 })}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm">{t('nextMonth')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatAmount(nextMonthDebt)}</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <CreditCard className="text-purple-500" size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-500">{t('paymentPlan')}</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm">{t('totalDebt')}</p>
              <h3 className="text-2xl font-bold text-red-600">{formatAmount(totalDebt)}</h3>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <Landmark className="text-red-500" size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-500">{t('remainingTotal')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('credit_card')}
          className={`pb-4 px-2 md:px-4 flex items-center gap-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'credit_card' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <CreditCard size={18} />
          <span className="text-sm md:text-base">{t('creditCards')}</span>
          {activeTab === 'credit_card' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('check_note')}
          className={`pb-4 px-2 md:px-4 flex items-center gap-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'check_note' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ScrollText size={18} />
          <span className="text-sm md:text-base">{t('checkNote')}</span>
          {activeTab === 'check_note' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('yearly')}
          className={`pb-4 px-2 md:px-4 flex items-center gap-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'yearly' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <FileText size={18} />
          <span className="text-sm md:text-base">{t('yearly')}</span>
          {activeTab === 'yearly' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('income_expense')}
          className={`pb-4 px-2 md:px-4 flex items-center gap-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'income_expense' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Wallet size={18} />
          <span className="text-sm md:text-base">{t('incomeExpense')}</span>
          {activeTab === 'income_expense' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
      </div>

      {loading && payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">{t('dataLoading')}</p>
        </div>
      ) : (
        /* Content Section */
        activeTab === 'yearly' ? (
          <MonthlyProjection payments={payments} updateInstallmentStatus={updateInstallmentStatus} />
        ) : activeTab === 'income_expense' ? (
          <IncomeExpense payments={payments} />
        ) : (
          <div className="bg-white md:bg-transparent md:rounded-xl md:shadow-sm md:border md:border-gray-100 overflow-hidden rounded-none shadow-none border-none">

            {/* Desktop Header for Table */}
            <div className="hidden md:flex p-6 border-b border-gray-100 justify-between items-center bg-white">
              <h2 className="text-xl font-semibold text-gray-800">
                {activeTab === 'credit_card' ? t('creditCardExpenses') : t('checkNoteList')}
              </h2>
            </div>

            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-3">
              {filteredPayments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-100">
                  {t('noRecord')}
                </div>
              ) : (
                (() => {
                  const groups = {};
                  filteredPayments.forEach(p => {
                    const key = (p.title || '').trim();
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(p);
                  });

                  // Flatten for mobile simplified view or keep groups?
                  // Let's render individual items for simplicity in V1 mobile, or use grouped cards.
                  // Grouping is better.
                  return Object.entries(groups).map(([title, items]) => {
                    // Calculate group summary
                    const allInst = items.flatMap(p => p.installmentPlan);
                    const total = allInst.reduce((s, i) => s + i.amount, 0);
                    const paid = allInst.filter(i => i.isPaid).length;
                    const isPaid = paid === allInst.length;

                    return (
                      <div key={title} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-gray-800">{title || 'İsimsiz'}</h3>
                            <p className="text-xs text-gray-500">
                              {items[0].bank || items[0].category || 'Diğer'}
                            </p>
                          </div>
                          <span className="font-bold text-gray-800">
                            {total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {t('paidOf', paid, allInst.length)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setEditingPayment(items[0]); setIsModalOpen(true); }}
                              className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => { if (window.confirm(t('confirmDelete'))) deletePayment(items[0].id); }}
                              className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Installments List for Mobile */}
                        <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
                          {allInst.map(inst => (
                            <div key={inst.id} className="flex justify-between items-center text-sm">
                              <div className="flex flex-col">
                                <span className="text-gray-600">{format(new Date(inst.date), 'dd MMM yyyy', { locale: dateLocale })}</span>
                                <span className="text-xs text-gray-400">{inst.installmentNumber}. Taksit</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{inst.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                                <button
                                  onClick={() => updateInstallmentStatus(items[0].id, inst.id, !inst.isPaid)}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                                    inst.isPaid
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : new Date(inst.date) < new Date()
                                      ? 'bg-red-500 border-red-500 text-white'
                                      : 'border-gray-300 text-gray-300'
                                  }`}
                                >
                                  {(inst.isPaid || new Date(inst.date) < new Date()) && <div className="w-2 h-2 bg-white rounded-full" />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto bg-white">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">
                      {activeTab === 'credit_card' ? t('date') : t('dueDate')}
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">
                      {activeTab === 'credit_card' ? t('expense') : t('counterpart')}
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">
                      {activeTab === 'credit_card' ? t('bank') : t('type')}
                    </th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">{t('amount')}</th>
                    {activeTab === 'credit_card' && (
                      <th className="px-6 py-4 text-sm font-medium text-gray-500">{t('installment')}</th>
                    )}
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">{t('status')}</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                        {t('noRecord')}
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const groups = {};
                      filteredPayments.forEach(p => {
                        const key = (p.title || '').trim();
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(p);
                      });
                      const entries = Object.entries(groups);
                      return entries.map(([title, items]) => {
                        if (items.length === 1) {
                          const payment = items[0];
                          return (
                            <PaymentGroupRow
                              key={payment.id}
                              payment={payment}
                              activeTab={activeTab}
                              onUpdateStatus={updateInstallmentStatus}
                              onEdit={() => { setEditingPayment(payment); setIsModalOpen(true); }}
                              onDelete={() => { if (window.confirm(t('confirmDelete'))) { deletePayment(payment.id); } }}
                            />
                          );
                        }
                        return (
                          <TitleGroupRow
                            key={title || Math.random()}
                            title={title}
                            items={items}
                            activeTab={activeTab}
                            onUpdateStatus={updateInstallmentStatus}
                            onEditPayment={(p) => { setEditingPayment(p); setIsModalOpen(true); }}
                            onDeletePayment={(p) => { if (window.confirm(t('confirmDelete'))) { deletePayment(p.id); } }}
                          />
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default Dashboard;
