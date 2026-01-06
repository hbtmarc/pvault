const pad2 = (value: number) => value.toString().padStart(2, "0");

export const getMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  return `${year}-${month}`;
};

export const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const todayDateInput = () => formatDateInput(new Date());

export const shiftMonthKey = (monthKey: string, delta: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return getMonthKey(shifted);
};
