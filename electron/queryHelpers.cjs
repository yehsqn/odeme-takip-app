const mongoose = require('mongoose');
const { UserAccount } = require('./schemas/UserAccount.cjs');

/**
 * Get complete user data with all embedded documents
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Complete user document
 */
async function getUserWithAllData(userId) {
    try {
        const user = await UserAccount.findById(userId).lean();
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        console.error('[QUERY] getUserWithAllData error:', error);
        throw error;
    }
}

/**
 * Get upcoming payments grouped by bank
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look ahead (default: 30)
 * @returns {Promise<Array>} Payments grouped by bank
 */
async function getUpcomingPaymentsByBank(userId, days = 30) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + days);

        const result = await UserAccount.aggregate([
            // Match the user
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },

            // Unwind accounts array
            { $unwind: '$accounts' },

            // Unwind transactions array
            { $unwind: '$accounts.transactions' },

            // Filter unpaid transactions within date range
            {
                $match: {
                    'accounts.transactions.isPaid': false,
                    'accounts.transactions.dueDate': {
                        $gte: today,
                        $lte: futureDate
                    }
                }
            },

            // Group by bank
            {
                $group: {
                    _id: '$accounts.bank',
                    bank: { $first: '$accounts.bank' },
                    statementDay: { $first: '$accounts.statementDay' },
                    dueDay: { $first: '$accounts.dueDay' },
                    payments: {
                        $push: {
                            title: '$accounts.transactions.title',
                            amount: '$accounts.transactions.totalAmount',
                            installment: '$accounts.transactions.installment',
                            dueDate: '$accounts.transactions.dueDate',
                            category: '$accounts.transactions.category',
                            currency: '$accounts.transactions.currency',
                            type: '$accounts.transactions.type',
                            _id: '$accounts.transactions._id'
                        }
                    },
                    totalAmount: { $sum: '$accounts.transactions.totalAmount' }
                }
            },

            // Sort by bank name
            { $sort: { bank: 1 } },

            // Project final structure
            {
                $project: {
                    _id: 0,
                    bank: 1,
                    statementDay: 1,
                    dueDay: 1,
                    payments: 1,
                    totalAmount: 1,
                    paymentCount: { $size: '$payments' }
                }
            }
        ]);

        return result;
    } catch (error) {
        console.error('[QUERY] getUpcomingPaymentsByBank error:', error);
        throw error;
    }
}

/**
 * Get payments grouped by month
 * @param {string} userId - User ID
 * @param {number} year - Year to query (default: current year)
 * @returns {Promise<Array>} Payments grouped by month
 */
