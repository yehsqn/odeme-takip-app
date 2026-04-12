import React, { useState } from 'react';
import {
    Brain, TrendingDown, CreditCard, AlertTriangle,
    CheckCircle, Zap, Target, RefreshCw,
    DollarSign, BarChart2, Lock, Crown, ArrowLeft
} from 'lucide-react';
import { usePayment } from '../context/PaymentContext';
import { useTranslation } from 'react-i18next';
import { aiAnalyze, subscriptionConsumeAiToken } from '../api/client';
import UpgradeModal from './UpgradeModal';

// Risk color mapping
const riskColors = {
    low: { bar: 'bg-green-500', text: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10' },
    medium: { bar: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
    high: { bar: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
    critical: { bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10' },
};

const alertIcons = { warning: '⚠️', danger: '🚨', info: '💡', success: '✅' };
const alertColors = {
    warning: 'border-yellow-500/60 bg-yellow-500/15 text-yellow-900 dark:text-yellow-100',
    danger: 'border-red-500/60 bg-red-500/15 text-red-900 dark:text-red-100',
    info: 'border-blue-500/60 bg-blue-500/15 text-blue-900 dark:text-blue-100',
    success: 'border-green-500/60 bg-green-500/15 text-green-900 dark:text-green-100',
};

const assessmentColors = {
    normal: 'text-green-400',
    high: 'text-yellow-400',
    'very high': 'text-red-400',
};

// Animated Progress Bar
const ProgressBar = ({ value, colorClass }) => {
    const [animated, setAnimated] = React.useState(false);
    React.useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);
    return (
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
                className={`h-3 rounded-full transition-all duration-1000 ease-out ${colorClass}`}
                style={{ width: animated ? `${Math.min(value, 100)}%` : '0%' }}
            />
        </div>
    );
};

const AIFinanceCoach = ({ onBack }) => {
    const { user } = usePayment();
    const { i18n, t } = useTranslation();
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const runAnalysis = async (force = true) => {
        if (!user?.id) return;

        // Token check for free users
        if (!user?.isPremium) {
            try {
                const tokenResult = await subscriptionConsumeAiToken(user.id);
                if (!tokenResult.success) {
                    setShowUpgradeModal(true);
                    return;
                }
            } catch (e) {
                console.warn('Token check failed, allowing analysis:', e.message);
            }
        }

        setLoading(true);
        setError(null);
        try {
            const lang = i18n.language || 'tr';
            const result = await aiAnalyze(user.id, force, lang);
            if (result.success) {
                setAnalysis(result);
            } else {
                setError(result.error || 'Finansal analiz yapılamadı.');
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const riskStyle = analysis ? (riskColors[analysis.riskLevel] || riskColors['medium']) : null;

    return (
        <>
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/20">
                        <Brain size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">{t('aiCoachTitle', 'Yapay Zeka Finans Koçu')}</h1>
                        <p className="text-slate-400 text-sm">{t('aiCoachSubtitle', 'Harcamalarınızın ve ödemelerinizin akıllı analizi')}</p>
                    </div>
                </div>
                <button
                    onClick={runAnalysis}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <Zap size={18} />
                    )}
                    <span>{analysis ? t('refreshAnalysis', 'Analizi Yenile') : t('startAnalysis', 'Analizi Başlat')}</span>
                </button>
            </div>

            <div className="relative">
                {!user?.isPremium && !analysis && (
                    <div className="absolute inset-x-0 top-0 z-20 mt-12 flex flex-col items-center justify-center p-8 bg-slate-900/80 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl text-center min-h-[400px]">
                        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-full mb-6 shadow-lg shadow-purple-500/30">
                            <Brain size={32} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">{t('aiCoachPremiumOnly', "AI Coach")}</h2>
                        <p className="text-slate-400 max-w-md mb-4">
                            {t('aiCoachPremiumDesc', "Harcama alışkanlıklarınızın yapay zeka tarafından analiz edilmesi, risk tespiti ve kişiselleştirilmiş finansal tavsiyeler.")}
                        </p>
                        <p className="text-sm text-indigo-300 mb-8 flex items-center gap-1">
                            <Zap size={14} />
                            {t('upgrade.aiRemaining', 'Kalan AI analiz hakkı: {{count}}', { count: user?.aiAnalysisTokens ?? 1 })}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button 
                                onClick={runAnalysis} 
                                disabled={loading}
                                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-xl hover:from-purple-500 hover:to-indigo-500 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60"
                            >
                                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                                {t('startAnalysis', 'Analizi Başlat')}
                            </button>
                            <button 
                                onClick={() => setShowUpgradeModal(true)} 
                                className="px-8 py-3 bg-white text-indigo-900 rounded-xl font-bold shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Crown size={18} className="text-indigo-600" />
                                {t('upgradeNow', "Premium'a Yükselt")}
                            </button>
                        </div>
                    </div>
                )}
                
                <div className={`${!user?.isPremium && !analysis ? 'opacity-20 blur-sm grayscale pointer-events-none select-none overflow-hidden h-[500px]' : ''}`}>
                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 flex items-start gap-3 mb-6">
                            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold">{t('analysisFailed', 'Analiz Başarısız')}</div>
                                <div className="text-sm mt-1 text-red-400">{error}</div>
                                {error && error.includes('GEMINI_API_KEY') && (
                                    <div className="text-xs mt-2 text-slate-400">
                                        {t('apiKeyHint', 'Lütfen geçerli bir Gemini API anahtarı girildiğinden emin olun.')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!analysis && !loading && !error && (
                        <div className="bg-[#1e2128] border border-slate-700 rounded-2xl p-12 text-center">
                            <Brain size={48} className="text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-slate-300 mb-2">{t('analysisReady', 'Analize Hazır')}</h3>
                            <p className="text-slate-500 max-w-md mx-auto mb-6">
                                {t('analysisDesc', 'Finansal durumunuzu analiz etmek için butona tıklayın.')}
                            </p>
                            <button
                                onClick={runAnalysis}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <Zap size={18} /> {t('startAnalysis', 'Analizi Başlat')}
                            </button>
                        </div>
                    )}

                    {/* Loading Skeleton */}
                    {loading && (
                        <div className="space-y-4 animate-pulse">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="bg-slate-800 rounded-2xl h-32" />
                            ))}
                        </div>
                    )}

                    {/* Analysis Results */}
                    {analysis && !loading && (
                        <div className="space-y-5">
                            {/* Summary banner */}
                            {analysis.summary && (
                                <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl p-5">
                                    <p className="text-slate-200 leading-relaxed">{analysis.summary}</p>
                                </div>
                            )}

                            {/* Risk Score */}
                            <div className={`bg-[#1e2128] border rounded-2xl p-6 ${riskStyle.border}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Target size={20} className={riskStyle.text} />
                                        <h2 className="text-lg font-bold text-white">{t('riskScore', 'Risk Puanı')}</h2>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wide ${riskStyle.bg} ${riskStyle.text} border ${riskStyle.border}`}>
                                        {analysis.riskLevel}
                                    </div>
                                </div>
                                <div className="flex items-end gap-4 mb-3">
                                    <span className={`text-5xl font-black ${riskStyle.text}`}>{analysis.riskScore}</span>
                                    <span className="text-slate-500 text-lg pb-1">/ 100</span>
                                </div>
                                <ProgressBar value={analysis.riskScore} colorClass={riskStyle.bar} />
                                {analysis.riskReason && (
                                    <p className="text-slate-400 text-sm mt-3">{analysis.riskReason}</p>
                                )}
                            </div>

                            {/* 2-col grid: Card Strategy + Monthly Projections */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* Card Strategy */}
                                {analysis.cardStrategy && (
                                    <div className="bg-[#1e2128] border border-slate-700 rounded-2xl p-6">
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                                            <CreditCard size={20} className="text-blue-400" /> {t('cardStrategy', 'Kart Kullanım Stratejisi')}
                                        </h2>
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-3">
                                            <div className="text-blue-300 font-semibold text-sm uppercase tracking-wide mb-1">{t('recommendation', 'Öneri')}</div>
                                            <p className="text-white">{analysis.cardStrategy.recommendation}</p>
                                        </div>
                                        {analysis.cardStrategy.bank && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400 text-sm">{t('suggestedBank', 'Önerilen Banka')}</span>
                                                <span className="text-white font-semibold">{analysis.cardStrategy.bank}</span>
                                            </div>
                                        )}
                                        {analysis.cardStrategy.savingDays > 0 && (
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-slate-400 text-sm">{t('savedDays', 'Kazanılan Süre')}</span>
                                                <span className="text-green-400 font-semibold">{analysis.cardStrategy.savingDays} {t('days', 'gün')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Monthly Projections */}
                                {analysis.monthlyProjections && analysis.monthlyProjections.length > 0 && (
                                    <div className="bg-[#1e2128] border border-slate-700 rounded-2xl p-6">
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                                            <BarChart2 size={20} className="text-purple-400" /> {t('monthlyProjection', 'Aylık Tahminler')}
                                        </h2>
                                        <div className="space-y-3">
                                            {analysis.monthlyProjections.map((proj, i) => {
                                                const maxDebt = Math.max(...analysis.monthlyProjections.map(p => p.totalDebt), 1);
                                                const pct = (proj.totalDebt / maxDebt) * 100;
                                                return (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <span className="text-slate-400 text-xs w-16 shrink-0">{proj.month}</span>
                                                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full ${proj.riskFlag ? 'bg-red-500' : 'bg-purple-500'}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-xs w-20 text-right font-mono ${proj.riskFlag ? 'text-red-400' : 'text-white'}`}>
                                                            {proj.totalDebt.toLocaleString('tr-TR')} ₺
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Category Analysis */}
                            {analysis.categoryInsights && analysis.categoryInsights.length > 0 && (
                                <div className="bg-[#1e2128] border border-slate-700 rounded-2xl p-6">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                                        <DollarSign size={20} className="text-green-400" /> {t('categoryAnalysis', 'Kategori Analizi')}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {analysis.categoryInsights.map((cat, i) => (
                                            <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-semibold text-white">{cat.category}</span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700 ${assessmentColors[cat.assessment] || 'text-slate-300'}`}>
                                                        {cat.assessment}
                                                    </span>
                                                </div>
                                                <div className="text-slate-300 text-sm">{cat.totalSpent && cat.totalSpent.toLocaleString('tr-TR')} ₺</div>
                                                {cat.tip && <div className="text-slate-500 text-xs mt-2 italic">{cat.tip}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Alerts */}
                            {analysis.alerts && analysis.alerts.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <AlertTriangle size={20} className="text-yellow-400" /> {t('warnings', 'Uyarılar')}
                                    </h2>
                                    <div className="grid grid-cols-1 gap-3">
                                        {analysis.alerts.map((alert, i) => (
                                            <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${alertColors[alert.type] || alertColors.info}`}>
                                                <span className="text-xl shrink-0">{alertIcons[alert.type] || '💡'}</span>
                                                <span className="text-sm font-medium leading-relaxed">{alert.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Savings Tips */}
                            {analysis.savingsTips && analysis.savingsTips.length > 0 && (
                                <div className="bg-[#1e2128] border border-slate-700 rounded-2xl p-6">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                                        <TrendingDown size={20} className="text-emerald-400" /> {t('savingsTips', 'Tasarruf Önerileri')}
                                    </h2>
                                    <div className="space-y-2">
                                        {analysis.savingsTips.map((tip, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                                <CheckCircle size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                                                <span className="text-slate-300 text-sm">{tip}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Upgrade Modal */}
        <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            featureName={t('upgrade.premAI')}
        />
        </>
    );
};

export default AIFinanceCoach;
