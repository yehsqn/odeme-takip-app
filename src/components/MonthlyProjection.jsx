import React, { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, X, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { generateMonthlyProjectionPDF } from '../utils/pdfGenerator';

const MonthlyProjection = ({ payments, updateInstallmentStatus }) => {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonthData, setSelectedMonthData] = useState(null);

  const handlePrevYear = () => setSelectedYear(prev => prev - 1);
  const handleNextYear = () => setSelectedYear(prev => prev + 1);

  const months = [];
  // Generate Jan-Dec for selectedYear
  for (let i = 0; i < 12; i++) {
    months.push(new Date(selectedYear, i, 1));
  }

  const data = months.map(monthDate => {
    const monthKey = format(monthDate, 'yyyy-MM');
    
    // Filter installments for this month
    const monthlyInstallments = payments.flatMap(p => 
      p.installmentPlan.filter(inst => {
        const d = new Date(inst.date);
        return format(d, 'yyyy-MM') === monthKey;
      }).map(inst => ({ 
        ...inst, 
        type: p.type, 
        category: p.category,
        title: p.title,
        bank: p.bank,
        paymentId: p.id // Add paymentId to identify parent
      }))
    );

    const total = monthlyInstallments.reduce((sum, i) => sum + i.amount, 0);
    const paid = monthlyInstallments.filter(i => i.isPaid).reduce((sum, i) => sum + i.amount, 0);
    const remaining = total - paid;

    const checkTotal = monthlyInstallments.filter(i => i.type === 'check').reduce((sum, i) => sum + i.amount, 0);
    const senetTotal = monthlyInstallments.filter(i => i.type === 'promissory_note').reduce((sum, i) => sum + i.amount, 0);
    const creditCardTotal = monthlyInstallments.filter(i => i.type === 'credit_card').reduce((sum, i) => sum + i.amount, 0);

    return {
      date: monthDate,
      total,
      paid,
      remaining,
      checkTotal,
      senetTotal,
      creditCardTotal,
      installments: monthlyInstallments.sort((a, b) => new Date(a.date) - new Date(b.date))
    };
  });

  const handleTogglePayment = (paymentId, installmentId, currentStatus) => {
    if (updateInstallmentStatus) {
       updateInstallmentStatus(paymentId, installmentId, !currentStatus);
       // We need to update local state immediately to reflect changes in modal
       // Since data is derived from 'payments' prop, and 'payments' comes from parent,
       // once parent updates, this component re-renders.
       // However, selectedMonthData is local state copy. We need to sync it.
       // The simplest way is to let the parent update propagate down, 
       // but we need to refresh 'selectedMonthData' from the new props.
       // Or, we can just close the modal. But better UX is to stay open.
    }
  };

  // Effect to sync selectedMonthData when payments change
  React.useEffect(() => {
    if (selectedMonthData) {
      const currentMonthKey = format(selectedMonthData.date, 'yyyy-MM');
      const newData = data.find(d => format(d.date, 'yyyy-MM') === currentMonthKey);
      if (newData) {
        setSelectedMonthData(newData);
      }
    }
  }, [payments, selectedYear]); // Re-run when payments update

  const currentMonthKey = format(new Date(), 'yyyy-MM');

  return (
    <div className="mb-6 relative">
      {/* Month Details Modal */}
      {selectedMonthData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white capitalize">
                  {format(selectedMonthData.date, 'MMMM yyyy', { locale: tr })}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Toplam {selectedMonthData.installments.length} adet ödeme
                </p>
              </div>
              <button 
                onClick={() => setSelectedMonthData(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto custom-scrollbar">
              {selectedMonthData.installments.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-gray-500 flex flex-col items-center gap-3">
                  <Calendar size={48} className="opacity-20" />
                  <p>Bu ay için ödeme kaydı bulunmuyor.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMonthData.installments.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${item.isPaid ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {item.isPaid ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 dark:text-white">{item.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{format(new Date(item.date), 'd MMMM', { locale: tr })}</span>
                            <span>•</span>
                            <span>{item.bank || item.category || 'Diğer'}</span>
                            {item.installmentNumber && (
                              <>
                                <span>•</span>
                                <span>{item.installmentNumber}. Taksit</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className={`block font-bold ${item.isPaid ? 'text-green-600 dark:text-green-500' : 'text-gray-900 dark:text-white'}`}>
                          {item.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePayment(item.paymentId, item.id, item.isPaid);
                          }}
                          className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                            item.isPaid 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {item.isPaid ? 'Ödendi' : 'Öde'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-2xl">
               <div className="grid grid-cols-3 gap-4 mb-4">
                 <div className="text-center">
                   <span className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Toplam</span>
                   <span className="font-bold text-gray-800 dark:text-white">{selectedMonthData.total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                 </div>
                 <div className="text-center border-l border-gray-200 dark:border-gray-700">
                   <span className="block text-xs text-green-600 dark:text-green-500 uppercase font-bold tracking-wider">Ödenen</span>
                   <span className="font-bold text-green-600 dark:text-green-500">{selectedMonthData.paid.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                 </div>
                 <div className="text-center border-l border-gray-200 dark:border-gray-700">
                   <span className="block text-xs text-orange-500 dark:text-orange-400 uppercase font-bold tracking-wider">Kalan</span>
                   <span className="font-bold text-orange-500 dark:text-orange-400">{selectedMonthData.remaining.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                 </div>
               </div>
               
               <div className="flex justify-center gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <span className="block text-[10px] text-purple-600 font-bold uppercase">Çek</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{selectedMonthData.checkTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-blue-600 font-bold uppercase">Senet</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{selectedMonthData.senetTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] text-orange-600 font-bold uppercase">Kredi Kartı</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{selectedMonthData.creditCardTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrevYear}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          
           <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700 shadow-sm">
            <span className="text-lg font-bold text-gray-800 dark:text-white w-20 text-center">{selectedYear}</span>
          </div>

          <button 
            onClick={handleNextYear}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        
        <button
          onClick={() => generateMonthlyProjectionPDF(data, selectedYear)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
        >
          <Download size={18} />
          <span>PDF İndir</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((row, index) => {
          const isCurrentMonth = format(row.date, 'yyyy-MM') === currentMonthKey;
          
          return (
            <div 
              key={index} 
              onClick={() => setSelectedMonthData(row)}
              className={`
                rounded-xl p-5 border transition-all duration-300 cursor-pointer group
                ${isCurrentMonth 
                  ? 'bg-white dark:bg-gray-900 border-green-500 ring-1 ring-green-500 shadow-lg dark:shadow-green-900/20' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
                }
              `}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white capitalize group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {format(row.date, 'MMMM', { locale: tr })}
                </h3>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-1 rounded-full">
                   {row.installments.length} İşlem
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Toplam</span>
                  <span className="text-gray-900 dark:text-white font-bold">
                    {row.total.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Ödenen</span>
                  <span className="text-green-600 dark:text-green-500 font-bold">
                    {row.paid.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Kalan</span>
                  <span className={`font-bold ${row.remaining > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400'}`}>
                    {row.remaining.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyProjection;
