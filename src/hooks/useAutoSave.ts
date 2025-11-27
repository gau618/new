import { useState, useRef, useCallback, useEffect } from "react";

interface UseAutoSaveOptions {
  documentId: string | null;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onTitleSave?: (title: string) => Promise<void>;
  debounceMs?: number;
  periodicSaveMs?: number;
}

interface UseAutoSaveReturn {
  saveStatus: "saved" | "saving" | "unsaved";
  handleContentUpdate: (content: string) => void;
  handleTitleChange: (title: string) => void;
}

export function useAutoSave({
  documentId,
  initialContent,
  onSave,
  onTitleSave,
  debounceMs = 3000, // Save 3 seconds after user stops typing
  periodicSaveMs = 30000,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );

  const saveTimeoutRef = useRef<number | null>(null);
  const titleTimeoutRef = useRef<number | null>(null);
  const periodicSaveRef = useRef<number | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string>(initialContent);

  // Track last saved content when document changes
  useEffect(() => {
    lastSavedContentRef.current = initialContent;
    setSaveStatus("saved");
  }, [documentId, initialContent]);

  // Perform the actual save
  const performSave = useCallback(
    async (content: string) => {
      if (!documentId) return;
      if (content === lastSavedContentRef.current) {
        setSaveStatus("saved");
        return;
      }

      setSaveStatus("saving");
      try {
        await onSave(content);
        lastSavedContentRef.current = content;
        pendingContentRef.current = null;
        setSaveStatus("saved");
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveStatus("unsaved");
      }
    },
    [documentId, onSave]
  );

  // Handle content change with debounce
  const handleContentUpdate = useCallback(
    (content: string) => {
      if (!documentId) return;

      pendingContentRef.current = content;

      if (content !== lastSavedContentRef.current) {
        setSaveStatus("unsaved");
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        performSave(content);
      }, debounceMs);
    },
    [documentId, performSave, debounceMs]
  );

  // Handle title change with debounce
  const handleTitleChange = useCallback(
    (title: string) => {
      if (!documentId || !onTitleSave) return;

      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
      }

      titleTimeoutRef.current = window.setTimeout(() => {
        onTitleSave(title);
      }, 2000); // Save title 2 seconds after user stops typing
    },
    [documentId, onTitleSave]
  );

  // Periodic auto-save (backup)
  useEffect(() => {
    periodicSaveRef.current = window.setInterval(() => {
      if (
        pendingContentRef.current &&
        pendingContentRef.current !== lastSavedContentRef.current
      ) {
        performSave(pendingContentRef.current);
      }
    }, periodicSaveMs);

    return () => {
      if (periodicSaveRef.current) {
        clearInterval(periodicSaveRef.current);
      }
    };
  }, [performSave, periodicSaveMs]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        pendingContentRef.current &&
        pendingContentRef.current !== lastSavedContentRef.current &&
        documentId
      ) {
        onSave(pendingContentRef.current);
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [documentId, onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
      }
      if (pendingContentRef.current && documentId) {
        onSave(pendingContentRef.current);
      }
    };
  }, [documentId, onSave]);

  return {
    saveStatus,
    handleContentUpdate,
    handleTitleChange,
  };
}
