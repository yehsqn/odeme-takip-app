/**
 * AI Financial Analysis Module (Gemini API)
 * Analyzes user payment data and returns structured financial advice
 */

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

// --- CACHE: store last result per user for 10 minutes ---
const analysisCache = new Map(); // userId -> { result, expiresAt }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Calculate financial summary from raw payment data
 */
/**
 * Calculate financial summary from raw payment data
 */
function buildFinancialContext(payments, dailyIncomes, settings) {
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // --- Monthly payment totals ---
    const monthlyTotals = {};
    const bankTotals = {};
    const categoryTotals = {};

    for (const payment of payments) {
        const installments = payment.installmentPlan || [];
        for (const inst of installments) {
            if (!inst.date && !inst.dueDate) continue;
            const due = new Date(inst.date || inst.dueDate);
            const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
            monthlyTotals[key] = (monthlyTotals[key] || 0) + (inst.amount || 0);
            bankTotals[payment.bank || payment.title || 'Diğer'] =
                (bankTotals[payment.bank || payment.title || 'Diğer'] || 0) + (inst.amount || 0);
            const cat = payment.category || 'Diğer';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (inst.amount || 0);
        }
    }

    // --- Future 6-month projection ---
    const projections = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(now);
        d.setMonth(d.getMonth() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        projections.push({
            month: key,
            totalDebt: Math.round(monthlyTotals[key] || 0)
        });
    }

    // --- Monthly income average (from dailyIncomes) ---
    const incomeMap = {};
    for (const [date, data] of Object.entries(dailyIncomes || {})) {
        const d = new Date(date);
        if (isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const total = (data.cash || 0) + (data.cc || 0) + (data.salary || 0) +
            (data.insurance || 0) + (data.other || 0);
        incomeMap[key] = (incomeMap[key] || 0) + total;
    }

    const monthlyIncomes = Object.values(incomeMap);
    const avgMonthlyIncome = monthlyIncomes.length
        ? Math.round(monthlyIncomes.reduce((a, b) => a + b, 0) / monthlyIncomes.length)
        : 0;

    // --- Total remaining (unpaid) debt across all payments ---
    let totalRemainingDebt = 0;
    for (const payment of payments) {
        for (const inst of (payment.installmentPlan || [])) {
            if (!inst.isPaid) totalRemainingDebt += inst.amount || 0;
        }
    }
    totalRemainingDebt = Math.round(totalRemainingDebt);

    // --- Bank due dates (from settings) ---
    const banks = settings?.banks || [];

    return {
        totalActivePayments: payments.length,
        totalMonthlyDebt: projections[0]?.totalDebt || 0,   // This month's due
        totalRemainingDebt,                                   // All unpaid instalments
        avgMonthlyIncome,
        projections,
        bankBreakdown: Object.entries(bankTotals)
            .map(([bank, total]) => ({ bank, totalDebt: Math.round(total) }))
            .sort((a, b) => b.totalDebt - a.totalDebt)
            .slice(0, 5),
        categoryBreakdown: Object.entries(categoryTotals)
            .map(([category, total]) => ({ category, totalSpent: Math.round(total) }))
            .sort((a, b) => b.totalSpent - a.totalSpent),
        banks: banks.map(b => ({
            name: b.bankName || b.name,
            statementDay: b.statementDay,
            dueDay: b.dueDay
        }))
    };
}

/**
 * Build structured Gemini prompt
 */
function buildPrompt(context, rates, language = 'tr') {
    const isEn = language === 'en';
    
    const rateInfo = rates
        ? (isEn 
            ? `\n## Current Exchange Rates:\n- USD/TRY: ${rates.USD || '?'} TL\n- EUR/TRY: ${rates.EUR || '?'} TL\n(Use these rates in debt analysis. Convert debts in USD/EUR to TL and comment.)\n`
            : `\n## Güncel Döviz Kurları:\n- USD/TRY: ${rates.USD || '?'} TL\n- EUR/TRY: ${rates.EUR || '?'} TL\n(Bu kurları borç analizinde kullan. Dolar/Euro cinsinden borçları TL'ye çevirip yorum yap.)\n`)
        : '';

    const role = isEn ? "personal finance coach" : "Türk kişisel finans koçusu";
    const instruction = isEn 
        ? "Analyze the user's financial data and respond ONLY in the following JSON format. Your response MUST be in English."
        : "Kullanıcının finansal verilerini analiz edip SADECE aşağıdaki JSON formatında yanıt ver. Yanıtın mutlaka Türkçe olmalıdır.";

    const tasks = isEn
        ? `1. Risk analysis: Is the monthly debt/income ratio dangerous?\n2. Bank strategy: Which card is advantageous considering the statement dates?\n3. Category analysis: In which category is there excessive spending?\n4. Savings recommendations\n${rates ? '5. Currency effect: How do USD/EUR rates affect the debt?' : ''}`
        : `1. Risk analizi: Aylık borç/gelir oranı tehlikeli mi?\n2. Banka stratejisi: Kesim tarihleri göz önüne alındığında hangi kart avantajlı?\n3. Kategori analizi: Hangi kategoride fazla harcama var?\n4. Tasarruf tavsiyeleri\n${rates ? '5. Döviz etkisi: USD/EUR kurları borcunu nasıl etkiliyor?' : ''}`;

    const formatLabels = {
        riskReason: isEn ? "1-2 sentences explaining risk level" : "Risk seviyesini açıklayan 1-2 cümle",
        recommendation: isEn ? "Which bank to use and why (1-2 sentences)" : "Hangi bankayı kullanmalı ve neden (1-2 cümle)",
        bank: isEn ? "Bank name" : "Banka adı",
        savingDays: isEn ? "number of days" : "gün sayısı",
        category: isEn ? "Category name" : "Kategori adı",
        tip: isEn ? "Savings suggestion for this category" : "Bu kategoride tasarruf önerisi",
        savingsTips: isEn ? ["Savings tip 1", "Savings tip 2", "Savings tip 3"] : ["Tasarruf ipucu 1", "Tasarruf ipucu 2", "Tasarruf ipucu 3"],
        summary: isEn ? "Personalized general assessment for the user (2-3 sentences)" : "Kullanıcıya özel 2-3 cümlelik genel değerlendirme"
    };

    return `You are a ${role}. ${instruction}

## User Financial Data:
${JSON.stringify(context, null, 2)}
${rateInfo}
## TASKS:
${tasks}

## RESPONSE FORMAT (only JSON, write nothing else):
{
  "riskScore": 0-100 (100 = very risky),
  "riskLevel": "low" | "medium" | "high" | "critical" (or localized equivalent),
  "riskReason": "${formatLabels.riskReason}",
  "monthlyProjections": [
    { "month": "2026-02", "totalDebt": 5000, "riskFlag": false }
  ],
  "alerts": [
    {
      "type": "warning" | "danger" | "info" | "success",
      "title": "${isEn ? "Alert title" : "Uyarı başlığı"}",
      "message": "${isEn ? "Detailed message" : "Detaylı mesaj"}",
      "icon": "💳" | "📈" | "⚠️" | "💰" | "🎯"
    }
  ],
  "cardStrategy": {
    "recommendation": "${formatLabels.recommendation}",
    "bank": "${formatLabels.bank}",
    "savingDays": ${formatLabels.savingDays}
  },
  "categoryInsights": [
    {
      "category": "${formatLabels.category}",
      "totalSpent": 5000,
      "assessment": "normal" | "high" | "very high",
      "tip": "${formatLabels.tip}"
    }
  ],
  "savingsTips": ${JSON.stringify(formatLabels.savingsTips)},
  "summary": "${formatLabels.summary}"
}`;
}

/**
 * Main analysis function — with per-user cache (10 min) and one 429 retry
 */
async function analyzeFinances(payments, dailyIncomes, settings, userId, force = false, rates = null, language = 'tr') {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY tanımlanmamış. .env dosyasına ekleyin: GEMINI_API_KEY=AIza...');
    }

    const cacheKey = `${userId}_${language}`;

    // Clear cache if forced refresh
    if (force && userId) {
        analysisCache.delete(cacheKey);
        console.log(`[AI] Cache cleared for user ${userId} and language ${language} (force refresh)`);
    }

    // Return cached result if still valid
    if (userId) {
        const cached = analysisCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            console.log(`[AI] Returning cached analysis for user ${userId} [${language}] (expires in ${Math.round((cached.expiresAt - Date.now()) / 1000)}s)`);
            return cached.result;
        }
    }

    const context = buildFinancialContext(payments, dailyIncomes, settings);
    const prompt = buildPrompt(context, rates, language);

    const callGemini = () => axios.post(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json'
            }
        },
        { timeout: 30000 }
    );

    let response;
    try {
        response = await callGemini();
    } catch (err) {
        if (err?.response?.status === 429) {
            console.warn('[AI] 429 rate limit — using local analysis fallback');
            return buildLocalAnalysis(context, userId, language);
        }
        console.warn('[AI] Gemini error — using local analysis fallback:', err.message);
        return buildLocalAnalysis(context, userId, language);
    }

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
        console.warn('[AI] Empty Gemini response — using local fallback');
        return buildLocalAnalysis(context, userId, language);
    }

    try {
        const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const result = JSON.parse(cleaned);
        const finalResult = { ...result, context, source: 'gemini' };
        if (userId) {
            analysisCache.set(cacheKey, { result: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
            console.log(`[AI] Gemini analysis cached for user ${userId} [${language}] (10 min)`);
        }
        return finalResult;
    } catch (parseErr) {
        console.warn('[AI] JSON parse error — using local fallback:', parseErr.message);
        return buildLocalAnalysis(context, userId, language);
    }
}

/**
 * Local analysis — runs without any API call
 */
function buildLocalAnalysis(context, userId, language = 'tr') {
    const isEn = language === 'en';
    const { totalMonthlyDebt, totalRemainingDebt, avgMonthlyIncome, projections, bankBreakdown, categoryBreakdown, banks } = context;

    // Use monthly debt for ratio (monthly cashflow pressure), fallback to remaining/12
    const monthlyDebt = totalMonthlyDebt > 0 ? totalMonthlyDebt : Math.round((totalRemainingDebt || 0) / 12);
    const ratio = avgMonthlyIncome > 0 ? monthlyDebt / avgMonthlyIncome : (monthlyDebt > 0 ? 0.6 : 0);
    let riskScore, riskLevel, riskReason;

    if (ratio < 0.3) {
        riskScore = Math.round(ratio * 100);
        riskLevel = isEn ? 'low' : 'düşük';
        riskReason = isEn ? 'Your monthly debt/income ratio is low, your financial situation looks healthy.' : 'Aylık borç/gelir oranınız düşük, finansal durumunuz sağlıklı görünüyor.';
    } else if (ratio < 0.5) {
        riskScore = Math.round(30 + ratio * 40);
        riskLevel = isEn ? 'medium' : 'orta';
        riskReason = isEn ? 'Your monthly debt/income ratio is at a reasonable level, but caution should be exercised.' : 'Aylık borç/gelir oranınız makul seviyede, ancak dikkatli olunmalı.';
    } else if (ratio < 0.8) {
        riskScore = Math.round(50 + ratio * 30);
        riskLevel = isEn ? 'high' : 'yüksek';
        riskReason = isEn ? 'Your monthly debts exceed 50% of your income. Avoid new expenditures.' : 'Aylık borçlarınız gelirinizin %50\'sini aşıyor. Yeni harcamalardan kaçının.';
    } else {
        riskScore = Math.min(95, Math.round(75 + ratio * 15));
        riskLevel = isEn ? 'critical' : 'kritik';
        riskReason = isEn ? 'Your monthly debt load constitutes a large part of your income. Urgent action should be taken.' : 'Aylık borç yükünüz gelirinizin büyük bölümünü oluşturuyor. Acil önlem alınmalı.';
    }

    const alerts = [];
    if (ratio > 0.5) alerts.push({ 
        type: 'danger', 
        title: isEn ? 'High Debt Ratio' : 'Yüksek Borç Oranı', 
        message: isEn ? `Your monthly debt constitutes ${Math.round(ratio * 100)}% of your income.` : `Aylık borcunuz gelirinizin %${Math.round(ratio * 100)}'ini oluşturuyor.`, 
        icon: '⚠️' 
    });
    if (projections.some(p => p.totalDebt > totalMonthlyDebt * 1.2)) alerts.push({ 
        type: 'warning', 
        title: isEn ? 'High Installment Month' : 'Yüksek Taksit Ayı', 
        message: isEn ? 'You have months with higher than normal payments in the coming months.' : 'Önümüzdeki aylarda normalden yüksek ödeme aylarınız var.', 
        icon: '📈' 
    });
    if (bankBreakdown.length > 2) alerts.push({ 
        type: 'info', 
        title: isEn ? 'Multiple Banks' : 'Çok Banka', 
        message: isEn ? `You are paying ${bankBreakdown.length} different banks. You can consider consolidation to make tracking easier.` : `${bankBreakdown.length} farklı bankaya ödeme yapıyorsunuz. Takibi kolaylaştırmak için konsolidasyon düşünebilirsiniz.`, 
        icon: '💳' 
    });
    
    if (alerts.length === 0) alerts.push({ 
        type: 'success', 
        title: isEn ? 'General Status Good' : 'Genel Durum İyi', 
        message: isEn ? 'Your financial outlook generally looks healthy.' : 'Finansal tablonuz genel olarak sağlıklı görünüyor.', 
        icon: '✅' 
    });

    // Best card strategy
    let cardStrategy = { 
        recommendation: isEn ? 'Use the card with the statement date closest to the due date for all your payments.' : 'Tüm ödemeleriniz için son ödeme tarihine en yakın kesim tarihli kartı öncelikli kullanın.', 
        bank: bankBreakdown[0]?.bank || '-', 
        savingDays: 20 
    };
    if (banks && banks.length > 0) {
        const sorted = [...banks].sort((a, b) => (b.dueDay || 0) - (a.dueDay || 0));
        const best = sorted[0];
        if (best) {
            const saving = best.dueDay ? best.dueDay - (best.statementDay || 1) : 20;
            cardStrategy = {
                recommendation: isEn ? `${best.name || 'The most advantageous card'} with the latest statement date — extends your payment period.` : `${best.name || 'En avantajlı kart'} kesim tarihi en geç olan kart — ödeme sürenizi uzatır.`,
                bank: best.name || '-',
                savingDays: Math.max(saving, 1)
            };
        }
    }

    const categoryInsights = (categoryBreakdown || []).slice(0, 5).map(c => {
        const monthlyAvg = c.totalSpent / Math.max(projections.length, 1);
        const assessment = monthlyAvg > avgMonthlyIncome * 0.3 ? (isEn ? 'very high' : 'çok yüksek') : monthlyAvg > avgMonthlyIncome * 0.15 ? (isEn ? 'high' : 'yüksek') : 'normal';
        return { 
            category: c.category, 
            totalSpent: c.totalSpent, 
            assessment, 
            tip: assessment !== 'normal' 
                ? (isEn ? `Your ${c.category} spending is high, research alternatives.` : `${c.category} harcamalarınız yüksek, alternatifler araştırın.`) 
                : (isEn ? `Your ${c.category} spending is at a reasonable level.` : `${c.category} harcamalarınız makul seviyede.`) 
        };
    });

    const savingsTips = isEn ? [
        'Closing high-interest debts first reduces your total payment load.',
        'Save at least 10% of your income each month as an emergency fund.',
        bankBreakdown.length > 1 ? `Consider making extra payments for "${bankBreakdown[0]?.bank}", where you are most indebted.` : 'Try to make lump sum payments instead of increasing the number of installments if possible.'
    ] : [
        'Yüksek faizli borçları önce kapatmak toplam ödeme yükünüzü azaltır.',
        'Her ay gelirinizin en az %10\'unu acil durum fonu olarak ayırın.',
        bankBreakdown.length > 1 ? `En yüksek borçlu olduğunuz "${bankBreakdown[0]?.bank}" için ekstra ödeme yapmayı düşünün.` : 'Taksit sayısını artırmak yerine mümkünse toplu ödeme yapın.'
    ];

    const result = {
        riskScore,
        riskLevel,
        riskReason,
        monthlyProjections: (projections || []).map(p => ({
            month: p.month,
            totalDebt: p.totalDebt,
            riskFlag: p.totalDebt > (monthlyDebt || 1) * 1.1
        })),
        alerts,
        cardStrategy,
        categoryInsights,
        savingsTips,
        summary: totalRemainingDebt > 0
            ? (isEn 
                ? `Your total remaining debt is ${totalRemainingDebt.toLocaleString('en-US')} TL, with ${monthlyDebt.toLocaleString('en-US')} TL due this month. ${riskReason}`
                : `Toplam kalan borcunuz ${totalRemainingDebt.toLocaleString('tr-TR')} TL, bu ay vadesi gelen ${monthlyDebt.toLocaleString('tr-TR')} TL. ${riskReason}`)
            : (isEn 
                ? `Debt could not be calculated as no payment record was found. Add payment and analyze again.` 
                : `Ödeme kaydınız bulunmadığı için borç hesaplanamadı. Ödeme ekleyip tekrar analiz edin.`),
        context,
        source: 'local'
    };

    if (userId) {
        analysisCache.set(`${userId}_${language}`, { result, expiresAt: Date.now() + CACHE_TTL_MS });
        console.log(`[AI] Local analysis cached for user ${userId} [${language}]`);
    }

    return result;
}

module.exports = { analyzeFinances, buildFinancialContext };
