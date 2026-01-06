export const isAdminUid = (authUid: string | null | undefined) => {
  if (!authUid) {
    return false;
  }

  const rawList = import.meta.env.VITE_ADMIN_UIDS ?? "";
  const adminUids = rawList
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return adminUids.includes(authUid);
};