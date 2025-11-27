import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  createDocument as createFirebaseDoc,
  getUserDocuments,
  updateDocument as updateFirebaseDoc,
  deleteDocument as deleteFirebaseDoc,
  getUserPreferences,
  saveUserPreferences,
  setFirestoreAvailable,
  type FirebaseDocument,
} from "../lib/firebase";
import { useAuth } from "./AuthContext";

// Folder type for organizing documents
export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null means root level
  createdAt: number;
  isExpanded: boolean;
}

// Document type (simplified for the app)
export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  folderId: string | null; // null means root level
}

// Convert Firebase timestamp to number
const toTimestamp = (ts: any): number => {
  if (!ts) return Date.now();
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return Date.now();
};

// Convert FirebaseDocument to Document
const toDocument = (fbDoc: FirebaseDocument): Document => ({
  id: fbDoc.id,
  title: fbDoc.title,
  content: fbDoc.content,
  createdAt: toTimestamp(fbDoc.createdAt),
  updatedAt: toTimestamp(fbDoc.updatedAt),
  folderId: null, // Firebase docs default to root
});

// Generate a local document ID when offline
const generateLocalId = () =>
  `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Context type
interface DocumentContextType {
  documents: Document[];
  folders: Folder[];
  activeDocument: Document | null;
  activeDocId: string | null;
  isLoading: boolean;
  isOffline: boolean;
  createDocument: (folderId?: string | null) => Promise<Document | null>;
  updateDocument: (
    id: string,
    updates: Partial<Pick<Document, "title" | "content" | "folderId">>
  ) => void;
  deleteDocument: (id: string) => Promise<void>;
  setActiveDocument: (id: string) => void;
  getDocument: (id: string) => Document | undefined;
  refreshDocuments: () => Promise<void>;
  // Folder operations
  createFolder: (name: string, parentId?: string | null) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpanded: (id: string) => void;
  moveDocumentToFolder: (docId: string, folderId: string | null) => void;
  getDocumentsInFolder: (folderId: string | null) => Document[];
  getSubfolders: (parentId: string | null) => Folder[];
}

const DocumentContext = createContext<DocumentContextType | undefined>(
  undefined
);

// Generate a folder ID
const generateFolderId = () =>
  `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// LocalStorage keys for folder persistence
const getFoldersStorageKey = (userId: string) => `chronicle_folders_${userId}`;
const getDocFolderMapStorageKey = (userId: string) =>
  `chronicle_doc_folders_${userId}`;

// Save folders to localStorage
const saveFoldersToStorage = (userId: string, folders: Folder[]) => {
  try {
    localStorage.setItem(getFoldersStorageKey(userId), JSON.stringify(folders));
  } catch (error) {
    console.error("Failed to save folders to localStorage:", error);
  }
};

