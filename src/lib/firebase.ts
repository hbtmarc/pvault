import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/**
 * Firestore em rede corporativa:
 * - Alguns proxies/inspeções quebram o "stream" padrão do Firestore (WebChannel),
 *   causando erros 400 no /Write/channel.
 * - Forçar Long Polling tende a resolver.
 *
 * Controle via .env.local:
 *   VITE_FORCE_LONG_POLLING=1
 */
const forceLongPolling = import.meta.env.VITE_FORCE_LONG_POLLING === "1";

export const db = initializeFirestore(app, forceLongPolling
  ? {
      experimentalForceLongPolling: true,
    }
  : {
      experimentalAutoDetectLongPolling: true,
    }
);
