/**
 * Migration Script: Flat Collections to Embedded Documents
 * 
 * This script migrates data from the old flat collection structure
 * (separate Payment, Bank, Settings collections) to the new embedded
 * UserAccount structure where all data is nested within the user document.
 * 
 * SAFETY FEATURES:
 * - Creates backup JSON file before migration
 * - Does NOT delete old collections (manual cleanup after verification)
 * - Provides detailed logging and progress tracking
 * - Can be run in test mode first
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB Connection
const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

// Old Schema Definitions (for reading existing data)
const OldUserSchema = new mongoose.Schema({
    email: String,
    password: String,
    telegramChatId: String,
    pairingCode: String,
    pairingCodeExpiresAt: Date,
    pin: String,
    incomeExpensePassword: String,
    createdAt: Date,
    role: String
});

const OldPaymentSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    id: String,
    title: String,
    amount: Number,
    installments: Number,
    date: String,
    category: String,
    bank: String,
    type: String,
    installmentPlan: Array,
    currency: String,
    originalAmount: Number,
    createdAt: String
}, { collection: 'payments' });

const OldSettingsSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    cutOffDay: Number,
    telegram: Object,
    banks: Array,
    notificationDays: Number,
    lastTelegramNotification: String,
    backup: Object
});

const OldDailyIncomeSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    date: String,
    cash: Number,
    cc: Number,
    salary: Number,
    insurance: Number,
    other: Number,
    expenses: Array
});

const OldBankSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    name: String,
    accountNumber: String,
    iban: String,
    balance: Number,
    currency: String,
    type: String,
    createdAt: Date
});

const OldIncomeSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    description: String,
    amount: Number,
    date: Date,
    category: String,
    currency: String,
    createdAt: Date
});

const OldExpenseSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    description: String,
    amount: Number,
    date: Date,
    category: String,
    currency: String,
    createdAt: Date
});

const OldCheckSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    checkNumber: String,
    amount: Number,
    issueDate: Date,
    dueDate: Date,
    status: String,
    recipient: String,
    bank: String,
    currency: String,
    createdAt: Date
});

const OldPromissoryNoteSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    noteNumber: String,
    amount: Number,
    issueDate: Date,
    dueDate: Date,
    status: String,
    holder: String,
    issuer: String,
    currency: String,
    createdAt: Date
});

const OldCreditCardSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    cardName: String,
    bank: String,
    lastFourDigits: String,
    limit: Number,
    currentBalance: Number,
    cutoffDay: Number,
    paymentDay: Number,
    currency: String,
    createdAt: Date
});

const OldAnnualPlanSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.Mixed,
    year: Number,
    targetIncome: Number,
    targetExpense: Number,
    targetSavings: Number,
    categories: Array,
    currency: String,
    createdAt: Date
});

// Models for old collections
const OldUser = mongoose.model('OldUser', OldUserSchema, 'users');
const OldPayment = mongoose.model('OldPayment', OldPaymentSchema, 'payments');
const OldSettings = mongoose.model('OldSettings', OldSettingsSchema, 'settings');
const OldDailyIncome = mongoose.model('OldDailyIncome', OldDailyIncomeSchema, 'dailyincomes');
const OldBank = mongoose.model('OldBank', OldBankSchema, 'banks');
const OldIncome = mongoose.model('OldIncome', OldIncomeSchema, 'incomes');
const OldExpense = mongoose.model('OldExpense', OldExpenseSchema, 'expenses');
const OldCheck = mongoose.model('OldCheck', OldCheckSchema, 'checks');
const OldPromissoryNote = mongoose.model('OldPromissoryNote', OldPromissoryNoteSchema, 'promissorynotes');
const OldCreditCard = mongoose.model('OldCreditCard', OldCreditCardSchema, 'creditcards');
const OldAnnualPlan = mongoose.model('OldAnnualPlan', OldAnnualPlanSchema, 'annualplans');

// New schema
const { UserAccount } = require('./electron/schemas/UserAccount');

/**
 * Transform payment data into bank accounts with transactions
 */
