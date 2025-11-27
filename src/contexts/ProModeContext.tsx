import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "./AuthContext";

export type EditorMode = "basic" | "pro";

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
  status?: "pending" | "streaming" | "complete" | "error";
  actions?: AgentAction[];
}

// Extended action types for full editor control
export type AgentActionType =
  | "insert" // Insert content at cursor
  | "replace" // Replace selected text or all content
  | "delete" // Delete selected text or specified range
  | "append" // Add content at the end
  | "prepend" // Add content at the beginning
  | "format" // Apply formatting
  | "clear" // Clear all content
  | "outline" // Apply structured outline
  | "research" // Research action
  | "rewrite"; // Complete rewrite

export interface AgentAction {
  type: AgentActionType;
  label: string;
  data?: string;
  position?: "cursor" | "start" | "end" | "selection" | "all";
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// Pro Agent Capabilities
export const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: "research",
    name: "Write About",
    description: "Write content about any topic",
    icon: "✍️",
  },
  {
    id: "outline",
    name: "Create Outline",
    description: "Generate a structured outline",
    icon: "📋",
  },
  {
    id: "expand",
    name: "Expand More",
    description: "Add more details and content",
    icon: "📝",
  },
  {
    id: "analyze",
    name: "Improve Writing",
    description: "Analyze and improve your content",
    icon: "💡",
  },
  {
    id: "summarize",
    name: "Summarize",
    description: "Create a summary of content",
    icon: "📄",
  },
  {
    id: "brainstorm",
    name: "Brainstorm Ideas",
    description: "Generate ideas on a topic",
    icon: "🎯",
  },
];

// Editor controller for agent to manipulate the editor
export interface EditorController {
  insertText: (text: string, position?: "cursor" | "start" | "end") => void;
  replaceContent: (text: string) => void;
  replaceSelection: (text: string) => void;
  deleteSelection: () => void;
  clearAll: () => void;
  getContent: () => string;
  getSelection: () => string;
  appendText: (text: string) => void;
  prependText: (text: string) => void;
}

interface ProModeContextType {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;
  isProMode: boolean;

  // Agent chat state
  messages: AgentMessage[];
  isAgentThinking: boolean;
  sendMessage: (content: string, documentContext?: string) => Promise<void>;
  clearMessages: () => void;

  // Agent panel visibility
  isAgentPanelOpen: boolean;
  setAgentPanelOpen: (open: boolean) => void;
  toggleAgentPanel: () => void;

  // Capabilities
  capabilities: AgentCapability[];

  // Agent actions that affect the editor
  pendingAction: AgentAction | null;
  setPendingAction: (action: AgentAction | null) => void;
  executeAction: (action: AgentAction) => void;

  // Editor controller for full access
  editorController: EditorController | null;
  setEditorController: (controller: EditorController | null) => void;
}

const ProModeContext = createContext<ProModeContextType | undefined>(undefined);

// Storage key for mode preference
const getModeStorageKey = (userId: string) => `chronicle_editor_mode_${userId}`;

