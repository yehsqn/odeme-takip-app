/**
 * Test Script for Query Helper Functions
 * 
 * This script tests the aggregate query functions to ensure they
 * return correctly structured data from the embedded document schema.
 */

const mongoose = require('mongoose');
const {
    getUserWithAllData,
    getUpcomingPaymentsByBank,
    getPaymentsByMonth,
    getBankStatement
} = require('./electron/queryHelpers');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function runTests() {
    console.log('='.repeat(80));
    console.log('QUERY HELPER FUNCTION TESTS');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Connect
        console.log('[1/5] Connecting to MongoDB...');
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✓ Connected\n');

        // Get a test user ID (you'll need to replace this with an actual user ID from your database)
        const { UserAccount } = require('./electron/schemas/UserAccount');
        const testUser = await UserAccount.findOne();

        if (!testUser) {
            console.log('⚠ No users found in UserAccount collection. Run migration first.\n');
            return;
        }

        const userId = testUser._id.toString();
        console.log(`Using test user: ${testUser.email} (${userId})\n`);

        // Test 1: Get user with all data
        console.log('[2/5] Testing getUserWithAllData()...');
        const userData = await getUserWithAllData(userId);
        console.log(`✓ Retrieved user data:`);
        console.log(`  - Email: ${userData.email}`);
        console.log(`  - Bank Accounts: ${userData.accounts?.length || 0}`);
        console.log(`  - Daily Incomes: ${userData.dailyIncomes?.length || 0}`);

        if (userData.accounts && userData.accounts.length > 0) {
            const totalTransactions = userData.accounts.reduce((sum, acc) => sum + (acc.transactions?.length || 0), 0);
            console.log(`  - Total Transactions: ${totalTransactions}`);
        }
        console.log('');

        // Test 2: Get upcoming payments by bank
        console.log('[3/5] Testing getUpcomingPaymentsByBank()...');
        const upcomingPayments = await getUpcomingPaymentsByBank(userId, 30);
        console.log(`✓ Retrieved ${upcomingPayments.length} banks with upcoming payments:`);
        upcomingPayments.forEach(bank => {
            console.log(`  - ${bank.bank}: ${bank.paymentCount} payments, Total: ${bank.totalAmount.toFixed(2)} TL`);
        });
        console.log('');

        // Test 3: Get payments by month
        console.log('[4/5] Testing getPaymentsByMonth()...');
        const currentYear = new Date().getFullYear();
        const monthlyPayments = await getPaymentsByMonth(userId, currentYear);
        console.log(`✓ Retrieved ${monthlyPayments.length} months with payments:`);
        monthlyPayments.forEach(month => {
            console.log(`  - ${month.month}: ${month.paymentCount} payments`);
            console.log(`    Total: ${month.totalAmount.toFixed(2)} TL`);
            console.log(`    Paid: ${month.paidAmount.toFixed(2)} TL`);
            console.log(`    Unpaid: ${month.unpaidAmount.toFixed(2)} TL`);
        });
        console.log('');

        // Test 4: Get bank statement
        if (upcomingPayments.length > 0) {
            console.log('[5/5] Testing getBankStatement()...');
            const testBank = upcomingPayments[0].bank;
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 2);

            const statement = await getBankStatement(userId, testBank, startDate, endDate);
            if (statement) {
                console.log(`✓ Retrieved statement for ${statement.bank}:`);
                console.log(`  - Transactions: ${statement.transactionCount}`);
                console.log(`  - Total Amount: ${statement.totalAmount.toFixed(2)} TL`);
                console.log(`  - Paid: ${statement.paidAmount.toFixed(2)} TL`);
                console.log(`  - Remaining: ${statement.remainingBalance.toFixed(2)} TL`);
                console.log(`  - Statement Day: ${statement.statementDay}`);
                console.log(`  - Due Day: ${statement.dueDay}`);
            } else {
                console.log('⚠ No statement data found');
            }
        } else {
            console.log('[5/5] Skipping getBankStatement() - no banks found\n');
        }

        console.log('\n' + '='.repeat(80));
        console.log('ALL TESTS COMPLETED SUCCESSFULLY');
        console.log('='.repeat(80));
        console.log('');

    } catch (error) {
        console.error('\n✗ Test failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB\n');
    }
}

// Run tests
runTests()
    .then(() => {
        console.log('Test script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('Test script failed:', error);
        process.exit(1);
    });
