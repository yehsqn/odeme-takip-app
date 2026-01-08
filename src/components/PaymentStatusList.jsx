import React from 'react';
import { format, isBefore, isSameDay, startOfDay, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertCircle, Calendar, CheckCircle, Clock } from 'lucide-react';
import { usePayment } from '../context/PaymentContext';

const formatDate = (dateString) => {
  return format(new Date(dateString), 'd MMMM yyyy, EEEE', { locale: tr });
};

const StatusCard = ({ title, items, type, icon: Icon, onUpdateStatus }) => (
  <div className={`bg-white rounded-xl shadow-sm border ${type === 'overdue' ? 'border-red-200' : 'border-blue-200'} flex-1`}>
    <div className={`px-4 py-3 border-b ${type === 'overdue' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'} rounded-t-xl flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <Icon size={20} />
        <h3 className="font-bold">{title}</h3>
      </div>
      <span className="text-sm font-semibold bg-white px-2 py-0.5 rounded-full border opacity-75">
        {items.length} Adet
      </span>
    </div>
    
    <div className="max-h-[300px] overflow-y-auto p-2">
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          Kayıt bulunamadı.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">{item.paymentTitle}</h4>
                  <p className="text-xs text-gray-500">
                    {item.bank} • {item.installmentNumber}/{item.totalInstallments}. Taksit
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900 block">
                    {item.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <div className={`text-xs font-medium flex items-center gap-1 ${type === 'overdue' ? 'text-red-600' : 'text-blue-600'}`}>
                  <Calendar size={12} />
                  {formatDate(item.date)}
                </div>
                <button
                  onClick={() => onUpdateStatus(item.paymentId, item.id, true)}
                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 flex items-center gap-1 transition-colors"
                >
                  <CheckCircle size={12} />
                  Ödendi
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const PaymentStatusList = () => {
  const { payments, updateInstallmentStatus } = usePayment();
  const today = startOfDay(new Date());

  // Flatten all unpaid installments
  const allInstallments = payments.flatMap(payment => 
    payment.installmentPlan
      .filter(inst => !inst.isPaid)
      .map(inst => ({
        ...inst,
        paymentTitle: payment.title,
        paymentId: payment.id,
        bank: payment.bank,
        type: payment.type,
        totalInstallments: payment.installments
      }))
  );

  // Separate overdue and upcoming
  const overdue = allInstallments
    .filter(inst => isBefore(startOfDay(new Date(inst.date)), today))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const upcoming = allInstallments
    .filter(inst => !isBefore(startOfDay(new Date(inst.date)), today))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <StatusCard 
        title="Geciken Ödemeler" 
        items={overdue} 
        type="overdue" 
        icon={AlertCircle}
        onUpdateStatus={updateInstallmentStatus}
      />
      <StatusCard 
        title="Yaklaşan Ödemeler" 
        items={upcoming} 
        type="upcoming" 
        icon={Clock}
        onUpdateStatus={updateInstallmentStatus}
      />
    </div>
  );
};

export default PaymentStatusList;
