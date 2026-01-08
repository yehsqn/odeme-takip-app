import React, { useState, useRef, useEffect } from 'react';
import { CreditCard, Wallet, FileText, Upload, Save, Plus, Trash2, Settings, Landmark, ScrollText, X, Send, Moon, Sun, Pencil, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import { usePayment } from '../context/PaymentContext';
import AddPaymentModal from './AddPaymentModal';
import MonthlyProjection from './MonthlyProjection';
import IncomeExpense from './IncomeExpense';
import PaymentStatusList from './PaymentStatusList';
import { generatePDFReport } from '../utils/pdfGenerator';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';


const PaymentGroupRow = ({ payment, activeTab, onUpdateStatus, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMultipleInstallments = payment.installmentPlan.length > 1;
  
  // For single installment, just show it
  if (!hasMultipleInstallments) {
    const inst = payment.installmentPlan[0];
    if (!inst) return null; 
    return (
        <tr className="hover:bg-gray-50 transition-colors group">
            <td className="px-6 py-4 text-sm text-gray-600">
                {format(new Date(inst.date), 'dd MMMM yyyy', { locale: tr })}
            </td>
            <td className="px-6 py-4 text-sm text-gray-800 font-medium">{payment.title}</td>
            <td className="px-6 py-4 text-sm text-gray-600">
                {activeTab === 'credit_card' ? (
                <span className="flex items-center gap-1">
                    <Landmark size={14} />
                    {payment.bank || payment.category || 'Diğer'}
                </span>
                ) : (
                <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-semibold">
                    {payment.type === 'check' ? 'ÇEK' : 'SENET'}
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
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }`}
                >
                {inst.isPaid ? 'Ödendi' : 'Bekliyor'}
                </button>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 transition-colors" title="Düzenle">
                        <Pencil size={18} />
                    </button>
                    <button onClick={onDelete} className="text-red-500 hover:text-red-700 transition-colors" title="Sil">
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
                    {format(new Date(firstDate), 'dd MMM', { locale: tr })} - {format(new Date(lastDate), 'dd MMM yyyy', { locale: tr })}
                </span>
            </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">{payment.title}</td>
        <td className="px-6 py-4 text-sm text-gray-600">
             {activeTab === 'credit_card' ? (
                <span className="flex items-center gap-1">
                <Landmark size={14} />
                {payment.bank || payment.category || 'Diğer'}
                </span>
            ) : (
                <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-semibold">
                {payment.type === 'check' ? 'ÇEK' : 'SENET'}
                </span>
            )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">
            {totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </td>
        {activeTab === 'credit_card' && (
             <td className="px-6 py-4 text-sm text-gray-600">
                 {payment.installments} Taksit
             </td>
        )}
        <td className="px-6 py-4">
             <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                 isFullyPaid 
                   ? 'bg-green-100 text-green-700' 
                   : 'bg-blue-100 text-blue-700'
               }`}>
                 {paidCount}/{payment.installmentPlan.length} Ödendi
             </span>
        </td>
        <td className="px-6 py-4">
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={onEdit} className="text-blue-500 hover:text-blue-700 transition-colors" title="Düzenle"><Pencil size={18} /></button>
                <button onClick={onDelete} className="text-red-500 hover:text-red-700 transition-colors" title="Sil"><Trash2 size={18} /></button>
            </div>
        </td>
      </tr>
      {isExpanded && payment.installmentPlan.map(inst => (
          <tr key={inst.id} className="bg-gray-50/50">
             <td className="px-6 py-3 text-sm text-gray-500 pl-12">
                 {format(new Date(inst.date), 'dd MMMM yyyy', { locale: tr })}
             </td>
             <td className="px-6 py-3 text-sm text-gray-500">
                 {inst.installmentNumber}. Taksit/Ödeme
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
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    }`}
                >
                    {inst.isPaid ? 'Ödendi' : 'Bekliyor'}
                </button>
             </td>
             <td className="px-6 py-3"></td>
          </tr>
      ))}
    </>
  );
};

const TitleGroupRow = ({ title, items, activeTab, onUpdateStatus, onEditPayment, onDeletePayment }) => {
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
                {format(new Date(firstDate), 'dd MMM', { locale: tr })} - {format(new Date(lastDate), 'dd MMM yyyy', { locale: tr })}
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
          <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-semibold">Grup</span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-800 font-bold">
          {totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </td>
        {activeTab === 'credit_card' && (
          <td className="px-6 py-4 text-sm text-gray-600">
            {items.reduce((s, p) => s + (p.installments || p.installmentPlan.length || 0), 0)} Taksit
          </td>
        )}
        <td className="px-6 py-4">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            paidCount === allInst.length ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {paidCount}/{allInst.length} Ödendi
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
  const { payments, settings, setSettings, addPayment, updatePayment, deletePayment, updateInstallmentStatus, exportData, importData, storageType, testTelegram } = usePayment();
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
      generatePDFReport(payments);
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
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
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
      
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Ödeme Takip Sistemi</h1>
          <p className="text-gray-500 dark:text-gray-400">Finansal durumunuzu tek yerden yönetin</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => onNavigate('currency')}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Döviz Kurları"
          >
            <DollarSign size={18} />
          </button>
          <button 
            onClick={() => onNavigate('settings')}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Ayarlar"
          >
            <Settings size={18} />
          </button>
          <button 
            onClick={() => generatePDFReport(payments)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <FileText size={18} />
            <span className="hidden sm:inline">Rapor</span>
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm">Bu Ay Ödenecek</p>
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
            %{thisMonthDebt > 0 ? Math.round((thisMonthPaid / thisMonthDebt) * 100) : 0} ödendi 
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-500 text-sm">Gelecek Ay</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatAmount(nextMonthDebt)}</h3>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <CreditCard className="text-purple-500" size={24} />
            </div>
          </div>
          <p className="text-sm text-gray-500">Ödeme Planı</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('credit_card')}
          className={`pb-4 px-4 flex items-center gap-2 font-medium transition-colors relative ${
            activeTab === 'credit_card' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CreditCard size={20} />
          Kredi Kartları
          {activeTab === 'credit_card' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('check_note')}
          className={`pb-4 px-4 flex items-center gap-2 font-medium transition-colors relative ${
            activeTab === 'check_note' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ScrollText size={20} />
          Çek ve Senetler
          {activeTab === 'check_note' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('yearly')}
          className={`pb-4 px-4 flex items-center gap-2 font-medium transition-colors relative ${
            activeTab === 'yearly' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={20} />
          Yıllık Plan
          {activeTab === 'yearly' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('income_expense')}
          className={`pb-4 px-4 flex items-center gap-2 font-medium transition-colors relative ${
            activeTab === 'income_expense' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wallet size={20} />
          Gelir / Gider
          {activeTab === 'income_expense' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>
          )}
        </button>
      </div>

      {/* Content Section */}
      {activeTab === 'yearly' ? (
            <MonthlyProjection payments={payments} updateInstallmentStatus={updateInstallmentStatus} />
          ) : activeTab === 'income_expense' ? (
        <IncomeExpense payments={payments} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {activeTab === 'credit_card' ? 'Kredi Kartı Harcamaları' : 'Çek ve Senet Listesi'}
          </h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Yeni Ekle</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">
                  {activeTab === 'credit_card' ? 'Tarih' : 'Vade Tarihi'}
                </th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">
                  {activeTab === 'credit_card' ? 'Harcama' : 'Muhatap / Açıklama'}
                </th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">
                  {activeTab === 'credit_card' ? 'Banka' : 'Tür'}
                </th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">Tutar</th>
                {activeTab === 'credit_card' && (
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">Taksit</th>
                )}
                <th className="px-6 py-4 text-sm font-medium text-gray-500">Durum</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    Kayıt bulunamadı.
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
                          onDelete={() => { if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) { deletePayment(payment.id); } }}
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
                        onDeletePayment={(p) => { if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) { deletePayment(p.id); } }}
                      />
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};

export default Dashboard;
