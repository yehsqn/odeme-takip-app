import { calculateFirstInstallmentDate } from './src/utils/dateUtils.js';
import { format } from 'date-fns';

console.log('--- Testing Date Logic ---');

const testCase = (expenseDate, cutOffDay, expectedMonth) => {
    const result = calculateFirstInstallmentDate(new Date(expenseDate), cutOffDay);
    console.log(`Expense: ${expenseDate}, CutOff: ${cutOffDay} -> Result: ${format(result, 'yyyy-MM-dd')}`);
};

// User Scenario: Cut-off 5th, Payment 6th.
// Expectation: Next month (because 6 > 5)
testCase('2023-12-06', 5, '2024-01-05');

// Scenario: Cut-off 5th, Payment 4th.
// Expectation: This month (current statement)
testCase('2023-12-04', 5, '2023-12-05');

// Scenario: Cut-off 5th, Payment 5th.
// Expectation: This month? Or Next? Usually cut-off day is inclusive in the statement?
// If I buy ON the cut-off day, usually it enters the CURRENT statement.
testCase('2023-12-05', 5, '2023-12-05');

// Scenario: Cut-off 10th. Payment 23rd (Today).
// Expectation: Next Month (Jan 10)
testCase('2023-12-23', 10, '2024-01-10');
