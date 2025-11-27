import React, { useState, useRef, useEffect } from "react";
import "./ProfileDropdown.css";

interface ProfileDropdownProps {
  user: { name: string; email: string };
  onLogout: () => void;
  onEnterEditor: () => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  user,
  onLogout,
  onEnterEditor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button className="profile-avatar" onClick={() => setIsOpen(!isOpen)}>
        {getInitials(user.name)}
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>
          <div className="dropdown-divider" />
          <button className="dropdown-item" onClick={onEnterEditor}>
            Go to Editor
          </button>
          <button className="dropdown-item" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};
