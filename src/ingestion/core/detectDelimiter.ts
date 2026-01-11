const countDelimiter = (line: string, delimiter: string) => {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

const getFirstNonEmptyLine = (text: string) => {
  const lines = text.split(/\r?\n/);
  return lines.find((line) => line.trim().length > 0) ?? "";
};

export const detectDelimiter = (text: string) => {
  const line = getFirstNonEmptyLine(text);
  const candidates = [",", ";", "\t"];
  let best = candidates[0];
  let bestCount = -1;

  candidates.forEach((candidate) => {
    const count = countDelimiter(line, candidate);
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  });

  return best;
};
