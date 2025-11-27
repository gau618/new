import { useState, useCallback, useEffect } from "react";
import { saveUserPreferences, getUserPreferences } from "../lib/firebase";
import type { WritingTone } from "../lib/ai";

interface UseUserPreferencesReturn {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  tone: WritingTone;
  handleToneChange: (tone: WritingTone) => void;
  prefsLoaded: boolean;
}

export function useUserPreferences(
  userId: string | null
): UseUserPreferencesReturn {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tone, setTone] = useState<WritingTone>("professional");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences from Firebase on mount
  useEffect(() => {
    const loadPrefs = async () => {
      if (userId) {
        try {
          const prefs = await getUserPreferences(userId);
          if (prefs) {
            if (prefs.sidebarCollapsed !== undefined) {
              setSidebarCollapsed(prefs.sidebarCollapsed);
            }
            if (prefs.tone) {
              setTone(prefs.tone as WritingTone);
            }
          }
        } catch (error) {
          console.error("Failed to load preferences:", error);
        }
      }
      setPrefsLoaded(true);
    };
    loadPrefs();
  }, [userId]);

  // Toggle sidebar and save to Firebase
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const newState = !prev;
      if (userId) {
        saveUserPreferences(userId, { sidebarCollapsed: newState }).catch(
          console.error
        );
      }
      return newState;
    });
  }, [userId]);

  // Save tone preference to Firebase
  const handleToneChange = useCallback(
    (newTone: WritingTone) => {
      setTone(newTone);
      if (userId) {
        saveUserPreferences(userId, { tone: newTone }).catch(console.error);
      }
    },
    [userId]
  );

  return {
    sidebarCollapsed,
    toggleSidebar,
    tone,
    handleToneChange,
    prefsLoaded,
  };
}
