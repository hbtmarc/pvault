export const normalizeHeader = (header: string[]): string[] =>
  header.map((field) =>
    field
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  );
