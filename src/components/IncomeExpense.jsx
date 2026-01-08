import React, { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Lock, Unlock, Plus, X, Save, Eye, CreditCard, Banknote, FileText } from 'lucide-react';
import { usePayment } from '../context/PaymentContext';

const IncomeExpense = ({ payments }) => {
    const today = new Date();
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const { settings, dailyIncomes, updateDailyIncome, addDailyExpense, deleteDailyExpense, verifyIncomePassword, user } = usePayment();

    // Navigation State
    const [activeTab, setActiveTab] = useState('income'); // 'income' or 'expense'

    // Password Protection State - Check localStorage for persisted unlock state
    const [isLocked, setIsLocked] = useState(() => {
        const unlocked = localStorage.getItem('income_expense_unlocked');
        return unlocked !== 'true';
    });
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    // Detail Modal State
    const [selectedDayDetail, setSelectedDayDetail] = useState(null); // { date, expenses, payments, etc. }
    const [newExpense, setNewExpense] = useState({ description: '', amount: '' });

    const handleUnlock = async (e) => {
        e.preventDefault();
        setIsVerifying(true);
        setPasswordError(false);

        // Check against secure password if set
        if (user?.hasIncomePassword) {
            const result = await verifyIncomePassword(passwordInput);
            if (result.success) {
                setIsLocked(false);
                localStorage.setItem('income_expense_unlocked', 'true');
            } else {
                setPasswordError(true);
            }
        } else {
            // Legacy fallback
            if (passwordInput === '145300' || (settings?.appPassword && passwordInput === settings.appPassword)) {
                setIsLocked(false);
                setPasswordError(false);
                localStorage.setItem('income_expense_unlocked', 'true');
            } else {
                setPasswordError(true);
            }
        }
        setIsVerifying(false);
    };

    const handleForgotPassword = () => {
        alert('Şifrenizi öğrenmek veya sıfırlamak için lütfen Telegram botumuza gidin ve /gelirgidersifre komutunu kullanın.');
    };



    const handleAddExpense = (e) => {
        e.preventDefault();
        if (!newExpense.description || !newExpense.amount || !selectedDayDetail) return;

        const dateStr = format(selectedDayDetail.date, 'yyyy-MM-dd');
        addDailyExpense(dateStr, newExpense.description, newExpense.amount);

        // Update local state to reflect change immediately in modal
        const updatedExpenses = [
            ...(selectedDayDetail.expense.details || []),
            { description: newExpense.description, amount: parseFloat(newExpense.amount), date: new Date() }
        ];

        // Update the selectedDayDetail with new total and list
        // Note: This is a local optimisitic update for the modal. 
        // The main table updates via context/props change.
        setSelectedDayDetail(prev => ({
            ...prev,
            expense: {
                ...prev.expense,
                details: updatedExpenses,
                manualTotal: (prev.expense.manualTotal || 0) + parseFloat(newExpense.amount),
                total: (prev.expense.total || 0) + parseFloat(newExpense.amount)
            }
        }));

        setNewExpense({ description: '', amount: '' });
    };

    const handleDeleteExpense = (index) => {
        if (!selectedDayDetail) return;
        const dateStr = format(selectedDayDetail.date, 'yyyy-MM-dd');

        // Calculate amount to remove before deleting
        const amountToRemove = selectedDayDetail.expense.details[index].amount;

        deleteDailyExpense(dateStr, index);

        // Optimistic Update
        const updatedExpenses = selectedDayDetail.expense.details.filter((_, i) => i !== index);

        setSelectedDayDetail(prev => ({
            ...prev,
            expense: {
                ...prev.expense,
                details: updatedExpenses,
                manualTotal: Math.max(0, (prev.expense.manualTotal || 0) - amountToRemove),
                total: Math.max(0, (prev.expense.total || 0) - amountToRemove)
            }
        }));
    };

    const handlePrevMonth = () => {
        const current = new Date(selectedYear, selectedMonth, 1);
        const prev = subMonths(current, 1);
        setSelectedYear(prev.getFullYear());
        setSelectedMonth(prev.getMonth());
    };

    const handleNextMonth = () => {
        const current = new Date(selectedYear, selectedMonth, 1);
        const next = addMonths(current, 1);
        setSelectedYear(next.getFullYear());
        setSelectedMonth(next.getMonth());
    };

    if (isLocked) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                    <Lock size={32} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Erişim Korumalı</h2>
                <p className="text-gray-500 mb-6 text-center max-w-xs">
                    Gelir/Gider kayıtlarına erişmek için lütfen parolanızı giriniz.
                </p>
                <form onSubmit={handleUnlock} className="flex flex-col gap-4 w-full max-w-xs">
                    <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Parola"
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${passwordError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'
                            }`}
                        autoFocus
                    />
                    {passwordError && <span className="text-xs text-red-500 text-center">Hatalı parola!</span>}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Giriş Yap
                    </button>
                </form>

                {user?.hasIncomePassword && (
                    <div className="flex flex-col items-center gap-2 mt-4">
                        <button
                            onClick={handleForgotPassword}
                            disabled={isVerifying}
                            className="text-xs text-blue-500 hover:text-blue-700 underline disabled:opacity-50"
                        >
                            {isVerifying ? 'İşleniyor...' : 'Şifremi Unuttum (Master Key Al)'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Daily Rows Calculation
    const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const dailyRows = Array.from({ length: daysInSelectedMonth }, (_, idx) => {
        const d = new Date(selectedYear, selectedMonth, idx + 1);
        const dayKey = format(d, 'yyyy-MM-dd');

        // Expenses from Payments (Credit Cards, Installments)
        const dayInstallments = payments.flatMap(p =>
            p.installmentPlan.filter(inst => format(new Date(inst.date), 'yyyy-MM-dd') === dayKey)
                .map(inst => ({ ...inst, title: p.title, bank: p.bank, type: p.type }))
        );

        // Get manual expense data from dailyIncomes
        const dayData = dailyIncomes[dayKey] || {};

        // Auto Payments Calculation
        const autoPaymentsTotal = dayInstallments.reduce((s, i) => s + i.amount, 0);
        const paidTotal = dayInstallments.filter(i => i.isPaid).reduce((s, i) => s + i.amount, 0);
        const remainingTotal = dayInstallments.filter(i => !i.isPaid).reduce((s, i) => s + i.amount, 0);

        const senetTotal = dayInstallments.filter(x => x.type === 'promissory_note').reduce((s, i) => s + i.amount, 0);
        const checkTotal = dayInstallments.filter(x => x.type === 'check').reduce((s, i) => s + i.amount, 0);
        const cardTotal = dayInstallments.filter(x => x.type === 'credit_card').reduce((s, i) => s + i.amount, 0);

        // Manual Expenses Calculation
        // We rely on 'other' field as the total for manual expenses
        const manualExpenseTotal = (dayData.other || 0);

        // Total Expense
        const totalExpense = manualExpenseTotal + autoPaymentsTotal;

        // Income
        const totalIncome = (dayData.cash || 0) + (dayData.cc || 0);

        const net = totalIncome - totalExpense;

        return {
            date: d,
            dayKey,
            income: {
                cash: dayData.cash || 0,
                cc: dayData.cc || 0,
                total: totalIncome
            },
            expense: {
                manualTotal: manualExpenseTotal,
                autoTotal: autoPaymentsTotal,
                paidTotal,
                remainingTotal,
                senetTotal,
                checkTotal,
                cardTotal,
                total: totalExpense,
                details: dayData.expenses || [],
                autoDetails: dayInstallments
            },
            net
        };
    });

    const monthTotalIncome = dailyRows.reduce((s, r) => s + r.income.total, 0);
    const monthTotalExpense = dailyRows.reduce((s, r) => s + r.expense.total, 0);
    const monthBalance = monthTotalIncome - monthTotalExpense;

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveTab('income')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'income'
                                        ? 'bg-white text-green-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Gelir Sayfası
                            </button>
                            <button
                                onClick={() => setActiveTab('expense')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'expense'
                                        ? 'bg-white text-red-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Gider Sayfası
                            </button>
                        </div>
                        <button
                            onClick={() => setIsLocked(true)}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
                            title="Kilitle"
                        >
                            <Unlock size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                                title="Önceki Ay"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div className="flex items-center px-2 font-medium text-gray-700 min-w-[140px] justify-center">
                                {format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy', { locale: tr })}
                            </div>
                            <button
                                onClick={handleNextMonth}
                                className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-gray-600"
                                title="Sonraki Ay"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-1">
                            <span className="text-sm text-gray-600 pl-2">Yıl:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="px-2 py-1 text-sm border rounded bg-transparent focus:outline-none"
                            >
                                {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 5 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Month Summary Bar */}
                <div className="bg-gray-50 px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100">
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Toplam Gelir</p>
                        <p className="text-xl font-bold text-green-600 mt-1">{monthTotalIncome.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Toplam Gider</p>
                        <p className="text-xl font-bold text-red-600 mt-1">{monthTotalExpense.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Net Durum</p>
                        <div className={`flex items-center gap-2 mt-1 ${monthBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {monthBalance >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            <span className="text-xl font-bold">{monthBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 flex justify-between items-center border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        {activeTab === 'income' ? 'Gelir Kayıtları' : 'Gider Kayıtları'}
                        <span className="text-sm font-normal text-gray-500 ml-2">({format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy', { locale: tr })})</span>
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Tarih</th>
                                {activeTab === 'income' ? (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-gray-200 bg-blue-50/30 text-right">Nakit Gelir</th>
                                        <th className="px-6 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-gray-200 bg-blue-50/30 text-right">K.Kartı Gelir</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 text-right">Toplam</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-red-600 uppercase tracking-wider border-b border-gray-200 bg-red-50/10">Manuel Masraflar</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">Otomatik Ödemeler</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 text-right">Toplam</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-center">İşlem</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {dailyRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-3 text-sm text-gray-800 font-medium whitespace-nowrap">
                                        {format(row.date, 'dd MMM', { locale: tr })}
                                        <span className="text-xs text-gray-400 block">{format(row.date, 'EEEE', { locale: tr })}</span>
                                    </td>

                                    {activeTab === 'income' ? (
                                        <>
                                            <td className="px-6 py-3 text-right">
                                                <input
                                                    type="number"
                                                    className="w-full max-w-[120px] px-2 py-1 text-sm border border-transparent hover:border-blue-200 focus:border-blue-500 rounded bg-transparent text-right outline-none transition-all"
                                                    placeholder="0"
                                                    value={row.income.cash || ''}
                                                    onChange={(e) => updateDailyIncome(row.dayKey, 'cash', e.target.value)}
                                                    onWheel={(e) => e.target.blur()}
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <input
                                                    type="number"
                                                    className="w-full max-w-[120px] px-2 py-1 text-sm border border-transparent hover:border-blue-200 focus:border-blue-500 rounded bg-transparent text-right outline-none transition-all"
                                                    placeholder="0"
                                                    value={row.income.cc || ''}
                                                    onChange={(e) => updateDailyIncome(row.dayKey, 'cc', e.target.value)}
                                                    onWheel={(e) => e.target.blur()}
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-right font-bold text-green-600">
                                                {row.income.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-red-600">
                                                        {row.expense.manualTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                    </span>
                                                    {row.expense.details.length > 0 && (
                                                        <span className="text-xs text-gray-400">
                                                            {row.expense.details.length} kalem masraf
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-700">
                                                        {row.expense.autoTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                    </span>
                                                    {row.expense.autoDetails.length > 0 && (
                                                        <span className="text-xs text-gray-400">
                                                            {row.expense.autoDetails.length} otomatik ödeme
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-bold text-red-600">
                                                {row.expense.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button
                                                    onClick={() => setSelectedDayDetail(row)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Detayları Gör / Masraf Ekle"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 font-bold text-sm">
                                <td className="px-6 py-4">GENEL TOPLAM</td>
                                {activeTab === 'income' ? (
                                    <>
                                        <td className="px-6 py-4 text-right text-blue-800">
                                            {dailyRows.reduce((s, r) => s + (r.income.cash || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-blue-800">
                                            {dailyRows.reduce((s, r) => s + (r.income.cc || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-green-700 font-bold text-base">
                                            {monthTotalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 text-red-800">
                                            {dailyRows.reduce((s, r) => s + r.expense.manualTotal, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">
                                            {dailyRows.reduce((s, r) => s + r.expense.autoTotal, 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 text-right text-red-700 font-bold text-base">
                                            {monthTotalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </td>
                                        <td></td>
                                    </>
                                )}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Day Detail Modal */}
            {selectedDayDetail && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-xl text-gray-800">
                                    {format(selectedDayDetail.date, 'dd MMMM yyyy', { locale: tr })}
                                </h3>
                                <p className="text-sm text-gray-500">Günlük Masraf ve Ödeme Detayları</p>
                            </div>
                            <button onClick={() => setSelectedDayDetail(null)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-1 shadow-sm border">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column: Manual Expenses */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-red-600 flex items-center gap-2">
                                        <FileText size={20} />
                                        Manuel Masraflar
                                    </h4>
                                    <span className="text-sm font-bold bg-red-50 text-red-700 px-2 py-1 rounded">
                                        Toplam: {selectedDayDetail.expense.manualTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                    </span>
                                </div>

                                {/* Add Expense Form */}
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <h5 className="text-sm font-medium text-gray-700 mb-3">Yeni Masraf Ekle</h5>
                                    <form onSubmit={handleAddExpense} className="space-y-3">
                                        <div>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Açıklama (Örn: Taksi, Yemek...)"
                                                value={newExpense.description}
                                                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                step="0.01"
                                                placeholder="Tutar (TL)"
                                                value={newExpense.amount}
                                                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                                onWheel={(e) => e.target.blur()}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                                            />
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-1"
                                            >
                                                <Plus size={16} />
                                                Ekle
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* Expense List */}
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                    {selectedDayDetail.expense.details.length > 0 ? (
                                        selectedDayDetail.expense.details.map((exp, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow group">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{exp.description}</p>
                                                    <p className="text-xs text-gray-400">{format(new Date(exp.date), 'HH:mm')}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-700">
                                                        {exp.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteExpense(i)}
                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                        title="Sil"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center text-gray-400 py-4 text-sm">Henüz manuel masraf eklenmemiş.</p>
                                    )}
                                </div>
                            </div>

                            {/* Right Column: Auto Payments */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                                        <CreditCard size={20} />
                                        Otomatik Ödemeler
                                    </h4>
                                    <span className="text-sm font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                        Toplam: {selectedDayDetail.expense.autoTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                    </span>
                                </div>

                                {/* Paid vs Remaining Status */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex flex-col items-center justify-center text-center">
                                        <p className="text-xs text-green-600 font-medium uppercase mb-1">Ödenen</p>
                                        <p className="text-xl font-bold text-green-700">
                                            {selectedDayDetail.expense.paidTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </p>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex flex-col items-center justify-center text-center">
                                        <p className="text-xs text-red-600 font-medium uppercase mb-1">Kalan</p>
                                        <p className="text-xl font-bold text-red-700">
                                            {selectedDayDetail.expense.remainingTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                        </p>
                                    </div>
                                </div>

                                {/* Summary Cards */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <p className="text-xs text-blue-600 font-medium uppercase">Senet</p>
                                        <p className="text-lg font-bold text-blue-800">
                                            {selectedDayDetail.expense.senetTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                                        <p className="text-xs text-purple-600 font-medium uppercase">Çek</p>
                                        <p className="text-lg font-bold text-purple-800">
                                            {selectedDayDetail.expense.checkTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                        <p className="text-xs text-orange-600 font-medium uppercase">Kart</p>
                                        <p className="text-lg font-bold text-orange-800">
                                            {selectedDayDetail.expense.cardTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>

                                {/* Payment List */}
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                        Ödeme Listesi
                                    </div>
                                    <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
                                        {selectedDayDetail.expense.autoDetails.length > 0 ? (
                                            selectedDayDetail.expense.autoDetails.map((pay, i) => (
                                                <div key={i} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-800">{pay.title}</p>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                                            <span className="capitalize">{pay.type === 'promissory_note' ? 'Senet' : pay.type === 'credit_card' ? 'Kredi Kartı' : 'Çek'}</span>
                                                            <span>•</span>
                                                            <span>{pay.bank || 'Diğer'}</span>
                                                            <span>•</span>
                                                            <span>{pay.installmentNumber}. Taksit</span>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-gray-700">
                                                        {pay.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-gray-400 py-8 text-sm">Bu gün için otomatik ödeme bulunmuyor.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Totals */}
                        <div className="mt-auto bg-gray-50 p-6 border-t border-gray-200">
                            <div className="flex justify-between items-center max-w-4xl mx-auto">
                                <div>
                                    <p className="text-sm text-gray-500">Ödenen Tutar (Tahmini)</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {(selectedDayDetail.expense.paidTotal + selectedDayDetail.expense.manualTotal).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Günlük Toplam Gider</p>
                                    <p className="text-3xl font-bold text-red-600">
                                        {selectedDayDetail.expense.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncomeExpense;