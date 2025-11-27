import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import "./ThemeToggle.css";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 1.5V2.5M9 15.5V16.5M16.5 9H15.5M2.5 9H1.5M14.3 14.3L13.6 13.6M4.4 4.4L3.7 3.7M14.3 3.7L13.6 4.4M4.4 13.6L3.7 14.3M12.5 9C12.5 10.933 10.933 12.5 9 12.5C7.067 12.5 5.5 10.933 5.5 9C5.5 7.067 7.067 5.5 9 5.5C10.933 5.5 12.5 7.067 12.5 9Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15.5 10.5C14.5 13.5 11.5 15.5 8 15C4.5 14.5 2 11.5 2.5 8C3 4.5 6 2.5 9.5 3C8 4.5 7.5 7 9 9.5C10.5 12 13 12.5 15.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};
