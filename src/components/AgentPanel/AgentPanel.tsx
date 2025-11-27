import React, { useState, useRef, useEffect } from "react";
import {
  useProMode,
  type AgentMessage,
  type AgentAction,
} from "../../contexts/ProModeContext";
import "./AgentPanel.css";

interface AgentPanelProps {
  documentContext?: string;
  onInsertContent?: (content: string) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  documentContext,
  onInsertContent,
}) => {
  const {
    isAgentPanelOpen,
    setAgentPanelOpen,
    messages,
    isAgentThinking,
    sendMessage,
    clearMessages,
    capabilities,
    executeAction,
  } = useProMode();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isAgentPanelOpen) {
      inputRef.current?.focus();
    }
  }, [isAgentPanelOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAgentThinking) return;

    const message = input.trim();
    setInput("");
    await sendMessage(message, documentContext);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleQuickAction = (capability: (typeof capabilities)[0]) => {
    const prompts: Record<string, string> = {
      research: "Write a detailed section about ",
      outline: "Create an outline for my document",
      expand: "Add more details and expand on my current content",
      analyze: "Analyze my writing and suggest improvements",
      summarize: "Summarize the key points of my document",
      brainstorm: "Brainstorm ideas about ",
    };

    const prompt = prompts[capability.id] || `Help me with ${capability.name}`;
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleActionClick = (action: AgentAction) => {
    if (action.type === "insert" && action.data && onInsertContent) {
      onInsertContent(action.data);
    }
    executeAction(action);
  };

  // Clean message content by removing action tags for display
  const cleanMessageContent = (content: string): string => {
    return content
      .replace(/\[\[\[INSERT\]\]\][\s\S]*?\[\[\[\/INSERT\]\]\]/g, "")
      .replace(/\[\[\[REPLACE_ALL\]\]\][\s\S]*?\[\[\[\/REPLACE_ALL\]\]\]/g, "")
      .replace(/\[\[\[APPEND\]\]\][\s\S]*?\[\[\[\/APPEND\]\]\]/g, "")
      .replace(/\[\[\[PREPEND\]\]\][\s\S]*?\[\[\[\/PREPEND\]\]\]/g, "")
      .replace(/\[\[\[OUTLINE\]\]\][\s\S]*?\[\[\[\/OUTLINE\]\]\]/g, "")
      .replace(/\[\[\[REWRITE\]\]\][\s\S]*?\[\[\[\/REWRITE\]\]\]/g, "")
      .trim();
  };

  if (!isAgentPanelOpen) {
    return null;
  }

  return (
    <div className="agent-panel">
      <div className="agent-panel-header">
        <div className="agent-header-title">
          <div className="agent-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2L12 7.5L18 10L12 12.5L10 18L8 12.5L2 10L8 7.5L10 2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span>Chronicle Agent</span>
          <span className="pro-badge">PRO</span>
        </div>
        <div className="agent-header-actions">
          <button
            className="agent-action-btn"
            onClick={clearMessages}
            title="Clear chat"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            className="agent-action-btn"
            onClick={() => setAgentPanelOpen(false)}
            title="Close panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 4l4 4-4 4M14 8H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="agent-panel-content">
        {messages.length === 0 ? (
          <div className="agent-welcome">
            <div className="welcome-icon">✨</div>
            <h3>Welcome to Chronicle Agent</h3>
            <p>
              I'm your AI writing assistant with advanced capabilities. Ask me
              anything or try a quick action below.
            </p>

            <div className="quick-actions">
              {capabilities.map((cap) => (
                <button
                  key={cap.id}
                  className="quick-action-btn"
                  onClick={() => handleQuickAction(cap)}
                >
                  <span className="quick-action-icon">{cap.icon}</span>
                  <span className="quick-action-name">{cap.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="agent-messages">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                cleanContent={cleanMessageContent}
                onActionClick={handleActionClick}
              />
            ))}
            {isAgentThinking &&
              messages[messages.length - 1]?.status !== "streaming" && (
                <div className="agent-thinking">
                  <div className="thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form className="agent-input-container" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the agent anything..."
          rows={1}
          disabled={isAgentThinking}
        />
        <button
          type="submit"
          className="agent-send-btn"
          disabled={!input.trim() || isAgentThinking}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M16 2L8 10M16 2L11 16L8 10L2 7L16 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
};

// Message bubble component
interface MessageBubbleProps {
  message: AgentMessage;
  cleanContent: (content: string) => string;
  onActionClick: (action: AgentAction) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  cleanContent,
  onActionClick,
}) => {
  const isUser = message.role === "user";
  const displayContent = cleanContent(message.content);

  return (
    <div className={`message-bubble ${isUser ? "user" : "agent"}`}>
      {!isUser && (
        <div className="message-avatar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1L9.5 5.5L14 8L9.5 10.5L8 15L6.5 10.5L2 8L6.5 5.5L8 1Z"
              fill="currentColor"
            />
          </svg>
        </div>
      )}
      <div className="message-content">
        <div className="message-text">
          {message.status === "streaming" && !displayContent ? (
            <span className="streaming-cursor">▊</span>
          ) : (
            <FormattedContent content={displayContent} />
          )}
          {message.status === "streaming" && displayContent && (
            <span className="streaming-cursor">▊</span>
          )}
        </div>
        {message.actions && message.actions.length > 0 && (
          <div className="message-actions">
            {message.actions.map((action, idx) => (
              <button
                key={idx}
                className="message-action-btn"
                onClick={() => onActionClick(action)}
              >
                {action.type === "insert" && "📥 "}
                {action.type === "outline" && "📋 "}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Simple markdown-like formatting
const FormattedContent: React.FC<{ content: string }> = ({ content }) => {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, "");
          return (
            <pre key={idx} className="message-code-block">
              <code>{code}</code>
            </pre>
          );
        }

        // Process inline formatting
        const formatted = part
          .split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
          .map((segment, i) => {
            if (segment.startsWith("**") && segment.endsWith("**")) {
              return <strong key={i}>{segment.slice(2, -2)}</strong>;
            }
            if (segment.startsWith("*") && segment.endsWith("*")) {
              return <em key={i}>{segment.slice(1, -1)}</em>;
            }
            if (segment.startsWith("`") && segment.endsWith("`")) {
              return (
                <code key={i} className="inline-code">
                  {segment.slice(1, -1)}
                </code>
              );
            }
            return segment;
          });

        return <span key={idx}>{formatted}</span>;
      })}
    </>
  );
};

export default AgentPanel;
