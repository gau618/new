import React, { createContext, useContext } from "react";
import { useMachine } from "@xstate/react";
import { authMachine } from "../machines/authMachine";
import type { User } from "../lib/firebase";

// Context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string, password: string) => void;
  signUpWithEmail: (email: string, password: string, name: string) => void;
  signOut: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, send] = useMachine(authMachine);
  console.log("Auth state:", state.value, state.context);

  const value: AuthContextType = {
    user: state.context.user,
    isAuthenticated: state.matches("authenticated"),
    isInitialized: state.context.isInitialized,
    isLoading:
      state.matches("signingInWithGoogle") ||
      state.matches("signingInWithEmail") ||
      state.matches("signingUp") ||
      state.matches("signingOut") ||
      state.matches("initializing"),
    error: state.context.error,
    signInWithGoogle: () => send({ type: "SIGN_IN_WITH_GOOGLE" }),
    signInWithEmail: (email: string, password: string) =>
      send({ type: "SIGN_IN_WITH_EMAIL", email, password }),
    signUpWithEmail: (email: string, password: string, name: string) =>
      send({ type: "SIGN_UP_WITH_EMAIL", email, password, name }),
    signOut: () => send({ type: "SIGN_OUT" }),
    clearError: () => send({ type: "CLEAR_ERROR" }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
