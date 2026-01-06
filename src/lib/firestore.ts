import { FirebaseError } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export type Direction = "income" | "expense";

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
};

const categoriesCollection = (uid: string) =>
  collection(db, "users", uid, "categories");

const transactionsCollection = (uid: string) =>
  collection(db, "users", uid, "transactions");

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
  const payload = {
    direction: data.direction,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    categoryId: data.categoryId,
    description: data.description?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

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
  const payload = {
    direction: data.direction,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    categoryId: data.categoryId,
    description: data.description?.trim() || "",
    updatedAt: serverTimestamp(),
  };

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