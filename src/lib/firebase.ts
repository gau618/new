import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  enableIndexedDbPersistence,
  type Timestamp,
} from "firebase/firestore";

// Firebase configuration
// Replace these with your actual Firebase project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id",
};

console.log("Firebase config:", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase app initialized:", app.name);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence for Firestore
// This allows the app to work offline and sync when back online
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.warn("Firestore persistence failed: multiple tabs open");
  } else if (err.code === "unimplemented") {
    // Browser doesn't support persistence
    console.warn("Firestore persistence not supported in this browser");
  }
});

// Track if Firestore is available
let firestoreAvailable = true;
export const isFirestoreAvailable = () => firestoreAvailable;
export const setFirestoreAvailable = (available: boolean) => {
  firestoreAvailable = available;
};

// Auth providers
const googleProvider = new GoogleAuthProvider();

// ============ Auth Functions ============

export const signInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const signInWithEmail = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Update profile with display name
  await updateProfile(result.user, { displayName });
  return result.user;
};

export const logOut = async () => {
  await signOut(auth);
};

export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
) => {
  console.log("Setting up auth state listener...");
  return onAuthStateChanged(auth, (user) => {
    console.log(
      "Auth state changed:",
      user ? `User: ${user.email}` : "No user"
    );
    callback(user);
  });
};

// ============ Document Types ============

export interface FirebaseDocument {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ============ Firestore Document Functions ============

const DOCUMENTS_COLLECTION = "documents";

export const createDocument = async (
  userId: string,
  title: string = "Untitled",
  content: string = ""
): Promise<string> => {
  const docRef = doc(collection(db, DOCUMENTS_COLLECTION));
  await setDoc(docRef, {
    title,
    content,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getUserDocuments = async (
  userId: string
): Promise<FirebaseDocument[]> => {
  console.log("[Firebase] Fetching documents for user:", userId);
  try {
    // Simple query without orderBy to avoid needing a composite index
    const q = query(
      collection(db, DOCUMENTS_COLLECTION),
      where("userId", "==", userId)
    );
    console.log("[Firebase] Query created, executing getDocs...");
    const snapshot = await getDocs(q);
    console.log("[Firebase] Got", snapshot.docs.length, "documents");
    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FirebaseDocument[];

    // Sort by updatedAt in memory (descending - newest first)
    return docs.sort((a, b) => {
      const aTime = a.updatedAt?.seconds || 0;
      const bTime = b.updatedAt?.seconds || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("[Firebase] Error fetching documents:", error);
    throw error;
  }
};

export const getDocumentById = async (
  docId: string
): Promise<FirebaseDocument | null> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as FirebaseDocument;
  }
  return null;
};

export const updateDocument = async (
  docId: string,
  updates: Partial<Pick<FirebaseDocument, "title" | "content">>
): Promise<void> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteDocument = async (docId: string): Promise<void> => {
  const docRef = doc(db, DOCUMENTS_COLLECTION, docId);
  await deleteDoc(docRef);
};

// ============ User Preferences ============

const PREFERENCES_COLLECTION = "userPreferences";

export interface UserPreferences {
  sidebarCollapsed: boolean;
  tone: string;
  activeDocId: string | null;
}

export const getUserPreferences = async (
  userId: string
): Promise<UserPreferences | null> => {
  const docRef = doc(db, PREFERENCES_COLLECTION, userId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return snapshot.data() as UserPreferences;
  }
  return null;
};

export const saveUserPreferences = async (
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<void> => {
  const docRef = doc(db, PREFERENCES_COLLECTION, userId);
  await setDoc(docRef, preferences, { merge: true });
};

export { type User };
