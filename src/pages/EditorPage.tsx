import { useState, useEffect, useCallback } from "react";
import {
  Sidebar,
  Editor,
  ControlBar,
  StatusMessage,
  AgentPanel,
  ModeToggle,
} from "../components";
import { useDocuments, useAuth, useProMode } from "../contexts";
import { useAutoSave, useUserPreferences, useEditorAI } from "../hooks";
import type { AiAction } from "../components/Editor/Editor";
import type {
  EditorContext,
  ContinuationLength,
  ModifyAction,
} from "../lib/ai";
import "./EditorPage.css";

interface EditorPageProps {
  user: { email: string; name: string };
  onLogout: () => void;
  onExit?: () => void;
}

// Wrapper for AgentPanel to use the ProMode context
function AgentPanelWrapper({ documentContext }: { documentContext: string }) {
  const { isProMode, isAgentPanelOpen } = useProMode();

  if (!isProMode || !isAgentPanelOpen) {
    return null;
  }

  return (
    <AgentPanel
      documentContext={documentContext}
      onInsertContent={(content) => {
        // TODO: Implement content insertion into editor
        console.log("Insert content:", content);
      }}
    />
  );
}

function EditorPage({ user, onLogout, onExit }: EditorPageProps) {
  const { activeDocument, updateDocument, isLoading, isOffline } =
    useDocuments();
  const { user: firebaseUser } = useAuth();
  const { mode, toggleMode } = useProMode();

  // Local title state for immediate input feedback
  const [localTitle, setLocalTitle] = useState("");

  // Get current content from active document
  const currentContent = activeDocument?.content || "";

  // Custom hooks for modular logic
  const {
    sidebarCollapsed,
    toggleSidebar,
    tone,
    handleToneChange,
    prefsLoaded,
  } = useUserPreferences(firebaseUser?.uid || null);

  const {
    saveStatus,
    handleContentUpdate,
    handleTitleChange: saveTitleChange,
  } = useAutoSave({
    documentId: activeDocument?.id || null,
    initialContent: currentContent,
    onSave: async (content: string) => {
      if (activeDocument) {
        await updateDocument(activeDocument.id, { content });
      }
    },
    onTitleSave: async (title: string) => {
      if (activeDocument) {
        await updateDocument(activeDocument.id, { title });
      }
    },
  });

  const {
    state,
    handleGenerate: aiGenerate,
    handleStop,
    handleAccept,
    handleReject,
    handleModify: aiModify,
    isStreaming,
    isModifying,
    hasPendingSuggestion,
    hasError,
  } = useEditorAI();

  // Sync local title with active document when document changes
  useEffect(() => {
    if (activeDocument) {
      setLocalTitle(activeDocument.title || "");
    }
  }, [activeDocument?.id, activeDocument?.title]);

  // Handle title change with immediate feedback
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setLocalTitle(newTitle);
      saveTitleChange(newTitle);
    },
    [saveTitleChange]
  );

  // Handle AI generate with proper typing
  const handleGenerate = useCallback(
    (
      action?: AiAction,
      selectedText?: string,
      editorContext?: EditorContext,
      length?: ContinuationLength
    ) => {
      if (action && selectedText) {
        aiGenerate(
          currentContent,
          tone,
          action as ModifyAction,
          selectedText,
          editorContext,
          length
        );
      } else {
        aiGenerate(
          currentContent,
          tone,
          undefined,
          undefined,
          editorContext,
          length
        );
      }
    },
    [aiGenerate, currentContent, tone]
  );

  // Handle modify action
  const handleModify = useCallback(
    (action: AiAction) => {
      aiModify(action as ModifyAction);
    },
    [aiModify]
  );

  // Extract plain text from JSON content for word counting
  const getPlainText = (content: string): string => {
    if (!content) return "";
    try {
      const parsed = JSON.parse(content);
      // Recursively extract text from ProseMirror JSON
      const extractText = (node: unknown): string => {
        if (typeof node !== "object" || node === null) return "";
        const n = node as Record<string, unknown>;
        if (typeof n.text === "string") return n.text;
        if (Array.isArray(n.content)) {
          return n.content.map(extractText).join(" ");
        }
        return "";
      };
      return extractText(parsed);
    } catch {
      // Fallback for plain text content
      return content;
    }
  };

  const plainText = getPlainText(currentContent);

  // Calculate word count
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const charCount = plainText.length;
  const canGenerate = plainText.length >= 1;

  // Reading time estimate (average 200 words per minute)
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Show loading while documents are being fetched
  if (isLoading || !prefsLoaded) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading your documents...</p>
      </div>
    );
  }

  return (
    <div
      className={`app-container ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
        user={user}
        onLogout={onLogout}
        onLogoClick={onExit}
      />

      <main className="editor-main">
        {/* Sidebar Toggle Button (visible when collapsed) */}
        {sidebarCollapsed && (
          <button
            className="sidebar-expand-btn"
            onClick={toggleSidebar}
            title="Expand sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6h12M4 10h12M4 14h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Document Header */}
        <header className="document-header">
          <div className="document-info">
            <input
              type="text"
              className="document-title-input"
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled"
            />
            <div className="document-meta">
              <span className="meta-item">{wordCount} words</span>
              <span className="meta-divider">·</span>
              <span className="meta-item">{charCount} characters</span>
              <span className="meta-divider">·</span>
              <span className="meta-item">{readingTime} min read</span>
              <span className="meta-divider">·</span>
              <span
                className={`meta-item save-status save-status-${saveStatus}`}
              >
                {saveStatus === "saving" && (
                  <>
                    <span className="save-spinner"></span>
                    Saving...
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <span className="save-check">✓</span>
                    Saved
                  </>
                )}
                {saveStatus === "unsaved" && (
                  <>
                    <span className="save-dot"></span>
                    Unsaved
                  </>
                )}
              </span>
              {isOffline && (
                <>
                  <span className="meta-divider">·</span>
                  <span className="meta-item offline-indicator">
                    <span className="offline-dot"></span>
                    Offline
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="header-right-section">
            {(isStreaming || isModifying) && (
              <span className="streaming-indicator">
                <span className="streaming-dot"></span>
                {isModifying ? "AI is modifying..." : "AI is writing..."}
              </span>
            )}
            {hasPendingSuggestion && (
              <span className="pending-indicator">
                Hover over italic text to accept/reject
              </span>
            )}
            <div className="header-mode-toggle">
              <ModeToggle
                isProMode={mode === "pro"}
                onToggle={toggleMode}
                disabled={isStreaming || isModifying}
              />
            </div>
          </div>
        </header>

        {/* Main Writing Area */}
        <div className="writing-area">
          <div className="editor-wrapper">
            <Editor
              key={activeDocument?.id}
              initialContent={currentContent}
              onUpdate={handleContentUpdate}
              apiText={state.context.generatedText}
              onGenerate={handleGenerate}
              isStreaming={isStreaming || isModifying}
              hasPendingSuggestion={hasPendingSuggestion}
              onAccept={handleAccept}
              onReject={handleReject}
              onModify={handleModify}
              documentTitle={localTitle}
            />
          </div>
        </div>

        {/* Bottom Toolbar */}
        <footer className="editor-footer">
          <div className="footer-content">
            {hasError && (
              <StatusMessage
                type="error"
                message={state.context.error || "An error occurred"}
              />
            )}
            <ControlBar
              isStreaming={isStreaming}
              canGenerate={canGenerate}
              onGenerate={(length) =>
                handleGenerate(undefined, undefined, undefined, length)
              }
              onStop={handleStop}
              wordCount={wordCount}
              tone={tone}
              onToneChange={handleToneChange}
            />
          </div>
          <div className="footer-hint">
            <kbd>/</kbd> for AI commands
          </div>
        </footer>
      </main>

      {/* Agent Panel (Pro Mode) */}
      <AgentPanelWrapper documentContext={plainText} />
    </div>
  );
}

export default EditorPage;
