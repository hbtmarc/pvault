import { FirebaseError } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { lastDayOfMonth } from "./date";
import { db } from "./firebase";

export type Direction = "income" | "expense";

export type TransactionSourceType = "manual" | "recurring";

export type Category = {
  id: string;
  name: string;
  type: Direction;
  order: number;
  archived: boolean;
};

export type Transaction = {
  id: string;
  direction: Direction;
  amountCents: number;
  date: string;
  monthKey: string;
  categoryId: string;
  description?: string;
  sourceType?: TransactionSourceType;
  sourceRuleId?: string;
  plannedDate?: string;
};

export type Budget = {
  id: string;
  monthKey: string;
  categoryId: string;
  allocatedCents: number;
};

export type RecurringRule = {
  id: string;
  name: string;
  direction: Direction;
  amountCents: number;
  categoryId: string;
  dayOfMonth: number;
  startMonthKey: string;
  endMonthKey?: string;
  active: boolean;
};

export type PlannedItem = {
  id: string;
  ruleId: string;
  name: string;
  direction: Direction;
  amountCents: number;
  categoryId: string;
  monthKey: string;
  plannedDate: string;
};

export type FirestoreErrorInfo = {
  message: string;
  code?: string;
  details?: string;
  isIndexError?: boolean;
};

type CategoryInput = {
  name: string;
  type: Direction;
  order?: number;
};

type TransactionInput = {
  direction: Direction;
  amountCents: number;
  date: string;
  categoryId: string;
  description?: string;
  sourceType?: TransactionSourceType;
  sourceRuleId?: string;
  plannedDate?: string;
};

type RecurringRuleInput = {
  name: string;
  direction: Direction;
  amountCents: number;
  categoryId: string;
  dayOfMonth: number;
  startMonthKey: string;
  endMonthKey?: string;
  active?: boolean;
};

const categoriesCollection = (uid: string) =>
  collection(db, "users", uid, "categories");

const transactionsCollection = (uid: string) =>
  collection(db, "users", uid, "transactions");

const budgetsCollection = (uid: string) => collection(db, "users", uid, "budgets");

const recurringRulesCollection = (uid: string) =>
  collection(db, "users", uid, "recurringRules");

const ensureUid = (uid: string) => {
  if (!uid) {
    throw new Error("Missing uid");
  }
};

const logDev = (message: string, details: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.debug(message, details);
  }
};

