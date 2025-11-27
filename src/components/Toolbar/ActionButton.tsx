import React from "react";
import "./ActionButton.css";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  className = "",
}) => {
  return (
    <button
      className={`action-button ${variant} ${size} ${
        loading ? "loading" : ""
      } ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="button-spinner" />
      ) : icon ? (
        <span className="button-icon">{icon}</span>
      ) : null}
      <span className="button-text">{children}</span>
    </button>
  );
};