async function getPaymentsByMonth(userId, year = new Date().getFullYear()) {
    try {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        const result = await UserAccount.aggregate([
            // Match the user
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },

            // Unwind accounts
            { $unwind: '$accounts' },

            // Unwind transactions
            { $unwind: '$accounts.transactions' },

            // Filter by year
            {
                $match: {
                    'accounts.transactions.dueDate': {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },

            // Add month field
            {
                $addFields: {
                    month: {
                        $dateToString: {
                            format: '%Y-%m',
                            date: '$accounts.transactions.dueDate'
                        }
                    }
                }
            },

            // Group by month
            {
                $group: {
                    _id: '$month',
                    month: { $first: '$month' },
                    payments: {
                        $push: {
                            title: '$accounts.transactions.title',
                            amount: '$accounts.transactions.totalAmount',
                            installment: '$accounts.transactions.installment',
                            dueDate: '$accounts.transactions.dueDate',
                            isPaid: '$accounts.transactions.isPaid',
                            bank: '$accounts.bank',
                            category: '$accounts.transactions.category',
                            _id: '$accounts.transactions._id'
                        }
                    },
                    totalAmount: { $sum: '$accounts.transactions.totalAmount' },
                    paidAmount: {
                        $sum: {
                            $cond: [
                                '$accounts.transactions.isPaid',
                                '$accounts.transactions.totalAmount',
                                0
                            ]
                        }
                    },
                    unpaidAmount: {
                        $sum: {
                            $cond: [
                                { $not: '$accounts.transactions.isPaid' },
                                '$accounts.transactions.totalAmount',
                                0
                            ]
                        }
                    }
                }
            },

            // Sort by month
            { $sort: { month: 1 } },

            // Project final structure
            {
                $project: {
                    _id: 0,
                    month: 1,
                    payments: 1,
                    totalAmount: 1,
                    paidAmount: 1,
                    unpaidAmount: 1,
                    paymentCount: { $size: '$payments' }
                }
            }
        ]);

        return result;
    } catch (error) {
        console.error('[QUERY] getPaymentsByMonth error:', error);
        throw error;
    }
}

/**
 * Get bank statement for specific bank and date range
 * @param {string} userId - User ID
 * @param {string} bankName - Bank name
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Bank statement with transactions
 */
async function getBankStatement(userId, bankName, startDate, endDate) {
    try {
        const result = await UserAccount.aggregate([
            // Match the user
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },

            // Unwind accounts
            { $unwind: '$accounts' },

            // Match specific bank
            { $match: { 'accounts.bank': bankName } },

            // Unwind transactions
            { $unwind: '$accounts.transactions' },

            // Filter by date range
            {
                $match: {
                    'accounts.transactions.dueDate': {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },

            // Sort by due date
            { $sort: { 'accounts.transactions.dueDate': 1 } },

            // Group to reconstruct
            {
                $group: {
                    _id: '$accounts.bank',
                    bank: { $first: '$accounts.bank' },
                    statementDay: { $first: '$accounts.statementDay' },
                    dueDay: { $first: '$accounts.dueDay' },
                    transactions: {
                        $push: {
                            title: '$accounts.transactions.title',
                            amount: '$accounts.transactions.totalAmount',
                            installment: '$accounts.transactions.installment',
                            dueDate: '$accounts.transactions.dueDate',
                            isPaid: '$accounts.transactions.isPaid',
                            category: '$accounts.transactions.category',
                            type: '$accounts.transactions.type',
                            _id: '$accounts.transactions._id'
                        }
                    },
                    totalAmount: { $sum: '$accounts.transactions.totalAmount' },
                    paidAmount: {
                        $sum: {
                            $cond: [
                                '$accounts.transactions.isPaid',
                                '$accounts.transactions.totalAmount',
                                0
                            ]
                        }
                    },
                    remainingBalance: {
                        $sum: {
                            $cond: [
                                { $not: '$accounts.transactions.isPaid' },
                                '$accounts.transactions.totalAmount',
                                0
                            ]
                        }
                    }
                }
            },

            // Project final structure
            {
                $project: {
                    _id: 0,
                    bank: 1,
                    statementDay: 1,
                    dueDay: 1,
                    transactions: 1,
                    totalAmount: 1,
                    paidAmount: 1,
                    remainingBalance: 1,
                    transactionCount: { $size: '$transactions' }
                }
            }
        ]);

        return result.length > 0 ? result[0] : null;
    } catch (error) {
        console.error('[QUERY] getBankStatement error:', error);
        throw error;
    }
}

/**
 * Add a new payment transaction to user's bank account
 * @param {string} userId - User ID
 * @param {string} bankName - Bank name
 * @param {Object} transactionData - Transaction data
 * @returns {Promise<Object>} Updated user document
 */
async function addPaymentTransaction(userId, bankName, transactionData) {
    try {
        // Find user and the specific bank account
        const user = await UserAccount.findById(userId);
        if (!user) throw new Error('User not found');

        let account = user.accounts.find(acc => acc.bank === bankName);

        // If bank account doesn't exist, create it
        if (!account) {
            account = {
                bank: bankName,
                statementDay: 1,
                dueDay: 11,
                transactions: []
            };
            user.accounts.push(account);
        }

        // Add transaction to the account
        account.transactions.push(transactionData);

        await user.save();
        return user;
    } catch (error) {
        console.error('[QUERY] addPaymentTransaction error:', error);
        throw error;
    }
}

/**
 * Update transaction status (mark as paid/unpaid)
 * @param {string} userId - User ID
 * @param {string} transactionId - Transaction ID
 * @param {boolean} isPaid - Payment status
 * @returns {Promise<Object>} Updated user document
 */
async function updateTransactionStatus(userId, transactionId, isPaid) {
    try {
        const result = await UserAccount.findOneAndUpdate(
            {
                _id: userId,
                'accounts.transactions._id': transactionId
            },
            {
                $set: {
                    'accounts.$[].transactions.$[trans].isPaid': isPaid,
                    'accounts.$[].transactions.$[trans].paidAt': isPaid ? new Date() : null
                }
            },
            {
                arrayFilters: [{ 'trans._id': transactionId }],
                new: true
            }
        );

        return result;
    } catch (error) {
        console.error('[QUERY] updateTransactionStatus error:', error);
        throw error;
    }
}

module.exports = {
    getUserWithAllData,
    getUpcomingPaymentsByBank,
    getPaymentsByMonth,
    getBankStatement,
    addPaymentTransaction,
    updateTransactionStatus
};