export const listCategories = (
  uid: string,
  archived: boolean,
  onChange: (items: Category[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/categories`;

  logDev("[firestore] listCategories", { uid, path, archived });

  const categoriesQuery = query(
    categoriesCollection(uid),
    where("archived", "==", archived),
    orderBy("order", "asc"),
    orderBy("name", "asc")
  );

  return onSnapshot(
    categoriesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: (data.name as string) ?? "",
          type: (data.type as Direction) ?? "expense",
          order: (data.order as number) ?? 0,
          archived: (data.archived as boolean) ?? false,
        };
      });

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listCategories", { uid, path, archived, error });
      onError?.(error);
    }
  );
};

export const createCategory = async (uid: string, data: CategoryInput) => {
  ensureUid(uid);
  const path = `users/${uid}/categories`;
  const payload = {
    name: data.name.trim(),
    type: data.type,
    order: data.order ?? 0,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    return await addDoc(categoriesCollection(uid), payload);
  } catch (error) {
    console.error("[firestore] createCategory", { uid, path, error });
    throw error;
  }
};

export const updateCategory = async (
  uid: string,
  categoryId: string,
  data: CategoryInput
) => {
  ensureUid(uid);
  const path = `users/${uid}/categories/${categoryId}`;
  const payload = {
    name: data.name.trim(),
    type: data.type,
    order: data.order ?? 0,
    updatedAt: serverTimestamp(),
  };

  try {
    return await updateDoc(doc(categoriesCollection(uid), categoryId), payload);
  } catch (error) {
    console.error("[firestore] updateCategory", { uid, path, error });
    throw error;
  }
};

export const archiveCategory = async (
  uid: string,
  categoryId: string,
  archived: boolean
) => {
  ensureUid(uid);
  const path = `users/${uid}/categories/${categoryId}`;

  try {
    return await updateDoc(doc(categoriesCollection(uid), categoryId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[firestore] archiveCategory", { uid, path, archived, error });
    throw error;
  }
};

export const listTransactionsByMonth = (
  uid: string,
  monthKey: string,
  onChange: (items: Transaction[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;

  logDev("[firestore] listTransactionsByMonth", { uid, path, monthKey });

  const transactionsQuery = query(
    transactionsCollection(uid),
    where("monthKey", "==", monthKey),
    orderBy("date", "desc")
  );

  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          direction: (data.direction as Direction) ?? "expense",
          amountCents: (data.amountCents as number) ?? 0,
          date: (data.date as string) ?? "",
          monthKey: (data.monthKey as string) ?? "",
          categoryId: (data.categoryId as string) ?? "",
          description: (data.description as string) ?? "",
          sourceType: data.sourceType as TransactionSourceType | undefined,
          sourceRuleId: (data.sourceRuleId as string) ?? undefined,
          plannedDate: (data.plannedDate as string) ?? undefined,
        };
      });

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listTransactionsByMonth", {
        uid,
        path,
        monthKey,
        error,
      });
      onError?.(error);
    }
  );
};

export const createTransaction = async (uid: string, data: TransactionInput) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;
  const payload: Record<string, unknown> = {
    direction: data.direction,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    categoryId: data.categoryId,
    description: data.description?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (data.sourceType) {
    payload.sourceType = data.sourceType;
  }
  if (data.sourceRuleId) {
    payload.sourceRuleId = data.sourceRuleId;
  }
  if (data.plannedDate) {
    payload.plannedDate = data.plannedDate;
  }

  try {
    return await addDoc(transactionsCollection(uid), payload);
  } catch (error) {
    console.error("[firestore] createTransaction", { uid, path, error });
    throw error;
  }
};

export const updateTransaction = async (
  uid: string,
  transactionId: string,
  data: TransactionInput
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions/${transactionId}`;
  const payload: Record<string, unknown> = {
    direction: data.direction,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    categoryId: data.categoryId,
    description: data.description?.trim() || "",
    updatedAt: serverTimestamp(),
  };

  if (data.sourceType) {
    payload.sourceType = data.sourceType;
  }
  if (data.sourceRuleId) {
    payload.sourceRuleId = data.sourceRuleId;
  }
  if (data.plannedDate) {
    payload.plannedDate = data.plannedDate;
  }

  try {
    return await updateDoc(
      doc(transactionsCollection(uid), transactionId),
      payload
    );
  } catch (error) {
    console.error("[firestore] updateTransaction", { uid, path, error });
    throw error;
  }
};

export const removeTransaction = async (uid: string, transactionId: string) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions/${transactionId}`;

  try {
    return await deleteDoc(doc(transactionsCollection(uid), transactionId));
  } catch (error) {
    console.error("[firestore] removeTransaction", { uid, path, error });
    throw error;
  }
};

export const listBudgetsByMonth = (
  uid: string,
  monthKey: string,
  onChange: (items: Budget[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/budgets`;

  logDev("[firestore] listBudgetsByMonth", { uid, path, monthKey });

  const budgetsQuery = query(
    budgetsCollection(uid),
    where("monthKey", "==", monthKey)
  );

  return onSnapshot(
    budgetsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          monthKey: (data.monthKey as string) ?? monthKey,
          categoryId: (data.categoryId as string) ?? "",
          allocatedCents: (data.allocatedCents as number) ?? 0,
        };
      });

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listBudgetsByMonth", { uid, path, monthKey, error });
      onError?.(error);
    }
  );
};

export const upsertBudget = async (
  uid: string,
  monthKey: string,
  categoryId: string,
  allocatedCents: number
) => {
  ensureUid(uid);
  const budgetId = `${monthKey}_${categoryId}`;
  const path = `users/${uid}/budgets/${budgetId}`;
  const payload = {
    monthKey,
    categoryId,
    allocatedCents,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    return await setDoc(doc(budgetsCollection(uid), budgetId), payload, {
      merge: true,
    });
  } catch (error) {
    console.error("[firestore] upsertBudget", {
      uid,
      path,
      monthKey,
      categoryId,
      allocatedCents,
      error,
    });
    throw error;
  }
};

