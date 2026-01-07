const normalizeUid = (value: string) =>
  value.trim().replace(/^['"]|['"]$/g, "");

const parseAdminUids = (raw: string | undefined) => {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return [] as string[];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? normalizeUid(item) : ""))
          .filter(Boolean);
      }
    } catch {
      // fall through to split parsing
    }
  }

  return trimmed
    .split(/[;,]/)
    .map((item) => normalizeUid(item))
    .filter(Boolean);
};

let cachedSet: Set<string> | null = null;

export const getAdminUidSet = () => {
  if (!cachedSet) {
    const raw = import.meta.env.VITE_ADMIN_UIDS;
    cachedSet = new Set(parseAdminUids(raw));
  }
  return cachedSet;
};

export const isAdminUid = (uid: string | null | undefined) => {
  if (!uid) {
    return false;
  }
  return getAdminUidSet().has(uid);
};