// Load folders from localStorage
const loadFoldersFromStorage = (userId: string): Folder[] => {
  try {
    const stored = localStorage.getItem(getFoldersStorageKey(userId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load folders from localStorage:", error);
  }
  return [];
};

// Save document-folder mapping to localStorage
const saveDocFolderMapToStorage = (userId: string, documents: Document[]) => {
  try {
    const mapping: Record<string, string | null> = {};
    documents.forEach((doc) => {
      mapping[doc.id] = doc.folderId;
    });
    localStorage.setItem(
      getDocFolderMapStorageKey(userId),
      JSON.stringify(mapping)
    );
  } catch (error) {
    console.error("Failed to save doc-folder mapping:", error);
  }
};

// Load document-folder mapping from localStorage
const loadDocFolderMapFromStorage = (
  userId: string
): Record<string, string | null> => {
  try {
    const stored = localStorage.getItem(getDocFolderMapStorageKey(userId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load doc-folder mapping:", error);
  }
  return {};
};

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const hasLoadedRef = useRef(false);

  // Pending updates for debounced saves
  const pendingUpdates = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Check if error is an offline error
  const isOfflineError = (error: unknown): boolean => {
    if (error instanceof Error) {
      return (
        error.message.includes("offline") ||
        error.message.includes("unavailable") ||
        error.message.includes("network")
      );
    }
    return false;
  };

  // Load documents from Firebase when user changes
  useEffect(() => {
    // Prevent multiple loads for the same user
    if (!user || !isAuthenticated) {
      setDocuments([]);
      setActiveDocId(null);
      setIsLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    // Skip if already loaded for this user
    if (hasLoadedRef.current) {
      return;
    }

    const loadDocuments = async () => {
      setIsLoading(true);
      hasLoadedRef.current = true;

      try {
        // Load folders from localStorage
        const storedFolders = loadFoldersFromStorage(user.uid);
        setFolders(storedFolders);

        // Load document-folder mapping from localStorage
        const docFolderMap = loadDocFolderMapFromStorage(user.uid);

        // Load documents
        const fbDocs = await getUserDocuments(user.uid);
        // Apply folder mapping to documents
        const docs = fbDocs.map(toDocument).map((doc) => ({
          ...doc,
          folderId: docFolderMap[doc.id] ?? null,
        }));
        setDocuments(docs);
        setIsOffline(false);
        setFirestoreAvailable(true);

        // Load user preferences (active doc, etc.)
        const prefs = await getUserPreferences(user.uid);
        if (
          prefs?.activeDocId &&
          docs.find((d) => d.id === prefs.activeDocId)
        ) {
          setActiveDocId(prefs.activeDocId);
        } else if (docs.length > 0) {
          setActiveDocId(docs[0].id);
        }

        // If no documents, create one
        if (docs.length === 0) {
          const newDocId = await createFirebaseDoc(user.uid);
          const newDoc: Document = {
            id: newDocId,
            title: "Untitled",
            content: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: null,
          };
          setDocuments([newDoc]);
          setActiveDocId(newDocId);
        }
      } catch (error) {
        console.error("Failed to load documents:", error);

        // If offline, create a local document so the user can work
        if (isOfflineError(error)) {
          console.warn("Firestore is offline. Creating local document.");
          setIsOffline(true);
          setFirestoreAvailable(false);

          const localDoc: Document = {
            id: generateLocalId(),
            title: "Untitled (Offline)",
            content: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: null,
          };
          setDocuments([localDoc]);
          setActiveDocId(localDoc.id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, [user?.uid, isAuthenticated]);

  // Save active doc ID to preferences when it changes
  useEffect(() => {
    if (user && activeDocId && !isOffline) {
      saveUserPreferences(user.uid, { activeDocId }).catch(console.error);
    }
  }, [user?.uid, activeDocId, isOffline]);

  // Save folders to localStorage whenever they change
  useEffect(() => {
    if (user && folders.length >= 0) {
      saveFoldersToStorage(user.uid, folders);
    }
  }, [user?.uid, folders]);

  // Save document-folder mapping to localStorage whenever documents change
  useEffect(() => {
    if (user && documents.length > 0) {
      saveDocFolderMapToStorage(user.uid, documents);
    }
  }, [user?.uid, documents]);

  // Get active document object
  const activeDocument = documents.find((d) => d.id === activeDocId) || null;

  // Create a new document
  const createDocument = useCallback(
    async (folderId: string | null = null): Promise<Document | null> => {
      console.log(
        "createDocument called, user:",
        user?.uid,
        "isAuthenticated:",
        isAuthenticated,
        "isOffline:",
        isOffline
      );

      if (!user) {
        console.error("Cannot create document: No user logged in");
        return null;
      }

      // If offline, create a local document
      if (isOffline) {
        console.log("Creating local document (offline mode)");
        const newDoc: Document = {
          id: generateLocalId(),
          title: "Untitled (Offline)",
          content: "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderId,
        };
        setDocuments((prev) => [newDoc, ...prev]);
        setActiveDocId(newDoc.id);
        return newDoc;
      }

      try {
        console.log("Creating Firebase document for user:", user.uid);
        const newDocId = await createFirebaseDoc(user.uid);
        console.log("Firebase document created with ID:", newDocId);

        const newDoc: Document = {
          id: newDocId,
          title: "Untitled",
          content: "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderId,
        };

        setDocuments((prev) => [newDoc, ...prev]);
        setActiveDocId(newDocId);
        return newDoc;
      } catch (error) {
        console.error("Failed to create document:", error);

        // Fall back to local document on error
        if (isOfflineError(error)) {
          setIsOffline(true);
          setFirestoreAvailable(false);

          const localDoc: Document = {
            id: generateLocalId(),
            title: "Untitled (Offline)",
            content: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId,
          };
          setDocuments((prev) => [localDoc, ...prev]);
          setActiveDocId(localDoc.id);
          return localDoc;
        }

        return null;
      }
    },
    [user, isAuthenticated, isOffline]
  );

  // Update a document (with debounce for content updates)
  const updateDocument = useCallback(
    (
      id: string,
      updates: Partial<Pick<Document, "title" | "content" | "folderId">>
    ) => {
      // Update local state immediately
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, ...updates, updatedAt: Date.now() } : doc
        )
      );

      // Skip Firebase sync if offline or local document
      if (isOffline || id.startsWith("local_")) {
        return;
      }

      // Clear existing timeout for this document
      const existing = pendingUpdates.current.get(id);
      if (existing) {
        clearTimeout(existing);
      }

      // Debounce Firebase update (500ms)
      const timeout = setTimeout(async () => {
        try {
          await updateFirebaseDoc(id, updates);
          pendingUpdates.current.delete(id);
        } catch (error) {
          console.error("Failed to save document:", error);
          if (isOfflineError(error)) {
            setIsOffline(true);
            setFirestoreAvailable(false);
          }
        }
      }, 500);

      pendingUpdates.current.set(id, timeout);
    },
    [isOffline]
  );

  // Delete a document
  const deleteDocument = useCallback(
    async (id: string) => {
      // For local docs or offline mode, just remove from state
      if (isOffline || id.startsWith("local_")) {
        setDocuments((prev) => {
          const newDocs = prev.filter((doc) => doc.id !== id);
          if (activeDocId === id) {
            const nextDoc = newDocs[0];
            setActiveDocId(nextDoc?.id || null);
          }
          return newDocs;
        });
        return;
      }

      try {
        await deleteFirebaseDoc(id);

        setDocuments((prev) => {
          const newDocs = prev.filter((doc) => doc.id !== id);
          // If we deleted the active doc, switch to another
          if (activeDocId === id) {
            const nextDoc = newDocs[0];
            setActiveDocId(nextDoc?.id || null);
          }
          return newDocs;
        });
      } catch (error) {
        console.error("Failed to delete document:", error);
      }
    },
    [activeDocId, isOffline]
  );

  // Set active document
  const setActiveDocument = useCallback((id: string) => {
    setActiveDocId(id);
  }, []);

  // Get a document by ID
  const getDocument = useCallback(
    (id: string) => documents.find((d) => d.id === id),
    [documents]
  );

  // Refresh documents from Firebase
  const refreshDocuments = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const fbDocs = await getUserDocuments(user.uid);
      const docs = fbDocs.map(toDocument);
      setDocuments(docs);

      if (docs.length > 0 && !docs.find((d) => d.id === activeDocId)) {
        setActiveDocId(docs[0].id);
      }
    } catch (error) {
      console.error("Failed to refresh documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeDocId]);

  // Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      pendingUpdates.current.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // ===== Folder Operations =====

  // Create a new folder
  const createFolder = useCallback(
    (name: string, parentId: string | null = null) => {
      const newFolder: Folder = {
        id: generateFolderId(),
        name,
        parentId,
        createdAt: Date.now(),
        isExpanded: true,
      };
      setFolders((prev) => [...prev, newFolder]);
    },
    []
  );

  // Rename a folder
  const renameFolder = useCallback((id: string, name: string) => {
    setFolders((prev) =>
      prev.map((folder) => (folder.id === id ? { ...folder, name } : folder))
    );
  }, []);

  // Delete a folder (moves documents to root, deletes subfolders recursively)
  const deleteFolder = useCallback(
    (id: string) => {
      // Get all subfolder IDs recursively
      const getAllSubfolderIds = (folderId: string): string[] => {
        const subfolders = folders.filter((f) => f.parentId === folderId);
        return subfolders.reduce(
          (acc, f) => [...acc, f.id, ...getAllSubfolderIds(f.id)],
          [] as string[]
        );
      };

      const folderIdsToDelete = [id, ...getAllSubfolderIds(id)];

      // Move documents in deleted folders to root
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.folderId && folderIdsToDelete.includes(doc.folderId)
            ? { ...doc, folderId: null }
            : doc
        )
      );

      // Delete the folders
      setFolders((prev) =>
        prev.filter((folder) => !folderIdsToDelete.includes(folder.id))
      );
    },
    [folders]
  );

  // Toggle folder expanded state
  const toggleFolderExpanded = useCallback((id: string) => {
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === id
          ? { ...folder, isExpanded: !folder.isExpanded }
          : folder
      )
    );
  }, []);

  // Move document to folder
  const moveDocumentToFolder = useCallback(
    (docId: string, folderId: string | null) => {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId ? { ...doc, folderId, updatedAt: Date.now() } : doc
        )
      );
    },
    []
  );

  // Get documents in a specific folder
  const getDocumentsInFolder = useCallback(
    (folderId: string | null) =>
      documents.filter((doc) => doc.folderId === folderId),
    [documents]
  );

  // Get subfolders of a parent
  const getSubfolders = useCallback(
    (parentId: string | null) =>
      folders.filter((folder) => folder.parentId === parentId),
    [folders]
  );

  return (
    <DocumentContext.Provider
      value={{
        documents,
        folders,
        activeDocument,
        activeDocId,
        isLoading,
        isOffline,
        createDocument,
        updateDocument,
        deleteDocument,
        setActiveDocument,
        getDocument,
        refreshDocuments,
        createFolder,
        renameFolder,
        deleteFolder,
        toggleFolderExpanded,
        moveDocumentToFolder,
        getDocumentsInFolder,
        getSubfolders,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = (): DocumentContextType => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocuments must be used within a DocumentProvider");
  }
  return context;
};