export const listRecurringRules = (
  uid: string,
  onChange: (items: RecurringRule[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/recurringRules`;

  logDev("[firestore] listRecurringRules", { uid, path });

  const rulesQuery = query(recurringRulesCollection(uid), orderBy("name", "asc"));

  return onSnapshot(
    rulesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: (data.name as string) ?? "",
          direction: (data.direction as Direction) ?? "expense",
          amountCents: (data.amountCents as number) ?? 0,
          categoryId: (data.categoryId as string) ?? "",
          dayOfMonth: (data.dayOfMonth as number) ?? 1,
          startMonthKey: (data.startMonthKey as string) ?? "",
          endMonthKey: (data.endMonthKey as string) ?? undefined,
          active: (data.active as boolean) ?? true,
        };
      });

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listRecurringRules", { uid, path, error });
      onError?.(error);
    }
  );
};

export const createRecurringRule = async (uid: string, data: RecurringRuleInput) => {
  ensureUid(uid);
  const path = `users/${uid}/recurringRules`;
  const payload = {
    name: data.name.trim(),
    direction: data.direction,
    amountCents: data.amountCents,
    categoryId: data.categoryId,
    dayOfMonth: data.dayOfMonth,
    startMonthKey: data.startMonthKey,
    endMonthKey: data.endMonthKey ?? undefined,
    active: data.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    return await addDoc(recurringRulesCollection(uid), payload);
  } catch (error) {
    console.error("[firestore] createRecurringRule", { uid, path, error });
    throw error;
  }
};

export const updateRecurringRule = async (
  uid: string,
  ruleId: string,
  data: RecurringRuleInput
) => {
  ensureUid(uid);
  const path = `users/${uid}/recurringRules/${ruleId}`;
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    direction: data.direction,
    amountCents: data.amountCents,
    categoryId: data.categoryId,
    dayOfMonth: data.dayOfMonth,
    startMonthKey: data.startMonthKey,
    updatedAt: serverTimestamp(),
  };

  if (data.endMonthKey) {
    payload.endMonthKey = data.endMonthKey;
  } else {
    payload.endMonthKey = deleteField();
  }

  try {
    return await updateDoc(doc(recurringRulesCollection(uid), ruleId), payload);
  } catch (error) {
    console.error("[firestore] updateRecurringRule", { uid, path, error });
    throw error;
  }
};

export const toggleRecurringRule = async (
  uid: string,
  ruleId: string,
  active: boolean
) => {
  ensureUid(uid);
  const path = `users/${uid}/recurringRules/${ruleId}`;

  try {
    return await updateDoc(doc(recurringRulesCollection(uid), ruleId), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[firestore] toggleRecurringRule", { uid, path, active, error });
    throw error;
  }
};

export const deleteRecurringRule = async (uid: string, ruleId: string) => {
  ensureUid(uid);
  const path = `users/${uid}/recurringRules/${ruleId}`;

  try {
    return await deleteDoc(doc(recurringRulesCollection(uid), ruleId));
  } catch (error) {
    console.error("[firestore] deleteRecurringRule", { uid, path, error });
    throw error;
  }
};

const isIndexError = (error: FirebaseError) => {
  const code = error.code.toLowerCase();
  const message = error.message.toLowerCase();
  return code === "failed-precondition" || message.includes("index");
};

export const getFirestoreErrorInfo = (error: unknown): FirestoreErrorInfo => {
  if (!(error instanceof FirebaseError)) {
    return {
      message: "Ocorreu um erro inesperado. Tente novamente.",
    };
  }

  const indexError = isIndexError(error);
  if (indexError) {
    return {
      message:
        "Indice necessario para essa consulta. Atualize firestore.indexes.json e rode: firebase deploy --only firestore:indexes",
      code: error.code,
      details: error.message,
      isIndexError: true,
    };
  }

  switch (error.code) {
    case "permission-denied":
      return {
        message: "Permissao negada. Verifique se voce esta autenticado.",
        code: error.code,
        details: error.message,
      };
    case "unavailable":
      return {
        message: "Servico indisponivel. Tente novamente em instantes.",
        code: error.code,
        details: error.message,
      };
    case "not-found":
      return {
        message: "Documento nao encontrado.",
        code: error.code,
        details: error.message,
      };
    default:
      return {
        message: "Nao foi possivel concluir a acao. Tente novamente.",
        code: error.code,
        details: error.message,
      };
  }
};

export const getFirestoreErrorMessage = (error: unknown) =>
  getFirestoreErrorInfo(error).message;

export const buildPlannedItems = (
  monthKey: string,
  rules: RecurringRule[],
  existingTransactions: Transaction[]
) => {
  const existingPlanned = new Set(
    existingTransactions
      .filter(
        (transaction) =>
          transaction.sourceType === "recurring" &&
          transaction.sourceRuleId &&
          transaction.plannedDate
      )
      .map(
        (transaction) =>
          `${transaction.sourceRuleId}_${transaction.plannedDate}`
      )
  );

  const pad2 = (value: number) => value.toString().padStart(2, "0");

  return rules
    .filter((rule) => rule.active)
    .filter((rule) => {
      if (!rule.startMonthKey) {
        return false;
      }
      if (monthKey < rule.startMonthKey) {
        return false;
      }
      if (rule.endMonthKey && monthKey > rule.endMonthKey) {
        return false;
      }
      return true;
    })
    .map((rule) => {
      const day = Math.min(rule.dayOfMonth, lastDayOfMonth(monthKey));
      const plannedDate = `${monthKey}-${pad2(day)}`;
      const id = `${rule.id}_${plannedDate}`;

      return {
        id,
        ruleId: rule.id,
        name: rule.name,
        direction: rule.direction,
        amountCents: rule.amountCents,
        categoryId: rule.categoryId,
        monthKey,
        plannedDate,
      } satisfies PlannedItem;
    })
    .filter((item) => !existingPlanned.has(`${item.ruleId}_${item.plannedDate}`));
};