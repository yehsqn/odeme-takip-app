import { addMonths, setDate, isAfter, startOfDay, addDays, isSaturday, isSunday } from 'date-fns';

const adjustForWeekend = (date) => {
  if (isSaturday(date)) return addDays(date, 2);
  if (isSunday(date)) return addDays(date, 1);
  return date;
};

/**
 * Calculates the starting date of the first installment based on the expenditure date and cut-off date.
 * @param {Date} expenditureDate - The date when the expenditure was made.
 * @param {number} cutOffDay - The day of the month for the credit card cut-off (e.g., 1).
 * @param {number} dueDay - The day of the month for the payment due date (e.g., 11).
 * @returns {Date} - The date of the first installment.
 */
export const calculateFirstInstallmentDate = (expenditureDate, cutOffDay, dueDay = 11) => {
  let date = startOfDay(new Date(expenditureDate));
  
  // Note: We removed the automatic month shifting logic based on cut-off date
  // because users prefer to see the payment in the same month or closest relevant month
  // without aggressive credit card statement logic.
  
  // Set the payment day
  const targetDate = setDate(date, dueDay);
  return adjustForWeekend(targetDate);
};

export const generateInstallmentPlan = (amount, installments, expenditureDate, cutOffDay, dueDay = 11) => {
  let baseDate = startOfDay(new Date(expenditureDate));
  
  // Note: Removed automatic month shifting.
  // Normalize to dueDay
  baseDate = setDate(baseDate, dueDay);

  const monthlyAmount = amount / installments;
  const plan = [];

  for (let i = 0; i < installments; i++) {
    let targetDate = addMonths(baseDate, i);
    targetDate = setDate(targetDate, dueDay); // Enforce due day
    targetDate = adjustForWeekend(targetDate);

    plan.push({
      id: crypto.randomUUID(),
      installmentNumber: i + 1,
      date: targetDate,
      amount: monthlyAmount,
      isPaid: false,
    });
  }

  return plan;
};

export const generateConsecutivePlan = (amount, count, startDate) => {
  const monthlyAmount = amount / count;
  const start = startOfDay(new Date(startDate));
  const plan = [];

  for (let i = 0; i < count; i++) {
    const targetDate = addMonths(start, i);
    
    plan.push({
      id: crypto.randomUUID(),
      installmentNumber: i + 1,
      date: targetDate,
      amount: monthlyAmount,
      isPaid: false,
    });
  }

  return plan;
};
