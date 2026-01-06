import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isAdminUid } from "../lib/admin";
import { useAuth } from "./AuthProvider";

type Impersonation = {
  uid: string;
  label?: string;
};

type AdminContextValue = {
  authUid: string | null;
  isAdmin: boolean;
  effectiveUid: string | null;
  isImpersonating: boolean;
  impersonationLabel?: string;
  impersonate: (uid: string, label?: string) => void;
  stopImpersonation: () => void;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export const AdminProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const authUid = user?.uid ?? null;
  const isAdmin = isAdminUid(authUid);
  const [impersonation, setImpersonation] = useState<Impersonation | null>(null);

  useEffect(() => {
    if (!authUid) {
      setImpersonation(null);
      return;
    }

    if (!isAdmin) {
      setImpersonation(null);
      return;
    }

    if (impersonation?.uid === authUid) {
      setImpersonation(null);
    }
  }, [authUid, isAdmin, impersonation?.uid]);

  const impersonate = (uid: string, label?: string) => {
    if (!isAdmin || !uid || uid === authUid) {
      setImpersonation(null);
      return;
    }
    setImpersonation({ uid, label });
  };

  const stopImpersonation = () => setImpersonation(null);

  const effectiveUid = impersonation?.uid ?? authUid;
  const impersonationLabel = impersonation?.label ?? impersonation?.uid;
  const isImpersonating = Boolean(impersonation && impersonation.uid !== authUid);

  const value = useMemo(
    () => ({
      authUid,
      isAdmin,
      effectiveUid,
      isImpersonating,
      impersonationLabel,
      impersonate,
      stopImpersonation,
    }),
    [
      authUid,
      isAdmin,
      effectiveUid,
      isImpersonating,
      impersonationLabel,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
};