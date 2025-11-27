import React from "react";
import { ThemeToggle } from "./ThemeToggle";
import "./Header.css";

interface HeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  isOffline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  isOffline,
}) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-top">
          <div className="logo-section">
            <div className="logo-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  width="28"
                  height="28"
                  rx="6"
                  fill="var(--notion-text-primary)"
                  fillOpacity="0.9"
                />
                <path
                  d="M8 10h12M8 14h8M8 18h10"
                  stroke="var(--notion-bg-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h1 className="header-title">{title}</h1>
          </div>
          <div className="header-actions">
            {isOffline && (
              <div className="header-badge offline-badge">
                <span className="badge-dot offline" />
                <span className="badge-text">Offline</span>
              </div>
            )}
            <div className="header-badge">
              <span className="badge-dot" />
              <span className="badge-text">AI</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
        {subtitle && <p className="header-subtitle">{subtitle}</p>}
      </div>
    </header>
  );
};
