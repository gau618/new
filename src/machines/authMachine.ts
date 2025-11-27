import { setup, fromCallback, assign, fromPromise } from "xstate";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logOut,
  subscribeToAuthChanges,
  type User,
} from "../lib/firebase";

// Auth context type
interface AuthContext {
  user: User | null;
  error: string | null;
  isInitialized: boolean;
}

// Auth events
type AuthEvent =
  | { type: "AUTH_STATE_CHANGED"; user: User | null }
  | { type: "SIGN_IN_WITH_GOOGLE" }
  | { type: "SIGN_IN_WITH_EMAIL"; email: string; password: string }
  | {
      type: "SIGN_UP_WITH_EMAIL";
      email: string;
      password: string;
      name: string;
    }
  | { type: "SIGN_OUT" }
  | { type: "AUTH_SUCCESS"; user: User }
  | { type: "AUTH_ERROR"; error: string }
  | { type: "CLEAR_ERROR" };

export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
  },
  actors: {
    // Listen to Firebase auth state changes
    authStateListener: fromCallback(({ sendBack }) => {
      console.log("authStateListener actor starting...");
      const unsubscribe = subscribeToAuthChanges((user) => {
        console.log("authStateListener received user:", user?.email || null);
        sendBack({ type: "AUTH_STATE_CHANGED", user });
      });
      return () => {
        console.log("authStateListener cleanup");
        unsubscribe();
      };
    }),

    // Sign in with Google
    googleSignIn: fromPromise(async () => {
      const user = await signInWithGoogle();
      return user;
    }),

    // Sign in with email/password
    emailSignIn: fromPromise(
      async ({ input }: { input: { email: string; password: string } }) => {
        const user = await signInWithEmail(input.email, input.password);
        return user;
      }
    ),

    // Sign up with email/password
    emailSignUp: fromPromise(
      async ({
        input,
      }: {
        input: { email: string; password: string; name: string };
      }) => {
        const user = await signUpWithEmail(
          input.email,
          input.password,
          input.name
        );
        return user;
      }
    ),

    // Sign out
    signOutActor: fromPromise(async () => {
      await logOut();
    }),
  },
  actions: {
    setUser: assign({
      user: ({ event }) => {
        if (event.type === "AUTH_STATE_CHANGED") return event.user;
        if (event.type === "AUTH_SUCCESS") return event.user;
        return null;
      },
      isInitialized: true,
      error: null,
    }),
    clearUser: assign({
      user: null,
      error: null,
    }),
    setError: assign({
      error: ({ event }) => {
        if (event.type === "AUTH_ERROR") return event.error;
        return "An error occurred";
      },
    }),
    clearError: assign({
      error: null,
    }),
  },
  guards: {
    isAuthenticated: ({ context }) => context.user !== null,
  },
}).createMachine({
  id: "auth",
  initial: "initializing",
  context: {
    user: null,
    error: null,
    isInitialized: false,
  },
  states: {
    initializing: {
      invoke: {
        src: "authStateListener",
      },
      on: {
        AUTH_STATE_CHANGED: [
          {
            guard: ({ event }) => event.user !== null,
            target: "authenticated",
            actions: "setUser",
          },
          {
            target: "unauthenticated",
            actions: assign({ isInitialized: true }),
          },
        ],
      },
    },

    unauthenticated: {
      invoke: {
        src: "authStateListener",
      },
      on: {
        AUTH_STATE_CHANGED: [
          {
            guard: ({ event }) => event.user !== null,
            target: "authenticated",
            actions: "setUser",
          },
        ],
        SIGN_IN_WITH_GOOGLE: "signingInWithGoogle",
        SIGN_IN_WITH_EMAIL: "signingInWithEmail",
        SIGN_UP_WITH_EMAIL: "signingUp",
        CLEAR_ERROR: {
          actions: "clearError",
        },
      },
    },

    signingInWithGoogle: {
      invoke: {
        src: "googleSignIn",
        onDone: {
          target: "authenticated",
          actions: assign({
            user: ({ event }) => event.output,
            error: null,
          }),
        },
        onError: {
          target: "unauthenticated",
          actions: assign({
            error: ({ event }) => {
              const err = event.error as Error;
              // User cancelled - don't show an error
              if (
                err.message?.includes("popup-closed-by-user") ||
                err.message?.includes("cancelled-popup-request")
              ) {
                return null;
              }
              if (err.message?.includes("popup-blocked")) {
                return "Popup was blocked. Please allow popups for this site.";
              }
              return err.message || "Failed to sign in with Google";
            },
          }),
        },
      },
    },

    signingInWithEmail: {
      invoke: {
        src: "emailSignIn",
        input: ({ event }) => {
          if (event.type === "SIGN_IN_WITH_EMAIL") {
            return { email: event.email, password: event.password };
          }
          return { email: "", password: "" };
        },
        onDone: {
          target: "authenticated",
          actions: assign({
            user: ({ event }) => event.output,
            error: null,
          }),
        },
        onError: {
          target: "unauthenticated",
          actions: assign({
            error: ({ event }) => {
              const err = event.error as Error;
              // Provide user-friendly error messages
              if (
                err.message.includes("wrong-password") ||
                err.message.includes("user-not-found")
              ) {
                return "Invalid email or password";
              }
              if (err.message.includes("invalid-email")) {
                return "Invalid email address";
              }
              return err.message || "Failed to sign in";
            },
          }),
        },
      },
    },

    signingUp: {
      invoke: {
        src: "emailSignUp",
        input: ({ event }) => {
          if (event.type === "SIGN_UP_WITH_EMAIL") {
            return {
              email: event.email,
              password: event.password,
              name: event.name,
            };
          }
          return { email: "", password: "", name: "" };
        },
        onDone: {
          target: "authenticated",
          actions: assign({
            user: ({ event }) => event.output,
            error: null,
          }),
        },
        onError: {
          target: "unauthenticated",
          actions: assign({
            error: ({ event }) => {
              const err = event.error as Error;
              // Provide user-friendly error messages
              if (err.message.includes("email-already-in-use")) {
                return "An account with this email already exists";
              }
              if (err.message.includes("weak-password")) {
                return "Password should be at least 6 characters";
              }
              if (err.message.includes("invalid-email")) {
                return "Invalid email address";
              }
              return err.message || "Failed to create account";
            },
          }),
        },
      },
    },

    authenticated: {
      invoke: {
        src: "authStateListener",
      },
      on: {
        AUTH_STATE_CHANGED: [
          {
            guard: ({ event }) => event.user === null,
            target: "unauthenticated",
            actions: "clearUser",
          },
          {
            actions: "setUser",
          },
        ],
        SIGN_OUT: "signingOut",
      },
    },

    signingOut: {
      invoke: {
        src: "signOutActor",
        onDone: {
          target: "unauthenticated",
          actions: "clearUser",
        },
        onError: {
          target: "authenticated",
          actions: assign({
            error: ({ event }) => {
              const err = event.error as Error;
              return err.message || "Failed to sign out";
            },
          }),
        },
      },
    },
  },
});
