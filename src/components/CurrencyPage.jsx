import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Calculator, ArrowRight } from 'lucide-react';

const CurrencyPage = () => {
    const [currencies, setCurrencies] = useState([]);
    const [gold, setGold] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Converter State
    const [amount, setAmount] = useState('');
    const [fromCurrency, setFromCurrency] = useState('USD');
    const [toCurrency, setToCurrency] = useState('TRY');
    const [result, setResult] = useState(null);
    const [allRates, setAllRates] = useState({});

    const fetchRates = async () => {
        setLoading(true);
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const fetchedRates = await ipcRenderer.invoke('currency:get-all-rates');

                if (fetchedRates.currencies) {
                    setCurrencies(fetchedRates.currencies);
                }
                if (fetchedRates.gold) {
                    setGold(fetchedRates.gold);
                }
                if (fetchedRates.rates) {
                    setAllRates(fetchedRates.rates);
                }
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch rates', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchRates, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleConvert = () => {
        if (!amount || isNaN(amount)) return;

        const rateFrom = allRates[fromCurrency] || 1;
        const rateTo = allRates[toCurrency] || 1;

        const finalResult = parseFloat(amount) * (rateFrom / rateTo);
        setResult(finalResult);
    };

    // Helper for Change Indicator
    const renderChange = (changeStr) => {
        if (!changeStr) return null;
        const change = parseFloat(changeStr.replace('%', '').replace(',', '.'));
        if (isNaN(change) || change === 0) return <span className="text-gray-400">%0.00</span>;
        if (change > 0) return <span className="text-green-400">%{Math.abs(change).toFixed(2)}</span>;
        return <span className="text-red-400">%{Math.abs(change).toFixed(2)}</span>;
    };

    // Format price with color
    const formatPrice = (value, type = 'normal') => {
        if (!value || value === 0 || value === '0') return '-';
        const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
        if (isNaN(num)) return '-';

        const formatted = num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

        if (type === 'buy') return <span className="text-white font-semibold">{formatted}</span>;
        if (type === 'sell') return <span className="text-white font-semibold">{formatted}</span>;
        if (type === 'gold-buy') return <span className="text-green-400 font-semibold">{formatted}</span>;
        if (type === 'gold-sell') return <span className="text-green-400 font-semibold">{formatted}</span>;
        return <span className="text-white">{formatted}</span>;
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">
                        Canlı Piyasa Verileri
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Son güncelleme: {lastUpdated ? lastUpdated.toLocaleTimeString('tr-TR') : '-'}
                    </p>
                </div>
                <button
                    onClick={fetchRates}
                    disabled={loading}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Main Grid - Two Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* DÖVİZ Table */}
                <div className="bg-[#1e2128] rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#2a2d35] text-slate-300">
                                <th className="text-left px-4 py-3 font-semibold text-sm uppercase tracking-wider">Döviz</th>
                                <th className="text-right px-4 py-3 font-semibold text-sm uppercase tracking-wider">Alış</th>
                                <th className="text-right px-4 py-3 font-semibold text-sm uppercase tracking-wider">Satış</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && currencies.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-slate-400">
                                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : currencies.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-slate-400">
                                        Veri bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                currencies.map((item, index) => (
                                    <tr
                                        key={item.code}
                                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${index % 2 === 0 ? 'bg-[#1e2128]' : 'bg-[#232730]'}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-amber-400 font-bold text-sm">{item.code}</span>
                                                <span className="text-slate-400 text-xs">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatPrice(item.buying, 'buy')}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatPrice(item.selling, 'sell')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ALTIN Table */}
                <div className="bg-[#1e2128] rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#2a2d35] text-slate-300">
                                <th className="text-left px-4 py-3 font-semibold text-sm uppercase tracking-wider">
                                    <span className="text-amber-400">●</span> Altın
                                </th>
                                <th className="text-right px-4 py-3 font-semibold text-sm uppercase tracking-wider">Alış</th>
                                <th className="text-right px-4 py-3 font-semibold text-sm uppercase tracking-wider">Satış</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && gold.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-slate-400">
                                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                                        Yükleniyor...
                                    </td>
                                </tr>
                            ) : gold.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="text-center py-8 text-slate-400">
                                        Veri bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                gold.map((item, index) => (
                                    <tr
                                        key={item.code}
                                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${index % 2 === 0 ? 'bg-[#1e2128]' : 'bg-[#232730]'}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-green-400 font-bold text-sm">{item.code}</span>
                                                <span className="text-slate-400 text-xs">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatPrice(item.buying, 'gold-buy')}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {formatPrice(item.selling, 'gold-sell')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Converter Panel */}
            <div className="bg-[#1e2128] p-6 rounded-xl shadow-2xl border border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-500/20 p-2 rounded-lg">
                        <Calculator className="text-blue-400" size={22} />
                    </div>
                    <h2 className="text-lg font-bold text-white">Döviz Çevirici</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Amount */}
                    <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-slate-400 mb-2">Miktar</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500 outline-none transition-all"
                        />
                    </div>

                    {/* From Currency */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-400 mb-2">Para Birimi</label>
                        <select
                            value={fromCurrency}
                            onChange={(e) => setFromCurrency(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white appearance-none outline-none cursor-pointer"
                        >
                            <option value="USD">USD (Amerikan Doları)</option>
                            <option value="EUR">EUR (Euro)</option>
                            <option value="GBP">GBP (İngiliz Sterlini)</option>
                            <option value="CHF">CHF (İsviçre Frangı)</option>
                            <option value="TRY">TRY (Türk Lirası)</option>
                        </select>
                    </div>

                    {/* Swap Arrow */}
                    <div className="md:col-span-1 flex justify-center pb-2">
                        <button
                            onClick={() => {
                                const temp = fromCurrency;
                                setFromCurrency(toCurrency);
                                setToCurrency(temp);
                            }}
                            className="bg-slate-700 hover:bg-slate-600 p-3 rounded-full text-slate-300 transition-colors"
                        >
                            <ArrowRight size={20} />
                        </button>
                    </div>

                    {/* To Currency */}
                    <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-400 mb-2">Hedef</label>
                        <select
                            value={toCurrency}
                            onChange={(e) => setToCurrency(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white appearance-none outline-none cursor-pointer"
                        >
                            <option value="TRY">TRY (Türk Lirası)</option>
                            <option value="USD">USD (Amerikan Doları)</option>
                            <option value="EUR">EUR (Euro)</option>
                            <option value="GBP">GBP (İngiliz Sterlini)</option>
                            <option value="CHF">CHF (İsviçre Frangı)</option>
                        </select>
                    </div>

                    {/* Calculate Button */}
                    <div className="md:col-span-1">
                        <button
                            onClick={handleConvert}
                            className="w-full h-[50px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center"
                        >
                            Hesapla
                        </button>
                    </div>
                </div>

                {/* Result Display */}
                {result !== null && (
                    <div className="mt-6 p-4 bg-slate-800/50 border border-slate-600 rounded-lg flex items-center justify-between">
                        <div>
                            <div className="text-slate-400 text-sm mb-1">Hesaplanan Tutar</div>
                            <div className="text-2xl font-bold text-white">
                                {result.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-blue-400">{toCurrency}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500">Güncel Kur</div>
                            <div className="text-slate-300 font-mono text-sm">
                                1 {fromCurrency} = {((allRates[fromCurrency] || 1) / (allRates[toCurrency] || 1)).toFixed(4)} {toCurrency}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 pt-2">
                Veriler <strong>GenelPara</strong> üzerinden canlı olarak sağlanmaktadır.
            </div>
        </div>
    );
};

export default CurrencyPage;
