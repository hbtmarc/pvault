const pad2 = (value: number) => value.toString().padStart(2, "0");

const isValidDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const parseDateToISO = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!isValidDate(year, month, day)) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
};
