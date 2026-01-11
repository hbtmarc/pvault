const pad2 = (value: number) => value.toString().padStart(2, "0");

export const getMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  return `${year}-${month}`;
};

export const isValidMonthKey = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const [, month] = value.split("-").map(Number);
  return month >= 1 && month <= 12;
};

export const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const todayDateInput = () => formatDateInput(new Date());

const parseDateISO = (dateISO: string) => {
  const [year, month, day] = dateISO.split("-").map(Number);
  return { year, month, day };
};

export const getMonthKeyFromDateISO = (dateISO: string) => {
  const { year, month } = parseDateISO(dateISO);
  return `${year}-${pad2(month)}`;
};

export const shiftMonthKey = (monthKey: string, delta: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return getMonthKey(shifted);
};

export const lastDayOfMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
};

export const addMonthsToDateISO = (dateISO: string, monthsToAdd: number) => {
  const { year, month, day } = parseDateISO(dateISO);
  const target = new Date(year, month - 1 + monthsToAdd, 1);
  const targetMonthKey = getMonthKey(target);
  const lastDay = lastDayOfMonth(targetMonthKey);
  const finalDay = Math.min(day, lastDay);
  return `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(finalDay)}`;
};

export const getStatementMonthKey = (dateISO: string, closingDay: number) => {
  const { year, month, day } = parseDateISO(dateISO);
  const monthKey = `${year}-${pad2(month)}`;
  const effectiveClosingDay = Math.min(closingDay, lastDayOfMonth(monthKey));

  if (day <= effectiveClosingDay) {
    return monthKey;
  }

  const nextMonth = new Date(year, month, 1);
  return getMonthKey(nextMonth);
};

export const getInvoiceMonthKey = (dateISO: string, closingDay: number) =>
  getStatementMonthKey(dateISO, closingDay);

export const getDueDateISO = (statementMonthKey: string, dueDay: number) => {
  const [year, month] = statementMonthKey.split("-").map(Number);
  const dueMonth = new Date(year, month, 1);
  const dueMonthKey = getMonthKey(dueMonth);
  const lastDay = lastDayOfMonth(dueMonthKey);
  const finalDay = Math.min(dueDay, lastDay);
  return `${dueMonth.getFullYear()}-${pad2(dueMonth.getMonth() + 1)}-${pad2(
    finalDay
  )}`;
};