function transformPaymentsToAccounts(payments) {
    const accountsMap = new Map();

    payments.forEach(payment => {
        const bankName = payment.bank || 'Diğer';

        if (!accountsMap.has(bankName)) {
            accountsMap.set(bankName, {
                bank: bankName,
                statementDay: 1,
                dueDay: 11,
                transactions: []
            });
        }

        const account = accountsMap.get(bankName);

        // Transform installment plan to transactions
        if (payment.installmentPlan && Array.isArray(payment.installmentPlan)) {
            payment.installmentPlan.forEach(installment => {
                account.transactions.push({
                    title: payment.title,
                    totalAmount: installment.amount || 0,
                    installment: `${installment.installmentNumber}/${payment.installments}`,
                    installmentNumber: installment.installmentNumber,
                    totalInstallments: payment.installments,
                    dueDate: new Date(installment.date),
                    isPaid: installment.isPaid || false,
                    category: payment.category,
                    currency: payment.currency || 'TRY',
                    originalAmount: payment.originalAmount,
                    type: payment.type || 'credit_card',
                    createdAt: payment.createdAt ? new Date(payment.createdAt) : new Date(),
                    paidAt: installment.isPaid ? new Date() : null
                });
            });
        }
    });

    return Array.from(accountsMap.values());
}

/**
 * Normalize user ID to string for comparison
 */
function normalizeUserId(userId) {
    if (!userId) return null;
    if (typeof userId === 'string') return userId;
    if (userId._id) return userId._id.toString();
    if (userId.toString) return userId.toString();
    return String(userId);
}

/**
 * Main migration function
 */
