import { doc, writeBatch, type Firestore } from "firebase/firestore";
import type { Transaction } from "../lib/firestore";

const CHUNK_SIZE = 400;

type UpsertResult = {
  written: number;
  batches: number;
};

export const upsertTransactions = async (
  db: Firestore,
  uid: string,
  txs: Transaction[]
): Promise<UpsertResult> => {
  if (!uid) {
    throw new Error("uid is required to upsert transactions");
  }

  const total = txs.length;
  if (total === 0) {
    return { written: 0, batches: 0 };
  }

  const batches = Math.ceil(total / CHUNK_SIZE);
  let written = 0;

  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = txs.slice(start, start + CHUNK_SIZE);

    chunk.forEach((tx) => {
      const { id, ...payload } = tx;
      const ref = doc(db, "users", uid, "transactions", id);
      batch.set(ref, payload, { merge: true });
    });

    await batch.commit();
    written += chunk.length;
  }

  return { written, batches };
};
