import React, { useState, useRef, useEffect } from "react";
import { ActionButton } from "./ActionButton";
import {
  TONE_OPTIONS,
  LENGTH_OPTIONS,
  type WritingTone,
  type ContinuationLength,
} from "../../lib/ai";
import { useProMode } from "../../contexts/ProModeContext";
import "./ControlBar.css";

interface ControlBarProps {
  isStreaming: boolean;
  canGenerate: boolean;
  onGenerate: (length?: ContinuationLength) => void;
  onStop: () => void;
  wordCount: number;
  tone: WritingTone;
  onToneChange: (tone: WritingTone) => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isStreaming,
  canGenerate,
  onGenerate,
  onStop,
  wordCount,
  tone,
  onToneChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLengthOpen, setIsLengthOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lengthDropdownRef = useRef<HTMLDivElement>(null);
  const { isProMode, toggleAgentPanel, isAgentPanelOpen } = useProMode();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
      if (
        lengthDropdownRef.current &&
        !lengthDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLengthOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    TONE_OPTIONS.find((o) => o.value === tone)?.label || "Professional";

  return (
    <div className="control-bar">
      <div className="control-bar-info">
        <div className="tone-selector" ref={dropdownRef}>
          <div
            className={`tone-trigger ${isOpen ? "open" : ""} ${
              isStreaming ? "disabled" : ""
            }`}
            onClick={() => !isStreaming && setIsOpen(!isOpen)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="tone-icon"
            >
              <path
                d="M8 2C4.686 2 2 4.686 2 8s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm0 10.5c-2.485 0-4.5-2.015-4.5-4.5S5.515 3.5 8 3.5s4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5zm2-5.5a1 1 0 11-2 0 1 1 0 012 0zm-4 0a1 1 0 11-2 0 1 1 0 012 0zm.5 3c0-.276.5-.5 1.5-.5s1.5.224 1.5.5-.5 1-1.5 1-1.5-.724-1.5-1z"
                fill="currentColor"
              />
            </svg>
            <span className="tone-value">{selectedLabel}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className={`tone-chevron ${isOpen ? "open" : ""}`}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {isOpen && (
            <div className="tone-menu">
              {TONE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`tone-option ${
                    tone === option.value ? "selected" : ""
                  }`}
                  onClick={() => {
                    onToneChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                  {tone === option.value && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M11.5 4L5.5 10L2.5 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="word-count">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 4h10M3 8h6M3 12h8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        {isStreaming && (
          <span className="streaming-indicator">
            <span className="streaming-dot" />
            Writing...
          </span>
        )}
      </div>

      <div className="control-bar-actions">
        {/* Agent Panel Toggle (Pro Mode) */}
        {isProMode && (
          <button
            className={`agent-toggle-btn ${isAgentPanelOpen ? "active" : ""}`}
            onClick={toggleAgentPanel}
            title={isAgentPanelOpen ? "Close Agent Panel" : "Open Agent Panel"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2L10.5 6L15 9L10.5 12L9 16L7.5 12L3 9L7.5 6L9 2Z"
                fill="currentColor"
              />
            </svg>
            Agent
          </button>
        )}

        {isStreaming ? (
          <ActionButton
            variant="danger"
            onClick={onStop}
            icon={
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="2"
                  y="2"
                  width="10"
                  height="10"
                  rx="2"
                  fill="currentColor"
                />
              </svg>
            }
          >
            Stop Writing
          </ActionButton>
        ) : (
          <div className="continue-writing-container" ref={lengthDropdownRef}>
            <ActionButton
              variant="primary"
              onClick={() => onGenerate("short")}
              disabled={!canGenerate}
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 2L9.5 6.5L14 8L9.5 9.5L8 14L6.5 9.5L2 8L6.5 6.5L8 2Z"
                    fill="currentColor"
                  />
                </svg>
              }
            >
              Continue
            </ActionButton>
            <button
              className={`length-dropdown-trigger ${
                isLengthOpen ? "open" : ""
              }`}
              onClick={() => setIsLengthOpen(!isLengthOpen)}
              disabled={!canGenerate || isStreaming}
              title="Choose response length"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={`length-chevron ${isLengthOpen ? "open" : ""}`}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isLengthOpen && (
              <div className="length-menu">
                {LENGTH_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="length-option"
                    onClick={() => {
                      onGenerate(option.value);
                      setIsLengthOpen(false);
                    }}
                  >
                    <span className="length-label">{option.label}</span>
                    <span className="length-description">
                      {option.description}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
