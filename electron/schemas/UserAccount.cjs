const mongoose = require('mongoose');

// Transaction Schema - Individual payment installment
const TransactionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    installment: { type: String, required: true }, // "1/6" format
    installmentNumber: { type: Number, required: true },
    totalInstallments: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    isPaid: { type: Boolean, default: false },
    category: String,
    currency: { type: String, default: 'TRY' },
    originalAmount: Number,
    type: { type: String, default: 'credit_card' }, // credit_card, check, promissory_note, salary, insurance
    createdAt: { type: Date, default: Date.now },
    paidAt: Date
}, { _id: true });

// Bank Account Schema - Embedded in user document
const BankAccountSchema = new mongoose.Schema({
    bank: { type: String, required: true },
    statementDay: { type: Number, default: 1 }, // Kesim günü
    dueDay: { type: Number, default: 11 }, // Son ödeme günü
    accountNumber: String,
    iban: String,
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'TRY' },
    transactions: [TransactionSchema]
}, { _id: true });

// Daily Income Schema - Embedded in user document
const DailyIncomeSchema = new mongoose.Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    cash: { type: Number, default: 0 },
    cc: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    expenses: [{
        description: String,
        amount: Number,
        date: { type: Date, default: Date.now }
    }]
}, { _id: false });

// User Account Schema - Main document with all embedded data
const UserAccountSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Profile information
    profile: {
        name: String,
        phone: String,
        telegramChatId: String,
        pairingCode: String,
        pairingCodeExpiresAt: Date,
        pin: String,
        incomeExpensePassword: String
    },

    // Settings
    settings: {
        notificationDays: { type: Number, default: 3 },
        telegram: {
            botToken: { type: String, default: '8329470679:AAFgx7WOzZhe8wI46ytq1VfFPm2u91O-S_0' },
            chatId: String,
            notificationsEnabled: { type: Boolean, default: true }
        },
        backup: {
            enabled: { type: Boolean, default: false },
            time: { type: String, default: '00:00' }
        },
        lastTelegramNotification: String
    },

    // Bank accounts with embedded transactions
    accounts: [BankAccountSchema],

    // Daily income records
    dailyIncomes: [DailyIncomeSchema],

    // Additional financial data
    banks: [{
        name: String,
        accountNumber: String,
        iban: String,
        balance: Number,
        currency: String,
        type: String
    }],

    incomes: [{
        description: String,
        amount: Number,
        date: Date,
        category: String,
        currency: String
    }],

    expenses: [{
        description: String,
        amount: Number,
        date: Date,
        category: String,
        currency: String
    }],

    checks: [{
        checkNumber: String,
        amount: Number,
        issueDate: Date,
        dueDate: Date,
        status: String,
        recipient: String,
        bank: String,
        currency: String
    }],

    promissoryNotes: [{
        noteNumber: String,
        amount: Number,
        issueDate: Date,
        dueDate: Date,
        status: String,
        holder: String,
        issuer: String,
        currency: String
    }],

    creditCards: [{
        cardName: String,
        bank: String,
        lastFourDigits: String,
        limit: Number,
        currentBalance: Number,
        cutoffDay: Number,
        paymentDay: Number,
        currency: String
    }],

    annualPlans: [{
        year: Number,
        targetIncome: Number,
        targetExpense: Number,
        targetSavings: Number,
        categories: [{
            name: String,
            budget: Number,
            spent: Number
        }],
        currency: String
    }],

    // Subscription
    subscriptionType: { type: String, enum: ['free', 'monthly', 'yearly'], default: 'free' },
    subscriptionStatus: { type: String, enum: ['active', 'expired', 'canceled'], default: 'active' },
    subscriptionExpiry: { type: Date, default: null },
    aiAnalysisTokens: { type: Number, default: 1 },
    aiTokensResetAt: { type: Date, default: null },

    role: { type: String, default: 'user' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
UserAccountSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Indexes for performance
UserAccountSchema.index({ email: 1 });
UserAccountSchema.index({ 'profile.telegramChatId': 1 });
UserAccountSchema.index({ 'accounts.transactions.dueDate': 1 });

const UserAccount = mongoose.model('UserAccount', UserAccountSchema);

module.exports = { UserAccount, UserAccountSchema };