async function migrate(testMode = false) {
    console.log('='.repeat(80));
    console.log('DATABASE MIGRATION: Flat Collections → Embedded Documents');
    console.log('='.repeat(80));
    console.log(`Mode: ${testMode ? 'TEST (No data will be written)' : 'PRODUCTION'}`);
    console.log('');

    try {
        // Connect to MongoDB
        console.log('[1/6] Connecting to MongoDB...');
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✓ Connected successfully\n');

        // Create backup
        console.log('[2/6] Creating backup...');
        const backupData = {
            timestamp: new Date().toISOString(),
            users: await OldUser.find().lean(),
            payments: await OldPayment.find().lean(),
            settings: await OldSettings.find().lean(),
            dailyIncomes: await OldDailyIncome.find().lean(),
            banks: await OldBank.find().lean(),
            incomes: await OldIncome.find().lean(),
            expenses: await OldExpense.find().lean(),
            checks: await OldCheck.find().lean(),
            promissoryNotes: await OldPromissoryNote.find().lean(),
            creditCards: await OldCreditCard.find().lean(),
            annualPlans: await OldAnnualPlan.find().lean()
        };

        const backupPath = path.join(__dirname, `migration_backup_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        console.log(`✓ Backup created: ${backupPath}\n`);

        // Fetch all users
        console.log('[3/6] Fetching users...');
        const users = await OldUser.find().lean();
        console.log(`✓ Found ${users.length} users\n`);

        // Migrate each user
        console.log('[4/6] Migrating user data...');
        let successCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                const userId = user._id.toString();
                console.log(`\n  Processing user: ${user.email} (${userId})`);

                // Fetch all related data
                const userIdQuery = { $or: [{ userId: user._id }, { userId: userId }] };

                const [payments, settings, dailyIncomes, banks, incomes, expenses, checks, promissoryNotes, creditCards, annualPlans] = await Promise.all([
                    OldPayment.find(userIdQuery).lean(),
                    OldSettings.findOne(userIdQuery).lean(),
                    OldDailyIncome.find(userIdQuery).lean(),
                    OldBank.find(userIdQuery).lean(),
                    OldIncome.find(userIdQuery).lean(),
                    OldExpense.find(userIdQuery).lean(),
                    OldCheck.find(userIdQuery).lean(),
                    OldPromissoryNote.find(userIdQuery).lean(),
                    OldCreditCard.find(userIdQuery).lean(),
                    OldAnnualPlan.find(userIdQuery).lean()
                ]);

                console.log(`    - Payments: ${payments.length}`);
                console.log(`    - Daily Incomes: ${dailyIncomes.length}`);
                console.log(`    - Banks: ${banks.length}`);
                console.log(`    - Incomes: ${incomes.length}`);
                console.log(`    - Expenses: ${expenses.length}`);

                // Transform payments to accounts with transactions
                const accounts = transformPaymentsToAccounts(payments);
                console.log(`    - Generated ${accounts.length} bank accounts with transactions`);

                // Create new user document
                const newUserData = {
                    _id: user._id,
                    email: user.email,
                    password: user.password,
                    profile: {
                        name: user.name || '',
                        phone: user.phone || '',
                        telegramChatId: user.telegramChatId || '',
                        pairingCode: user.pairingCode || '',
                        pairingCodeExpiresAt: user.pairingCodeExpiresAt,
                        pin: user.pin || '',
                        incomeExpensePassword: user.incomeExpensePassword || ''
                    },
                    settings: {
                        notificationDays: settings?.notificationDays || 3,
                        telegram: settings?.telegram || {
                            botToken: '8329470679:AAFgx7WOzZhe8wI46ytq1VfFPm2u91O-S_0',
                            chatId: '',
                            notificationsEnabled: true
                        },
                        backup: settings?.backup || { enabled: false, time: '00:00' },
                        lastTelegramNotification: settings?.lastTelegramNotification || ''
                    },
                    accounts: accounts,
                    dailyIncomes: dailyIncomes.map(di => ({
                        date: di.date,
                        cash: di.cash || 0,
                        cc: di.cc || 0,
                        salary: di.salary || 0,
                        insurance: di.insurance || 0,
                        other: di.other || 0,
                        expenses: di.expenses || []
                    })),
                    banks: banks.map(b => ({
                        name: b.name,
                        accountNumber: b.accountNumber,
                        iban: b.iban,
                        balance: b.balance,
                        currency: b.currency,
                        type: b.type
                    })),
                    incomes: incomes.map(i => ({
                        description: i.description,
                        amount: i.amount,
                        date: i.date,
                        category: i.category,
                        currency: i.currency
                    })),
                    expenses: expenses.map(e => ({
                        description: e.description,
                        amount: e.amount,
                        date: e.date,
                        category: e.category,
                        currency: e.currency
                    })),
                    checks: checks.map(c => ({
                        checkNumber: c.checkNumber,
                        amount: c.amount,
                        issueDate: c.issueDate,
                        dueDate: c.dueDate,
                        status: c.status,
                        recipient: c.recipient,
                        bank: c.bank,
                        currency: c.currency
                    })),
                    promissoryNotes: promissoryNotes.map(pn => ({
                        noteNumber: pn.noteNumber,
                        amount: pn.amount,
                        issueDate: pn.issueDate,
                        dueDate: pn.dueDate,
                        status: pn.status,
                        holder: pn.holder,
                        issuer: pn.issuer,
                        currency: pn.currency
                    })),
                    creditCards: creditCards.map(cc => ({
                        cardName: cc.cardName,
                        bank: cc.bank,
                        lastFourDigits: cc.lastFourDigits,
                        limit: cc.limit,
                        currentBalance: cc.currentBalance,
                        cutoffDay: cc.cutoffDay,
                        paymentDay: cc.paymentDay,
                        currency: cc.currency
                    })),
                    annualPlans: annualPlans.map(ap => ({
                        year: ap.year,
                        targetIncome: ap.targetIncome,
                        targetExpense: ap.targetExpense,
                        targetSavings: ap.targetSavings,
                        categories: ap.categories,
                        currency: ap.currency
                    })),
                    role: user.role || 'user',
                    createdAt: user.createdAt || new Date(),
                    updatedAt: new Date()
                };

                if (!testMode) {
                    // Save to new collection
                    await UserAccount.findByIdAndUpdate(
                        user._id,
                        newUserData,
                        { upsert: true, new: true }
                    );
                    console.log(`    ✓ Migrated successfully`);
                } else {
                    console.log(`    ✓ Would migrate (test mode)`);
                }

                successCount++;
            } catch (error) {
                console.error(`    ✗ Error migrating user ${user.email}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n[5/6] Migration Summary:');
        console.log(`  ✓ Successful: ${successCount}`);
        console.log(`  ✗ Failed: ${errorCount}`);
        console.log(`  Total: ${users.length}\n`);

        // Verification
        if (!testMode) {
            console.log('[6/6] Verifying migration...');
            const migratedCount = await UserAccount.countDocuments();
            console.log(`  New UserAccount documents: ${migratedCount}`);
            console.log(`  Expected: ${users.length}`);

            if (migratedCount === users.length) {
                console.log('  ✓ Verification passed!\n');
            } else {
                console.log('  ⚠ Warning: Count mismatch!\n');
            }
        }

        console.log('='.repeat(80));
        console.log('MIGRATION COMPLETE');
        console.log('='.repeat(80));
        console.log('\nNext Steps:');
        console.log('1. Verify data in MongoDB Compass or using test queries');
        console.log('2. Test the application with new schema');
        console.log('3. If everything works, manually delete old collections:');
        console.log('   - payments, settings, dailyincomes, banks, incomes,');
        console.log('     expenses, checks, promissorynotes, creditcards, annualplans');
        console.log(`4. Keep backup file safe: ${backupPath}\n`);

    } catch (error) {
        console.error('\n✗ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB\n');
    }
}

// Run migration
const args = process.argv.slice(2);
const testMode = args.includes('--test');

migrate(testMode)
    .then(() => {
        console.log('Migration script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });
