# Embedded Document Schema - Usage Guide

## Overview

This guide explains how to use the new embedded document schema and aggregate query functions.

## New Schema Structure

Each user document now contains all their financial data:

```javascript
{
  _id: ObjectId,
  email: String,
  password: String,
  profile: { name, phone, telegramChatId, ... },
  settings: { notificationDays, telegram, backup },
  accounts: [
    {
      bank: "Akbank",
      statementDay: 10,
      dueDay: 20,
      transactions: [
        {
          title: "Buzdolabı",
          totalAmount: 2000,
          installment: "1/6",
          dueDate: Date,
          isPaid: false,
          ...
        }
      ]
    }
  ],
  dailyIncomes: [...],
  banks: [...],
  incomes: [...],
  expenses: [...],
  ...
}
```

## Available Query Functions

### 1. Get User with All Data

```javascript
// IPC Handler: 'db:get-user-all-data'
const result = await ipcRenderer.invoke('db:get-user-all-data', userId);
// Returns: { success: true, data: { email, accounts, dailyIncomes, ... } }
```

### 2. Get Upcoming Payments by Bank

```javascript
// IPC Handler: 'db:get-payments-by-bank'
const result = await ipcRenderer.invoke('db:get-payments-by-bank', {
  userId: 'USER_ID',
  days: 30  // Look ahead 30 days
});

// Returns:
{
  success: true,
  data: [
    {
      bank: "Akbank",
      statementDay: 10,
      dueDay: 20,
      payments: [
        { title, amount, installment, dueDate, ... }
      ],
      totalAmount: 15000,
      paymentCount: 5
    }
  ]
}
```

### 3. Get Payments by Month

```javascript
// IPC Handler: 'db:get-payments-by-month'
const result = await ipcRenderer.invoke('db:get-payments-by-month', {
  userId: 'USER_ID',
  year: 2024
});

// Returns:
{
  success: true,
  data: [
    {
      month: "2024-03",
      payments: [...],
      totalAmount: 12000,
      paidAmount: 5000,
      unpaidAmount: 7000,
      paymentCount: 8
    }
  ]
}
```

### 4. Get Bank Statement

```javascript
// IPC Handler: 'db:get-bank-statement'
const result = await ipcRenderer.invoke('db:get-bank-statement', {
  userId: 'USER_ID',
  bankName: 'Akbank',
  startDate: '2024-01-01',
  endDate: '2024-03-31'
});

// Returns:
{
  success: true,
  data: {
    bank: "Akbank",
    statementDay: 10,
    dueDay: 20,
    transactions: [...],
    totalAmount: 20000,
    paidAmount: 8000,
    remainingBalance: 12000,
    transactionCount: 15
  }
}
```

### 5. Add Payment Transaction

```javascript
// IPC Handler: 'db:add-payment-transaction'
const result = await ipcRenderer.invoke('db:add-payment-transaction', {
  userId: 'USER_ID',
  bankName: 'Akbank',
  transaction: {
    title: "Laptop",
    totalAmount: 3000,
    installment: "1/12",
    installmentNumber: 1,
    totalInstallments: 12,
    dueDate: new Date('2024-04-15'),
    isPaid: false,
    category: 'Elektronik',
    currency: 'TRY'
  }
});
```

### 6. Update Transaction Status

```javascript
// IPC Handler: 'db:update-transaction-status'
const result = await ipcRenderer.invoke('db:update-transaction-status', {
  userId: 'USER_ID',
  transactionId: 'TRANSACTION_ID',
  isPaid: true
});
```

## Migration Steps

### 1. Run Migration in Test Mode

```bash
node migrate_to_embedded.cjs --test
```

This will show what would be migrated without actually writing to the database.

### 2. Run Actual Migration

```bash
node migrate_to_embedded.cjs
```

This will:
- Create a backup JSON file
- Migrate all users to the new schema
- Create documents in the `useraccounts` collection
- NOT delete old collections (manual cleanup after verification)

### 3. Test Query Functions

```bash
node test_queries.cjs
```

This will test all aggregate query functions and display results.

### 4. Verify Data

Use MongoDB Compass or the test script to verify:
- All users are migrated
- Transaction counts match
- Bank accounts are correctly grouped
- All embedded data is present

### 5. Update Application

The new IPC handlers are already added to `main.cjs`. You can now use them in the frontend.

### 6. Clean Up (After Verification)

Once you've confirmed everything works:

```javascript
// In MongoDB shell or Compass, delete old collections:
db.payments.drop()
db.settings.drop()
db.dailyincomes.drop()
db.banks.drop()
db.incomes.drop()
db.expenses.drop()
db.checks.drop()
db.promissorynotes.drop()
db.creditcards.drop()
db.annualplans.drop()
```

## Benefits

1. **Single Query**: Get all user data with one database call
2. **Grouped Data**: Payments automatically grouped by bank
3. **Better Performance**: Fewer database round trips
4. **Cleaner Structure**: All related data nested logically
5. **Easier Aggregation**: MongoDB aggregation pipelines for complex queries

## Example Frontend Usage

```javascript
// In React component
const loadPaymentsByBank = async () => {
  const result = await window.require('electron').ipcRenderer.invoke(
    'db:get-payments-by-bank',
    { userId: user.id, days: 30 }
  );
  
  if (result.success) {
    setPaymentsByBank(result.data);
  }
};

// Display grouped payments
{paymentsByBank.map(bank => (
  <div key={bank.bank}>
    <h3>{bank.bank}</h3>
    <p>Total: {bank.totalAmount} TL</p>
    <p>Payments: {bank.paymentCount}</p>
    {bank.payments.map(payment => (
      <div key={payment._id}>
        {payment.title} - {payment.amount} TL
      </div>
    ))}
  </div>
))}
```

## Rollback

If you need to rollback:
1. The old collections are still intact
2. Delete the `useraccounts` collection
3. Restore from the backup JSON file if needed
4. Remove the new IPC handlers from `main.cjs`
