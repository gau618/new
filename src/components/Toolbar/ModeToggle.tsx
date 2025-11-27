import React from "react";
import "./ModeToggle.css";

interface ModeToggleProps {
  isProMode: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  isProMode,
  onToggle,
  disabled = false,
}) => {
  return (
    <div className={`mode-toggle ${disabled ? "disabled" : ""}`}>
      <button
        className={`mode-option ${!isProMode ? "active" : ""}`}
        onClick={() => isProMode && onToggle()}
        disabled={disabled}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1.5L8.25 4.75L11.5 6L8.25 7.25L7 10.5L5.75 7.25L2.5 6L5.75 4.75L7 1.5Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
        Basic
      </button>
      <button
        className={`mode-option pro ${isProMode ? "active" : ""}`}
        onClick={() => !isProMode && onToggle()}
        disabled={disabled}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1L8.5 5L12.5 7L8.5 9L7 13L5.5 9L1.5 7L5.5 5L7 1Z"
            fill="currentColor"
          />
          <circle cx="11" cy="3" r="1.5" fill="currentColor" />
          <circle cx="3" cy="11" r="1" fill="currentColor" />
        </svg>
        Agent
        <span className="pro-label">PRO</span>
      </button>
      <div className={`mode-slider ${isProMode ? "pro" : ""}`} />
    </div>
  );
};

export default ModeToggle;
