import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email);

export const signOutUser = () => signOut(auth);

export const getAuthErrorMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return "Ocorreu um erro inesperado. Tente novamente.";
  }

  switch (error.code) {
    case "auth/invalid-email":
      return "E-mail invalido.";
    case "auth/user-not-found":
      return "Conta nao encontrada. Verifique o e-mail.";
    case "auth/wrong-password":
      return "Senha incorreta. Tente novamente.";
    case "auth/email-already-in-use":
      return "Este e-mail ja esta em uso.";
    case "auth/weak-password":
      return "Senha fraca. Use pelo menos 6 caracteres.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde e tente novamente.";
    default:
      return "Nao foi possivel completar a acao. Tente novamente.";
  }
};
