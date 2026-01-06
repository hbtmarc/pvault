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

export const listCategories = (
  uid: string,
  archived: boolean,
  onChange: (items: Category[]) => void,
  onError?: (error: Error) => void
) => {
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
    onError
  );
};

export const createCategory = async (uid: string, data: CategoryInput) => {
  const payload = {
    name: data.name.trim(),
    type: data.type,
    order: data.order ?? 0,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(categoriesCollection(uid), payload);
};

export const updateCategory = async (
  uid: string,
  categoryId: string,
  data: CategoryInput
) => {
  const payload = {
    name: data.name.trim(),
    type: data.type,
    order: data.order ?? 0,
    updatedAt: serverTimestamp(),
  };

  return updateDoc(doc(categoriesCollection(uid), categoryId), payload);
};

export const archiveCategory = async (
  uid: string,
  categoryId: string,
  archived: boolean
) =>
  updateDoc(doc(categoriesCollection(uid), categoryId), {
    archived,
    updatedAt: serverTimestamp(),
  });

export const listTransactionsByMonth = (
  uid: string,
  monthKey: string,
  onChange: (items: Transaction[]) => void,
  onError?: (error: Error) => void
) => {
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
    onError
  );
};

export const createTransaction = async (uid: string, data: TransactionInput) => {
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

  return addDoc(transactionsCollection(uid), payload);
};

export const updateTransaction = async (
  uid: string,
  transactionId: string,
  data: TransactionInput
) => {
  const payload = {
    direction: data.direction,
    amountCents: data.amountCents,
    date: data.date,
    monthKey: data.date.slice(0, 7),
    categoryId: data.categoryId,
    description: data.description?.trim() || "",
    updatedAt: serverTimestamp(),
  };

  return updateDoc(doc(transactionsCollection(uid), transactionId), payload);
};

export const removeTransaction = (uid: string, transactionId: string) =>
  deleteDoc(doc(transactionsCollection(uid), transactionId));

export const getFirestoreErrorMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return "Ocorreu um erro inesperado. Tente novamente.";
  }

  switch (error.code) {
    case "permission-denied":
      return "Permissao negada. Verifique se voce esta autenticado.";
    case "unavailable":
      return "Servico indisponivel. Tente novamente em instantes.";
    case "not-found":
      return "Documento nao encontrado.";
    default:
      return "Nao foi possivel concluir a acao. Tente novamente.";
  }
};