export const ProModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [mode, setModeState] = useState<EditorMode>("basic");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isAgentPanelOpen, setAgentPanelOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [editorController, setEditorController] =
    useState<EditorController | null>(null);

  // Load mode preference from localStorage
  useEffect(() => {
    if (user) {
      try {
        const stored = localStorage.getItem(getModeStorageKey(user.uid));
        if (stored === "pro" || stored === "basic") {
          setModeState(stored);
        }
      } catch (error) {
        console.error("Failed to load mode preference:", error);
      }
    }
  }, [user]);

  // Save mode preference to localStorage
  const setMode = useCallback(
    (newMode: EditorMode) => {
      setModeState(newMode);
      if (user) {
        try {
          localStorage.setItem(getModeStorageKey(user.uid), newMode);
        } catch (error) {
          console.error("Failed to save mode preference:", error);
        }
      }
      // Open agent panel when switching to pro mode
      if (newMode === "pro") {
        setAgentPanelOpen(true);
      }
    },
    [user]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === "basic" ? "pro" : "basic");
  }, [mode, setMode]);

  const toggleAgentPanel = useCallback(() => {
    setAgentPanelOpen((prev) => !prev);
  }, []);

  // Generate unique message ID
  const generateMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Send message to agent
  const sendMessage = useCallback(
    async (content: string, documentContext?: string) => {
      // Add user message
      const userMessage: AgentMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: Date.now(),
        status: "complete",
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsAgentThinking(true);

      // Add pending agent message
      const agentMessageId = generateMessageId();
      const pendingAgentMessage: AgentMessage = {
        id: agentMessageId,
        role: "agent",
        content: "",
        timestamp: Date.now(),
        status: "streaming",
      };

      setMessages((prev) => [...prev, pendingAgentMessage]);

      try {
        // Import the agent AI function dynamically to avoid circular deps
        const { generateAgentResponse } = await import("../lib/ai");

        let fullResponse = "";
        const stream = generateAgentResponse(content, documentContext);

        for await (const chunk of stream) {
          fullResponse += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMessageId
                ? { ...msg, content: fullResponse, status: "streaming" }
                : msg
            )
          );
        }

        // Parse any actions from the response
        const actions = parseAgentActions(fullResponse);

        // Update final message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMessageId
              ? { ...msg, content: fullResponse, status: "complete", actions }
              : msg
          )
        );
      } catch (error) {
        console.error("Agent error:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMessageId
              ? {
                  ...msg,
                  content: "Sorry, I encountered an error. Please try again.",
                  status: "error",
                }
              : msg
          )
        );
      } finally {
        setIsAgentThinking(false);
      }
    },
    []
  );

  // Parse actions from agent response
  const parseAgentActions = (response: string): AgentAction[] => {
    const actions: AgentAction[] = [];

    // Look for action markers in the response (using [[[ ]]] format)
    const insertMatch = response.match(
      /\[\[\[INSERT\]\]\]([\s\S]*?)\[\[\[\/INSERT\]\]\]/
    );
    if (insertMatch) {
      actions.push({
        type: "insert",
        label: "📥 Insert at cursor",
        data: insertMatch[1].trim(),
        position: "cursor",
      });
    }

    const replaceAllMatch = response.match(
      /\[\[\[REPLACE_ALL\]\]\]([\s\S]*?)\[\[\[\/REPLACE_ALL\]\]\]/
    );
    if (replaceAllMatch) {
      actions.push({
        type: "replace",
        label: "🔄 Replace document",
        data: replaceAllMatch[1].trim(),
        position: "all",
      });
    }

    const appendMatch = response.match(
      /\[\[\[APPEND\]\]\]([\s\S]*?)\[\[\[\/APPEND\]\]\]/
    );
    if (appendMatch) {
      actions.push({
        type: "append",
        label: "➕ Add to end",
        data: appendMatch[1].trim(),
      });
    }

    const prependMatch = response.match(
      /\[\[\[PREPEND\]\]\]([\s\S]*?)\[\[\[\/PREPEND\]\]\]/
    );
    if (prependMatch) {
      actions.push({
        type: "prepend",
        label: "⬆️ Add to start",
        data: prependMatch[1].trim(),
      });
    }

    const outlineMatch = response.match(
      /\[\[\[OUTLINE\]\]\]([\s\S]*?)\[\[\[\/OUTLINE\]\]\]/
    );
    if (outlineMatch) {
      actions.push({
        type: "outline",
        label: "📋 Apply outline",
        data: outlineMatch[1].trim(),
      });
    }

    const rewriteMatch = response.match(
      /\[\[\[REWRITE\]\]\]([\s\S]*?)\[\[\[\/REWRITE\]\]\]/
    );
    if (rewriteMatch) {
      actions.push({
        type: "rewrite",
        label: "✏️ Rewrite document",
        data: rewriteMatch[1].trim(),
      });
    }

    return actions;
  };

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Execute an agent action using the editor controller
  const executeAction = useCallback(
    (action: AgentAction) => {
      if (!editorController) {
        console.warn("No editor controller available");
        setPendingAction(action);
        return;
      }

      switch (action.type) {
        case "insert":
          if (action.data) {
            const position = action.position || "cursor";
            if (position === "start") {
              editorController.prependText(action.data);
            } else if (position === "end") {
              editorController.appendText(action.data);
            } else {
              editorController.insertText(action.data, "cursor");
            }
          }
          break;
        case "replace":
          if (action.data) {
            if (action.position === "selection") {
              editorController.replaceSelection(action.data);
            } else if (action.position === "all") {
              editorController.replaceContent(action.data);
            } else {
              editorController.replaceSelection(action.data);
            }
          }
          break;
        case "rewrite":
          if (action.data) {
            editorController.replaceContent(action.data);
          }
          break;
        case "delete":
          editorController.deleteSelection();
          break;
        case "clear":
          editorController.clearAll();
          break;
        case "append":
          if (action.data) {
            editorController.appendText(action.data);
          }
          break;
        case "prepend":
          if (action.data) {
            editorController.prependText(action.data);
          }
          break;
        case "outline":
          if (action.data) {
            // For outlines, replace all content with the structured outline
            editorController.replaceContent(action.data);
          }
          break;
        default:
          setPendingAction(action);
      }
    },
    [editorController]
  );

  const value: ProModeContextType = {
    mode,
    setMode,
    toggleMode,
    isProMode: mode === "pro",
    messages,
    isAgentThinking,
    sendMessage,
    clearMessages,
    isAgentPanelOpen,
    setAgentPanelOpen,
    toggleAgentPanel,
    capabilities: AGENT_CAPABILITIES,
    pendingAction,
    setPendingAction,
    executeAction,
    editorController,
    setEditorController,
  };

  return (
    <ProModeContext.Provider value={value}>{children}</ProModeContext.Provider>
  );
};

export const useProMode = (): ProModeContextType => {
  const context = useContext(ProModeContext);
  if (!context) {
    throw new Error("useProMode must be used within a ProModeProvider");
  }
  return context;
};
