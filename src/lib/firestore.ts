import { FirebaseError } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Query,
  type QuerySnapshot,
  Timestamp,
} from "firebase/firestore";
import {
  addMonthsToDateISO,
  getMonthKeyFromDateISO,
  getStatementMonthKey,
  lastDayOfMonth,
} from "./date";
import { db } from "./firebase";
import { getInstallmentAmount, splitCentsEven } from "./money";
import { DEFAULT_CATEGORY_SEED } from "./categorizeTransaction";

export type Direction = "income" | "expense";

export type TransactionType = Direction | "transfer";

export type PaymentMethod = "cash" | "card";

export type TransactionSourceType = "manual" | "recurring";

export type PaymentKind = "card_payment";

export type Category = {
  id: string;
  name: string;
  type: Direction;
  order: number;
  archived: boolean;
};

export type MerchantCategoryRule = {
  id: string;
  merchantKey: string;
  categoryId: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  kind?: Direction;
  paymentMethod: PaymentMethod;
  amountCents: number;
  date: string;
  monthKey: string;
  invoiceMonthKey?: string;
  categoryId?: string;
  description?: string;
  name?: string;
  notes?: string;
  paymentKind?: PaymentKind;
  importSessionId?: string;
  importFileName?: string;
  idempotencyKey?: string;
  documentNumber?: string;
  cardId?: string;
  statementMonthKey?: string;
  installmentGroupId?: string;
  installmentIndex?: number;
  installmentCount?: number;
  installmentTotal?: number;
  installmentPlanId?: string;
  installmentNumber?: number;
  installmentsTotal?: number;
  paidAt?: string;
  paidByStatementId?: string;
  isProjected?: boolean;
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

export type Card = {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  limitCents?: number;
  archived: boolean;
};

export type InstallmentPlan = {
  id: string;
  cardId: string;
  categoryId: string;
  description?: string;
  totalCents: number;
  installments: number;
  startDate: string;
  startMonthKey: string;
};

export type CardStatement = {
  id: string;
  cardId: string;
  statementMonthKey: string;
  status: "open" | "paid";
  paidAt?: unknown;
  paidTxId?: string;
};

export type StatementPayment = {
  id: string;
  cardId: string;
  statementMonthKey: string;
  paidAt: string;
  paidAmountCents: number;
  paymentTxId?: string;
  snapshotTotalCents: number;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UserProfile = {
  id: string;
  uid: string;
  email?: string;
  createdAt?: unknown;
  lastSeenAt?: unknown;
};

export type BackupDoc = {
  id: string;
  data: Record<string, unknown>;
};

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  appVersion?: string;
  userProfile: BackupDoc | null;
  collections: Record<string, BackupDoc[]>;
};

export type BackupProgress = {
  stage: "read" | "write" | "delete";
  collection: string;
  processed: number;
};

export type PlannedRecurringItem = {
  kind: "recurring";
  id: string;
  ruleId: string;
  name: string;
  direction: Direction;
  amountCents: number;
  categoryId: string;
  monthKey: string;
  plannedDate: string;
};

export type PlannedInstallmentItem = {
  kind: "installment";
  id: string;
  planId: string;
  name: string;
  direction: "expense";
  amountCents: number;
  categoryId: string;
  monthKey: string;
  plannedDate: string;
  cardId: string;
  statementMonthKey: string;
  installmentNumber: number;
  installmentsTotal: number;
};

export type PlannedItem = PlannedRecurringItem | PlannedInstallmentItem;

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
  type: TransactionType;
  kind?: Direction;
  paymentMethod: PaymentMethod;
  amountCents: number;
  date: string;
  invoiceMonthKey?: string;
  categoryId?: string;
  description?: string;
  name?: string;
  notes?: string;
  paymentKind?: PaymentKind;
  importSessionId?: string;
  importFileName?: string;
  idempotencyKey?: string;
  documentNumber?: string;
  cardId?: string;
  statementMonthKey?: string;
  installmentGroupId?: string;
  installmentIndex?: number;
  installmentCount?: number;
  installmentTotal?: number;
  installmentPlanId?: string;
  installmentNumber?: number;
  installmentsTotal?: number;
  paidAt?: string;
  paidByStatementId?: string;
  isProjected?: boolean;
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

type CardInput = {
  name: string;
  closingDay: number;
  dueDay: number;
  limitCents?: number;
};

type InstallmentPlanInput = {
  cardId: string;
  categoryId: string;
  description?: string;
  totalCents: number;
  installments: number;
  startDate: string;
  startMonthKey: string;
};

const categoriesCollection = (uid: string) =>
  collection(db, "users", uid, "categories");

const merchantCategoryRulesCollection = (uid: string) =>
  collection(db, "users", uid, "merchantCategoryRules");

const transactionsCollection = (uid: string) =>
  collection(db, "users", uid, "transactions");

const budgetsCollection = (uid: string) => collection(db, "users", uid, "budgets");

const recurringRulesCollection = (uid: string) =>
  collection(db, "users", uid, "recurringRules");

const cardsCollection = (uid: string) => collection(db, "users", uid, "cards");

const installmentPlansCollection = (uid: string) =>
  collection(db, "users", uid, "installmentPlans");

const cardStatementsCollection = (uid: string) =>
  collection(db, "users", uid, "cardStatements");

const statementsCollection = (uid: string) => collection(db, "users", uid, "statements");

const usersCollection = () => collection(db, "users");

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

const mapTransactionSnapshot = (
  item: QueryDocumentSnapshot<DocumentData>
): Transaction => {
  const data = item.data();
  const rawType =
    (data.type as TransactionType) ?? (data.direction as Direction) ?? "expense";
  const rawPaymentMethod =
    (data.paymentMethod as PaymentMethod) ?? (data.cardId ? "card" : "cash");

  return {
    id: item.id,
    type: rawType,
    kind: (data.kind as Direction) ?? undefined,
    paymentMethod: rawPaymentMethod,
    amountCents: (data.amountCents as number) ?? 0,
    date: (data.date as string) ?? "",
    monthKey: (data.monthKey as string) ?? "",
    invoiceMonthKey:
      (data.invoiceMonthKey as string) ??
      (data.statementMonthKey as string) ??
      undefined,
    categoryId: (data.categoryId as string) ?? "",
    description: (data.description as string) ?? "",
    name: (data.name as string) ?? "",
    notes: (data.notes as string) ?? "",
    paymentKind: (data.paymentKind as PaymentKind) ?? undefined,
    cardId: (data.cardId as string) ?? undefined,
    statementMonthKey: (data.statementMonthKey as string) ?? undefined,
    installmentGroupId: (data.installmentGroupId as string) ?? undefined,
    installmentIndex: (data.installmentIndex as number) ?? undefined,
    installmentCount: (data.installmentCount as number) ?? undefined,
    installmentTotal: (data.installmentTotal as number) ?? undefined,
    installmentPlanId: (data.installmentPlanId as string) ?? undefined,
    installmentNumber: (data.installmentNumber as number) ?? undefined,
    installmentsTotal: (data.installmentsTotal as number) ?? undefined,
    paidAt: (data.paidAt as string) ?? undefined,
    paidByStatementId: (data.paidByStatementId as string) ?? undefined,
    isProjected: (data.isProjected as boolean) ?? undefined,
    sourceType: data.sourceType as TransactionSourceType | undefined,
    sourceRuleId: (data.sourceRuleId as string) ?? undefined,
    plannedDate: (data.plannedDate as string) ?? undefined,
  };
};

const BACKUP_SCHEMA_VERSION = 1;
const READ_PAGE_SIZE = 400;
const WRITE_BATCH_SIZE = 450;

const ADMIN_COLLECTIONS = [
  "categories",
  "merchantCategoryRules",
  "transactions",
  "budgets",
  "recurringRules",
  "cards",
  "statements",
  "installmentPlans",
  "cardStatements",
];

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

export const seedDefaultCategories = async (uid: string) => {
  ensureUid(uid);
  const path = `users/${uid}/categories`;
  const batch = writeBatch(db);

  DEFAULT_CATEGORY_SEED.forEach((category) => {
    const ref = doc(categoriesCollection(uid), category.id);
    batch.set(
      ref,
      {
        name: category.name.trim(),
        type: category.type,
        order: category.order,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error("[firestore] seedDefaultCategories", { uid, path, error });
    throw error;
  }
};

export const listMerchantCategoryRules = (
  uid: string,
  onChange: (items: MerchantCategoryRule[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/merchantCategoryRules`;

  logDev("[firestore] listMerchantCategoryRules", { uid, path });

  const rulesQuery = query(merchantCategoryRulesCollection(uid));

  return onSnapshot(
    rulesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          merchantKey: item.id,
          categoryId: (data.categoryId as string) ?? "",
        };
      });
      onChange(items);
    },
    (error) => {
      console.error("[firestore] listMerchantCategoryRules", { uid, path, error });
      onError?.(error);
    }
  );
};

export const upsertMerchantCategoryRule = async (
  uid: string,
  merchantKey: string,
  categoryId: string
) => {
  ensureUid(uid);
  const path = `users/${uid}/merchantCategoryRules/${merchantKey}`;
  const payload = {
    merchantKey,
    categoryId,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  try {
    return await setDoc(
      doc(merchantCategoryRulesCollection(uid), merchantKey),
      payload,
      { merge: true }
    );
  } catch (error) {
    console.error("[firestore] upsertMerchantCategoryRule", {
      uid,
      path,
      merchantKey,
      error,
    });
    throw error;
  }
};

export const listCards = (
  uid: string,
  archived: boolean,
  onChange: (items: Card[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/cards`;

  logDev("[firestore] listCards", { uid, path, archived });

  const cardsQuery = query(cardsCollection(uid), where("archived", "==", archived));

  return onSnapshot(
    cardsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: (data.name as string) ?? "",
            closingDay: (data.closingDay as number) ?? 1,
            dueDay: (data.dueDay as number) ?? 1,
            limitCents: (data.limitCents as number) ?? undefined,
            archived: (data.archived as boolean) ?? false,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listCards", { uid, path, archived, error });
      onError?.(error);
    }
  );
};

export const createCard = async (uid: string, data: CardInput) => {
  ensureUid(uid);
  const path = `users/${uid}/cards`;
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    closingDay: data.closingDay,
    dueDay: data.dueDay,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (data.limitCents !== undefined) {
    payload.limitCents = data.limitCents;
  }

  try {
    return await addDoc(cardsCollection(uid), payload);
  } catch (error) {
    console.error("[firestore] createCard", { uid, path, error });
    throw error;
  }
};

export const updateCard = async (uid: string, cardId: string, data: CardInput) => {
  ensureUid(uid);
  const path = `users/${uid}/cards/${cardId}`;
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    closingDay: data.closingDay,
    dueDay: data.dueDay,
    updatedAt: serverTimestamp(),
  };

  if (data.limitCents !== undefined) {
    payload.limitCents = data.limitCents;
  } else {
    payload.limitCents = deleteField();
  }

  try {
    return await updateDoc(doc(cardsCollection(uid), cardId), payload);
  } catch (error) {
    console.error("[firestore] updateCard", { uid, path, error });
    throw error;
  }
};

export const archiveCard = async (
  uid: string,
  cardId: string,
  archived: boolean
) => {
  ensureUid(uid);
  const path = `users/${uid}/cards/${cardId}`;

  try {
    return await updateDoc(doc(cardsCollection(uid), cardId), {
      archived,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[firestore] archiveCard", { uid, path, archived, error });
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
      const items = snapshot.docs.map(mapTransactionSnapshot);

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
    type: data.type,
    paymentMethod: data.paymentMethod,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    description: data.description?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const resolvedKind =
    data.kind ?? (data.type === "income" || data.type === "expense" ? data.type : undefined);
  if (resolvedKind) {
    payload.kind = resolvedKind;
  }

  if (data.name) {
    payload.name = data.name.trim();
  }
  if (data.notes) {
    payload.notes = data.notes.trim();
  }
  if (data.paymentKind) {
    payload.paymentKind = data.paymentKind;
  }
  if (data.installmentGroupId) {
    payload.installmentGroupId = data.installmentGroupId;
  }
  if (data.installmentIndex) {
    payload.installmentIndex = data.installmentIndex;
  }
  if (data.installmentCount) {
    payload.installmentCount = data.installmentCount;
  }
  if (data.installmentTotal) {
    payload.installmentTotal = data.installmentTotal;
  }
  if (data.categoryId) {
    payload.categoryId = data.categoryId;
  }
  if (data.cardId) {
    payload.cardId = data.cardId;
  }
  if (data.statementMonthKey) {
    payload.statementMonthKey = data.statementMonthKey;
  }
  if (data.invoiceMonthKey) {
    payload.invoiceMonthKey = data.invoiceMonthKey;
  } else if (data.statementMonthKey) {
    payload.invoiceMonthKey = data.statementMonthKey;
  }
  if (data.paidAt) {
    payload.paidAt = data.paidAt;
  }
  if (data.paidByStatementId) {
    payload.paidByStatementId = data.paidByStatementId;
  }
  if (data.installmentPlanId) {
    payload.installmentPlanId = data.installmentPlanId;
  }
  if (data.installmentNumber) {
    payload.installmentNumber = data.installmentNumber;
  }
  if (data.installmentsTotal) {
    payload.installmentsTotal = data.installmentsTotal;
  }
  if (data.isProjected !== undefined) {
    payload.isProjected = data.isProjected;
  }
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
    type: data.type,
    paymentMethod: data.paymentMethod,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    description: data.description?.trim() || "",
    updatedAt: serverTimestamp(),
  };

  const resolvedKind =
    data.kind ?? (data.type === "income" || data.type === "expense" ? data.type : undefined);
  payload.kind = resolvedKind ? resolvedKind : deleteField();

  if (data.name !== undefined) {
    payload.name = data.name ? data.name.trim() : deleteField();
  }
  if (data.notes !== undefined) {
    payload.notes = data.notes ? data.notes.trim() : deleteField();
  }
  if (data.paymentKind !== undefined) {
    payload.paymentKind = data.paymentKind ? data.paymentKind : deleteField();
  }
  if (data.installmentGroupId !== undefined) {
    payload.installmentGroupId = data.installmentGroupId
      ? data.installmentGroupId
      : deleteField();
  }
  if (data.installmentIndex !== undefined) {
    payload.installmentIndex =
      data.installmentIndex !== undefined ? data.installmentIndex : deleteField();
  }
  if (data.installmentCount !== undefined) {
    payload.installmentCount =
      data.installmentCount !== undefined ? data.installmentCount : deleteField();
  }
  if (data.installmentTotal !== undefined) {
    payload.installmentTotal =
      data.installmentTotal !== undefined ? data.installmentTotal : deleteField();
  }
  if (data.categoryId) {
    payload.categoryId = data.categoryId;
  } else {
    payload.categoryId = deleteField();
  }
  if (data.cardId) {
    payload.cardId = data.cardId;
  } else {
    payload.cardId = deleteField();
  }
  if (data.statementMonthKey) {
    payload.statementMonthKey = data.statementMonthKey;
  } else {
    payload.statementMonthKey = deleteField();
  }
  if (data.invoiceMonthKey !== undefined) {
    payload.invoiceMonthKey = data.invoiceMonthKey
      ? data.invoiceMonthKey
      : deleteField();
  } else if (data.statementMonthKey !== undefined) {
    payload.invoiceMonthKey = data.statementMonthKey
      ? data.statementMonthKey
      : deleteField();
  }
  if (data.paidAt !== undefined) {
    payload.paidAt = data.paidAt ? data.paidAt : deleteField();
  }
  if (data.paidByStatementId !== undefined) {
    payload.paidByStatementId = data.paidByStatementId
      ? data.paidByStatementId
      : deleteField();
  }
  if (data.installmentPlanId) {
    payload.installmentPlanId = data.installmentPlanId;
  } else {
    payload.installmentPlanId = deleteField();
  }
  if (data.installmentNumber) {
    payload.installmentNumber = data.installmentNumber;
  } else {
    payload.installmentNumber = deleteField();
  }
  if (data.installmentsTotal) {
    payload.installmentsTotal = data.installmentsTotal;
  } else {
    payload.installmentsTotal = deleteField();
  }
  if (data.isProjected !== undefined) {
    payload.isProjected = data.isProjected;
  }
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

export const listCardTransactionsByStatement = (
  uid: string,
  cardId: string,
  statementMonthKey: string,
  onChange: (items: Transaction[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;

  logDev("[firestore] listCardTransactionsByStatement", {
    uid,
    path,
    cardId,
    statementMonthKey,
  });

  const invoiceQuery = query(
    transactionsCollection(uid),
    where("cardId", "==", cardId),
    where("invoiceMonthKey", "==", statementMonthKey),
    where("paymentMethod", "==", "card"),
    orderBy("date", "desc")
  );

  const legacyQuery = query(
    transactionsCollection(uid),
    where("cardId", "==", cardId),
    where("statementMonthKey", "==", statementMonthKey),
    where("paymentMethod", "==", "card"),
    orderBy("date", "desc")
  );

  let invoiceItems: Transaction[] = [];
  let legacyItems: Transaction[] = [];

  const mergeAndNotify = () => {
    const merged = new Map<string, Transaction>();
    invoiceItems.forEach((item) => merged.set(item.id, item));
    legacyItems.forEach((item) => {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    });
    const items = Array.from(merged.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    onChange(items);
  };

  const handleError = (error: unknown) => {
    console.error("[firestore] listCardTransactionsByStatement", {
      uid,
      path,
      cardId,
      statementMonthKey,
      error,
    });
    onError?.(error);
  };

  const unsubscribeInvoice = onSnapshot(
    invoiceQuery,
    (snapshot) => {
      invoiceItems = snapshot.docs.map(mapTransactionSnapshot);
      mergeAndNotify();
    },
    handleError
  );

  const unsubscribeLegacy = onSnapshot(
    legacyQuery,
    (snapshot) => {
      legacyItems = snapshot.docs.map(mapTransactionSnapshot);
      mergeAndNotify();
    },
    handleError
  );

  return () => {
    unsubscribeInvoice();
    unsubscribeLegacy();
  };
};

export const listCardTransactionsByStatementMonth = (
  uid: string,
  statementMonthKey: string,
  onChange: (items: Transaction[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;

  logDev("[firestore] listCardTransactionsByStatementMonth", {
    uid,
    path,
    statementMonthKey,
  });

  const invoiceQuery = query(
    transactionsCollection(uid),
    where("invoiceMonthKey", "==", statementMonthKey),
    where("paymentMethod", "==", "card")
  );

  const legacyQuery = query(
    transactionsCollection(uid),
    where("statementMonthKey", "==", statementMonthKey),
    where("paymentMethod", "==", "card")
  );

  let invoiceItems: Transaction[] = [];
  let legacyItems: Transaction[] = [];

  const mergeAndNotify = () => {
    const merged = new Map<string, Transaction>();
    invoiceItems.forEach((item) => merged.set(item.id, item));
    legacyItems.forEach((item) => {
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    });
    onChange(Array.from(merged.values()));
  };

  const handleError = (error: unknown) => {
    console.error("[firestore] listCardTransactionsByStatementMonth", {
      uid,
      path,
      statementMonthKey,
      error,
    });
    onError?.(error);
  };

  const unsubscribeInvoice = onSnapshot(
    invoiceQuery,
    (snapshot) => {
      invoiceItems = snapshot.docs.map(mapTransactionSnapshot);
      mergeAndNotify();
    },
    handleError
  );

  const unsubscribeLegacy = onSnapshot(
    legacyQuery,
    (snapshot) => {
      legacyItems = snapshot.docs.map(mapTransactionSnapshot);
      mergeAndNotify();
    },
    handleError
  );

  return () => {
    unsubscribeInvoice();
    unsubscribeLegacy();
  };
};

const fetchStatementTransactionDocs = async (
  uid: string,
  cardId: string,
  statementMonthKey: string
) => {
  const invoiceQuery = query(
    transactionsCollection(uid),
    where("cardId", "==", cardId),
    where("invoiceMonthKey", "==", statementMonthKey),
    where("paymentMethod", "==", "card")
  );

  const legacyQuery = query(
    transactionsCollection(uid),
    where("cardId", "==", cardId),
    where("statementMonthKey", "==", statementMonthKey),
    where("paymentMethod", "==", "card")
  );

  const [invoiceSnap, legacySnap] = await Promise.all([
    getDocs(invoiceQuery),
    getDocs(legacyQuery),
  ]);

  const merged = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  invoiceSnap.docs.forEach((docSnap) => merged.set(docSnap.id, docSnap));
  legacySnap.docs.forEach((docSnap) => {
    if (!merged.has(docSnap.id)) {
      merged.set(docSnap.id, docSnap);
    }
  });

  return Array.from(merged.values());
};

export const fetchStatementTotal = async (
  uid: string,
  cardId: string,
  statementMonthKey: string
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;

  logDev("[firestore] fetchStatementTotal", { uid, path, cardId, statementMonthKey });

  const docs = await fetchStatementTransactionDocs(uid, cardId, statementMonthKey);
  return docs.reduce((sum, item) => {
    const data = item.data();
    const rawType =
      (data.type as TransactionType) ??
      (data.direction as Direction) ??
      "expense";
    const amount = (data.amountCents as number) ?? 0;
    if (rawType === "income") {
      return sum - amount;
    }
    if (rawType === "expense") {
      return sum + amount;
    }
    return sum;
  }, 0);
};

export const createCardExpenseWithInstallments = async (
  uid: string,
  base: {
    amountCents: number;
    date: string;
    categoryId: string;
    description?: string;
  },
  card: Card,
  installmentsCount: number
) => {
  ensureUid(uid);
  if (installmentsCount <= 1) {
    throw new Error("installmentsCount must be greater than 1");
  }

  const groupId = doc(transactionsCollection(uid)).id;
  const amounts = splitCentsEven(base.amountCents, installmentsCount);
  const batch = writeBatch(db);
  const ids: string[] = [];

  for (let index = 0; index < installmentsCount; index += 1) {
    const installmentIndex = index + 1;
    const installmentDate = addMonthsToDateISO(base.date, index);
    const monthKey = getMonthKeyFromDateISO(installmentDate);
    const statementMonthKey = getStatementMonthKey(
      installmentDate,
      card.closingDay
    );
    const ref = doc(transactionsCollection(uid));
    ids.push(ref.id);

    batch.set(ref, {
      type: "expense",
      kind: "expense",
      paymentMethod: "card",
      amountCents: amounts[index] ?? 0,
      date: installmentDate,
      monthKey,
      categoryId: base.categoryId,
      description: base.description?.trim() || "",
      cardId: card.id,
      statementMonthKey,
      invoiceMonthKey: statementMonthKey,
      installmentGroupId: groupId,
      installmentIndex,
      installmentCount: installmentsCount,
      installmentTotal: installmentsCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return { groupId, transactionIds: ids };
};

export const markStatementItemsPaid = async (
  uid: string,
  cardId: string,
  statementMonthKey: string,
  paidAt: string,
  statementId: string
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;
  const docs = await fetchStatementTransactionDocs(uid, cardId, statementMonthKey);
  const chunkSize = 300;

  logDev("[firestore] markStatementItemsPaid", {
    uid,
    path,
    cardId,
    statementMonthKey,
    total: docs.length,
  });

  for (let start = 0; start < docs.length; start += chunkSize) {
    const batch = writeBatch(db);
    const slice = docs.slice(start, start + chunkSize);
    slice.forEach((item) => {
      batch.update(item.ref, {
        paidAt,
        paidByStatementId: statementId,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return docs.length;
};

export const clearStatementItemsPaid = async (
  uid: string,
  cardId: string,
  statementMonthKey: string
) => {
  ensureUid(uid);
  const path = `users/${uid}/transactions`;
  const docs = await fetchStatementTransactionDocs(uid, cardId, statementMonthKey);
  const chunkSize = 300;

  logDev("[firestore] clearStatementItemsPaid", {
    uid,
    path,
    cardId,
    statementMonthKey,
    total: docs.length,
  });

  for (let start = 0; start < docs.length; start += chunkSize) {
    const batch = writeBatch(db);
    const slice = docs.slice(start, start + chunkSize);
    slice.forEach((item) => {
      batch.update(item.ref, {
        paidAt: deleteField(),
        paidByStatementId: deleteField(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return docs.length;
};

export const createInstallmentPlan = async (
  uid: string,
  data: InstallmentPlanInput
) => {
  ensureUid(uid);
  const path = `users/${uid}/installmentPlans`;
  const payload = {
    cardId: data.cardId,
    categoryId: data.categoryId,
    description: data.description?.trim() || "",
    totalCents: data.totalCents,
    installments: data.installments,
    startDate: data.startDate,
    startMonthKey: data.startMonthKey,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(installmentPlansCollection(uid), payload);
  } catch (error) {
    console.error("[firestore] createInstallmentPlan", { uid, path, error });
    throw error;
  }
};

export const listInstallmentPlans = (
  uid: string,
  onChange: (items: InstallmentPlan[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const path = `users/${uid}/installmentPlans`;

  logDev("[firestore] listInstallmentPlans", { uid, path });

  const plansQuery = query(installmentPlansCollection(uid), orderBy("createdAt", "desc"));

  return onSnapshot(
    plansQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          cardId: (data.cardId as string) ?? "",
          categoryId: (data.categoryId as string) ?? "",
          description: (data.description as string) ?? "",
          totalCents: (data.totalCents as number) ?? 0,
          installments: (data.installments as number) ?? 1,
          startDate: (data.startDate as string) ?? "",
          startMonthKey: (data.startMonthKey as string) ?? "",
        };
      });

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listInstallmentPlans", { uid, path, error });
      onError?.(error);
    }
  );
};

export const listenCardStatement = (
  uid: string,
  cardId: string,
  statementMonthKey: string,
  onChange: (statement: CardStatement | null) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(uid);
  const statementId = `${cardId}_${statementMonthKey}`;
  const path = `users/${uid}/cardStatements/${statementId}`;

  logDev("[firestore] listenCardStatement", {
    uid,
    path,
    cardId,
    statementMonthKey,
  });

  return onSnapshot(
    doc(cardStatementsCollection(uid), statementId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }

      const data = snapshot.data();
      onChange({
        id: snapshot.id,
        cardId: (data.cardId as string) ?? cardId,
        statementMonthKey:
          (data.statementMonthKey as string) ?? statementMonthKey,
        status: (data.status as "open" | "paid") ?? "open",
        paidAt: data.paidAt,
        paidTxId: (data.paidTxId as string) ?? undefined,
      });
    },
    (error) => {
      console.error("[firestore] listenCardStatement", {
        uid,
        path,
        cardId,
        statementMonthKey,
        error,
      });
      onError?.(error);
    }
  );
};

const getStatementPaymentId = (cardId: string, statementMonthKey: string) =>
  `${cardId}_${statementMonthKey}`;

export const getStatementPaymentDocRef = (
  uid: string,
  cardId: string,
  statementMonthKey: string
) => {
  ensureUid(uid);
  return doc(statementsCollection(uid), getStatementPaymentId(cardId, statementMonthKey));
};

export const listenStatementPayment = (
  uid: string,
  cardId: string,
  statementMonthKey: string,
  onChange: (payment: StatementPayment | null) => void,
  onError?: (error: unknown) => void
) => {
  const ref = getStatementPaymentDocRef(uid, cardId, statementMonthKey);
  const path = `users/${uid}/statements/${getStatementPaymentId(
    cardId,
    statementMonthKey
  )}`;

  logDev("[firestore] listenStatementPayment", {
    uid,
    path,
    cardId,
    statementMonthKey,
  });

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }

      const data = snapshot.data();
      const snapshotTotal =
        (data.snapshotTotalCents as number) ??
        (data.totalCentsSnapshot as number) ??
        0;
      const paymentTxId =
        (data.paymentTxId as string) ??
        (data.paymentTransactionId as string) ??
        undefined;
      onChange({
        id: snapshot.id,
        cardId: (data.cardId as string) ?? cardId,
        statementMonthKey:
          (data.statementMonthKey as string) ?? statementMonthKey,
        paidAt: (data.paidAt as string) ?? "",
        paidAmountCents: (data.paidAmountCents as number) ?? snapshotTotal,
        paymentTxId,
        snapshotTotalCents: snapshotTotal,
        notes: (data.notes as string) ?? "",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    },
    (error) => {
      console.error("[firestore] listenStatementPayment", {
        uid,
        path,
        cardId,
        statementMonthKey,
        error,
      });
      onError?.(error);
    }
  );
};

export const upsertStatementPayment = async (
  uid: string,
  cardId: string,
  statementMonthKey: string,
  payload: {
    paidAt: string;
    paidAmountCents: number;
    paymentTxId: string;
    snapshotTotalCents: number;
    notes?: string;
  }
) => {
  ensureUid(uid);
  const ref = getStatementPaymentDocRef(uid, cardId, statementMonthKey);
  const path = `users/${uid}/statements/${getStatementPaymentId(
    cardId,
    statementMonthKey
  )}`;
  const data: Record<string, unknown> = {
    cardId,
    statementMonthKey,
    paidAt: payload.paidAt,
    paidAmountCents: payload.paidAmountCents,
    paymentTxId: payload.paymentTxId,
    snapshotTotalCents: payload.snapshotTotalCents,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  if (payload.notes) {
    data.notes = payload.notes.trim();
  }

  try {
    return await setDoc(ref, data, { merge: true });
  } catch (error) {
    console.error("[firestore] upsertStatementPayment", {
      uid,
      path,
      cardId,
      statementMonthKey,
      error,
    });
    throw error;
  }
};

export const deleteStatementPayment = async (
  uid: string,
  cardId: string,
  statementMonthKey: string
) => {
  ensureUid(uid);
  const ref = getStatementPaymentDocRef(uid, cardId, statementMonthKey);
  const path = `users/${uid}/statements/${getStatementPaymentId(
    cardId,
    statementMonthKey
  )}`;

  try {
    return await deleteDoc(ref);
  } catch (error) {
    console.error("[firestore] deleteStatementPayment", {
      uid,
      path,
      cardId,
      statementMonthKey,
      error,
    });
    throw error;
  }
};

export const setCardStatementPaid = async (
  uid: string,
  cardId: string,
  statementMonthKey: string,
  paidTxId: string
) => {
  ensureUid(uid);
  const statementId = `${cardId}_${statementMonthKey}`;
  const path = `users/${uid}/cardStatements/${statementId}`;
  const payload = {
    cardId,
    statementMonthKey,
    status: "paid",
    paidAt: serverTimestamp(),
    paidTxId,
    updatedAt: serverTimestamp(),
  };

  try {
    return await setDoc(doc(cardStatementsCollection(uid), statementId), payload, {
      merge: true,
    });
  } catch (error) {
    console.error("[firestore] setCardStatementPaid", {
      uid,
      path,
      cardId,
      statementMonthKey,
      error,
    });
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

export const upsertUserProfile = async (
  uid: string,
  email: string | null | undefined
) => {
  ensureUid(uid);
  const path = `users/${uid}`;
  const payload = {
    uid,
    email: email ?? "",
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  try {
    return await setDoc(doc(usersCollection(), uid), payload, { merge: true });
  } catch (error) {
    console.error("[firestore] upsertUserProfile", { uid, path, error });
    throw error;
  }
};

export const listUserProfiles = (
  authUid: string,
  onChange: (items: UserProfile[]) => void,
  onError?: (error: unknown) => void
) => {
  ensureUid(authUid);
  const path = "users";

  logDev("[firestore] listUserProfiles", { authUid, path });

  const usersQuery = query(usersCollection(), orderBy("email", "asc"));

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          uid: (data.uid as string) ?? item.id,
          email: (data.email as string) ?? "",
          createdAt: data.createdAt,
          lastSeenAt: data.lastSeenAt,
        };
      });

      onChange(items);
    },
    (error) => {
      console.error("[firestore] listUserProfiles", { authUid, path, error });
      onError?.(error);
    }
  );
};

const isSafeCollectionName = (value: string) => /^[a-zA-Z0-9_-]+$/.test(value);

const serializeFirestoreValue = (value: unknown): unknown => {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      result[key] = serializeFirestoreValue(item);
    });
    return result;
  }

  return value;
};

const serializeFirestoreData = (data: Record<string, unknown>) =>
  serializeFirestoreValue(data) as Record<string, unknown>;

const normalizeBackupDocs = (value: unknown): BackupDoc[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as BackupDoc;
        const id = record.id ? String(record.id) : "";
        const data =
          record.data && typeof record.data === "object"
            ? (record.data as Record<string, unknown>)
            : {};
        return id ? { id, data } : null;
      })
      .filter((item): item is BackupDoc => Boolean(item));
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([id, data]) => {
        if (!id) {
          return null;
        }
        const normalized =
          data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        return { id, data: normalized };
      })
      .filter((item): item is BackupDoc => Boolean(item));
  }

  return [];
};

const paginateCollectionDocs = async (
  uid: string,
  collectionName: string,
  pageSize: number,
  onPage: (docs: QueryDocumentSnapshot<DocumentData>[]) => Promise<void>
) => {
  const colRef = collection(db, "users", uid, collectionName);
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  while (true) {
    const pageQuery: Query<DocumentData> = lastDoc
      ? query(colRef, orderBy("__name__"), startAfter(lastDoc), limit(pageSize))
      : query(colRef, orderBy("__name__"), limit(pageSize));
    const snapshot: QuerySnapshot<DocumentData> = await getDocs(pageQuery);
    if (snapshot.empty) {
      break;
    }
    await onPage(snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < pageSize) {
      break;
    }
  }
};

const readCollectionDocs = async (
  uid: string,
  collectionName: string,
  onProgress?: (progress: BackupProgress) => void
) => {
  const docs: BackupDoc[] = [];
  await paginateCollectionDocs(uid, collectionName, READ_PAGE_SIZE, async (page) => {
    page.forEach((docSnap) => {
      const data = serializeFirestoreData(
        docSnap.data() as Record<string, unknown>
      );
      docs.push({ id: docSnap.id, data });
    });
    onProgress?.({ stage: "read", collection: collectionName, processed: docs.length });
  });
  return docs;
};

const writeCollectionDocs = async (
  uid: string,
  collectionName: string,
  docs: BackupDoc[],
  merge: boolean,
  onProgress?: (progress: BackupProgress) => void
) => {
  if (docs.length === 0) {
    onProgress?.({ stage: "write", collection: collectionName, processed: 0 });
    return 0;
  }

  const colRef = collection(db, "users", uid, collectionName);
  let processed = 0;

  for (let i = 0; i < docs.length; i += WRITE_BATCH_SIZE) {
    const slice = docs.slice(i, i + WRITE_BATCH_SIZE);
    const batch = writeBatch(db);
    slice.forEach((item) => {
      if (!item.id) {
        return;
      }
      batch.set(doc(colRef, item.id), item.data ?? {}, { merge });
    });
    await batch.commit();
    processed += slice.length;
    onProgress?.({ stage: "write", collection: collectionName, processed });
  }

  return processed;
};

const deleteCollectionDocs = async (
  uid: string,
  collectionName: string,
  onProgress?: (progress: BackupProgress) => void
) => {
  let processed = 0;

  await paginateCollectionDocs(uid, collectionName, WRITE_BATCH_SIZE, async (page) => {
    const batch = writeBatch(db);
    page.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    processed += page.length;
    onProgress?.({ stage: "delete", collection: collectionName, processed });
  });

  return processed;
};

export const exportUserData = async (
  uid: string,
  options?: { onProgress?: (progress: BackupProgress) => void }
) => {
  ensureUid(uid);
  const onProgress = options?.onProgress;
  const profileSnap = await getDoc(doc(usersCollection(), uid));
  const userProfile = profileSnap.exists()
    ? {
        id: profileSnap.id,
        data: serializeFirestoreData(
          profileSnap.data() as Record<string, unknown>
        ),
      }
    : null;

  if (userProfile?.data) {
    userProfile.data = { ...userProfile.data, uid };
  }

  const collections: Record<string, BackupDoc[]> = {};
  for (const collectionName of ADMIN_COLLECTIONS) {
    collections[collectionName] = await readCollectionDocs(
      uid,
      collectionName,
      onProgress
    );
  }

  const appVersion = import.meta.env.VITE_APP_VERSION;

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion && appVersion.trim() ? appVersion : undefined,
    userProfile,
    collections,
  } satisfies BackupPayload;
};

export const restoreUserData = async (
  uid: string,
  payload: BackupPayload,
  options?: { onProgress?: (progress: BackupProgress) => void; merge?: boolean }
) => {
  ensureUid(uid);
  const onProgress = options?.onProgress;
  const merge = options?.merge ?? true;

  if (payload.userProfile?.data) {
    const profileData = { ...payload.userProfile.data, uid };
    await setDoc(doc(usersCollection(), uid), profileData, { merge });
  }

  const collections = payload.collections ?? {};
  const collectionNames = Object.keys(collections).filter(isSafeCollectionName);
  for (const collectionName of collectionNames) {
    const docs = normalizeBackupDocs(collections[collectionName]);
    await writeCollectionDocs(uid, collectionName, docs, merge, onProgress);
  }
};

export const wipeUserData = async (
  uid: string,
  options?: { onProgress?: (progress: BackupProgress) => void; includeProfile?: boolean }
) => {
  ensureUid(uid);
  const onProgress = options?.onProgress;

  for (const collectionName of ADMIN_COLLECTIONS) {
    await deleteCollectionDocs(uid, collectionName, onProgress);
  }

  if (options?.includeProfile) {
    await deleteDoc(doc(usersCollection(), uid));
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
): PlannedRecurringItem[] => {
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
        kind: "recurring",
        id,
        ruleId: rule.id,
        name: rule.name,
        direction: rule.direction,
        amountCents: rule.amountCents,
        categoryId: rule.categoryId,
        monthKey,
        plannedDate,
      } satisfies PlannedRecurringItem;
    })
    .filter((item) => !existingPlanned.has(`${item.ruleId}_${item.plannedDate}`));
};

export const buildInstallmentPlannedItems = (
  monthKey: string,
  plans: InstallmentPlan[],
  cards: Card[],
  existingTransactions: Transaction[]
): PlannedInstallmentItem[] => {
  const monthIndex = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    return year * 12 + month - 1;
  };

  const selectedIndex = monthIndex(monthKey);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const existingInstallments = new Set(
    existingTransactions
      .filter((transaction) => transaction.installmentPlanId)
      .map(
        (transaction) =>
          `${transaction.installmentPlanId}_${transaction.installmentNumber ?? 0}`
      )
  );

  return plans
    .filter((plan) => plan.installments > 0)
    .map((plan) => {
      const startIndex = monthIndex(plan.startMonthKey);
      const diff = selectedIndex - startIndex;
      if (diff < 0 || diff >= plan.installments) {
        return null;
      }

      const installmentNumber = diff + 1;
      const plannedDate = addMonthsToDateISO(plan.startDate, diff);
      const plannedMonthKey = getMonthKeyFromDateISO(plannedDate);

      if (plannedMonthKey !== monthKey) {
        return null;
      }

      if (existingInstallments.has(`${plan.id}_${installmentNumber}`)) {
        return null;
      }

      const card = cardsById.get(plan.cardId);
      const closingDay = card?.closingDay ?? 1;
      const statementMonthKey = getStatementMonthKey(plannedDate, closingDay);
      const amountCents = getInstallmentAmount(
        plan.totalCents,
        plan.installments,
        installmentNumber
      );
      return {
        kind: "installment",
        id: `${plan.id}_${installmentNumber}`,
        planId: plan.id,
        name: plan.description || "Compra parcelada",
        direction: "expense",
        amountCents,
        categoryId: plan.categoryId,
        monthKey,
        plannedDate,
        cardId: plan.cardId,
        statementMonthKey,
        installmentNumber,
        installmentsTotal: plan.installments,
      } satisfies PlannedInstallmentItem;
    })
    .filter((item): item is PlannedInstallmentItem => Boolean(item));
};
