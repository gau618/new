import React, { useState } from "react";
import "./Sidebar.css";
import { ThemeToggle } from "../Layout";
import { useDocuments, type Document, type Folder } from "../../contexts";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user?: { email: string; name: string };
  onLogout?: () => void;
  onLogoClick?: () => void;
}

// Icons as components for cleaner code
const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`chevron-icon ${expanded ? "expanded" : ""}`}
  >
    <path
      d="M4 2L8 6L4 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FolderIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="folder-icon"
  >
    {expanded ? (
      <path
        d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8 4h5a1 1 0 011 1v1H2V4zM2 7h12v5a1 1 0 01-1 1H3a1 1 0 01-1-1V7z"
        fill="currentColor"
      />
    ) : (
      <path
        d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8 4h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    )}
  </svg>
);

const DocIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="doc-icon"
  >
    <path
      d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M5 8h6M5 11h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const PlusIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 2v10M2 7h10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const DeleteIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 3l8 8M11 3l-8 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// Folder Item Component
interface FolderItemProps {
  folder: Folder;
  level: number;
  documents: Document[];
  activeDocId: string | null;
  onSelectDocument: (id: string) => void;
  onDeleteDocument: (e: React.MouseEvent, id: string) => void;
  onToggleFolder: (id: string) => void;
  onCreateDocument: (folderId: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  subfolders: Folder[];
  allFolders: Folder[];
  allDocuments: Document[];
  formatDate: (timestamp: number) => string;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  level,
  documents,
  activeDocId,
  onSelectDocument,
  onDeleteDocument,
  onToggleFolder,
  onCreateDocument,
  onDeleteFolder,
  onRenameFolder,
  subfolders,
  allFolders,
  allDocuments,
  formatDate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const handleRename = () => {
    if (editName.trim()) {
      onRenameFolder(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  const getNestedSubfolders = (parentId: string) =>
    allFolders.filter((f) => f.parentId === parentId);

  const getNestedDocuments = (folderId: string) =>
    allDocuments.filter((d) => d.folderId === folderId);

  return (
    <div className="folder-container">
      <div
        className="folder-item"
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <button
          className="folder-toggle"
          onClick={() => onToggleFolder(folder.id)}
        >
          <ChevronIcon expanded={folder.isExpanded} />
        </button>
        <FolderIcon expanded={folder.isExpanded} />
        {isEditing ? (
          <input
            type="text"
            className="folder-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="folder-name"
            onDoubleClick={() => setIsEditing(true)}
          >
            {folder.name}
          </span>
        )}
        <div className="folder-actions">
          <button
            className="folder-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCreateDocument(folder.id);
            }}
            title="Add document"
          >
            <PlusIcon />
          </button>
          <button
            className="folder-action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(folder.id);
            }}
            title="Delete folder"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      {folder.isExpanded && (
        <div className="folder-children">
          {/* Nested Folders */}
          {subfolders.map((subfolder) => (
            <FolderItem
              key={subfolder.id}
              folder={subfolder}
              level={level + 1}
              documents={getNestedDocuments(subfolder.id)}
              activeDocId={activeDocId}
              onSelectDocument={onSelectDocument}
              onDeleteDocument={onDeleteDocument}
              onToggleFolder={onToggleFolder}
              onCreateDocument={onCreateDocument}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
              subfolders={getNestedSubfolders(subfolder.id)}
              allFolders={allFolders}
              allDocuments={allDocuments}
              formatDate={formatDate}
            />
          ))}
          {/* Documents in this folder */}
          {documents.map((doc) => (
            <DocumentItem
              key={doc.id}
              doc={doc}
              level={level + 1}
              isActive={doc.id === activeDocId}
              canDelete={allDocuments.length > 1}
              onSelect={() => onSelectDocument(doc.id)}
              onDelete={(e) => onDeleteDocument(e, doc.id)}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Document Item Component
interface DocumentItemProps {
  doc: Document;
  level: number;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (timestamp: number) => string;
}

const DocumentItem: React.FC<DocumentItemProps> = ({
  doc,
  level,
  isActive,
  canDelete,
  onSelect,
  onDelete,
  formatDate,
}) => (
  <div
    className={`sidebar-item document-item ${isActive ? "active" : ""}`}
    style={{ paddingLeft: `${12 + level * 16 + 24}px` }}
    onClick={onSelect}
  >
    <DocIcon />
    <div className="doc-info">
      <span className="doc-title">{doc.title || "Untitled"}</span>
      <span className="doc-date">{formatDate(doc.updatedAt)}</span>
    </div>
    {canDelete && (
      <button className="doc-delete" onClick={onDelete} title="Delete document">
        <DeleteIcon />
      </button>
    )}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  user,
  onLogout,
  onLogoClick,
}) => {
  const {
    documents,
    folders,
    activeDocId,
    createDocument,
    setActiveDocument,
    deleteDocument,
    createFolder,
    renameFolder,
    deleteFolder,
    toggleFolderExpanded,
    getDocumentsInFolder,
    getSubfolders,
  } = useDocuments();

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleNewDocument = async (folderId: string | null = null) => {
    await createDocument(folderId);
  };

  const handleSelectDocument = (docId: string) => {
    setActiveDocument(docId);
  };

  const handleDeleteDocument = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (documents.length > 1) {
      deleteDocument(docId);
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  const handleFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateFolder();
    } else if (e.key === "Escape") {
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  };

  // Get root level folders and documents
  const rootFolders = getSubfolders(null);
  const rootDocuments = getDocumentsInFolder(null);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo" onClick={onLogoClick}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="currentColor"
            />
          </svg>
          <span className="sidebar-logo-text">Chronicle</span>
        </div>
        <div className="sidebar-header-actions">
          <ThemeToggle />
          <button
            className="sidebar-collapse-btn"
            onClick={onToggle}
            title="Collapse sidebar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M11 4L6 9l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="new-doc-btn" onClick={() => handleNewDocument()}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          New Document
        </button>
        <button
          className="new-folder-btn"
          onClick={() => setIsCreatingFolder(true)}
        >
          <FolderIcon expanded={false} />
          New Folder
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-label">Documents ({documents.length})</div>
        <nav className="sidebar-list">
          {/* New Folder Input */}
          {isCreatingFolder && (
            <div className="new-folder-input-container">
              <FolderIcon expanded={false} />
              <input
                type="text"
                className="new-folder-input"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={handleCreateFolder}
                onKeyDown={handleFolderKeyDown}
                autoFocus
              />
            </div>
          )}

          {/* Root Folders */}
          {rootFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              level={0}
              documents={getDocumentsInFolder(folder.id)}
              activeDocId={activeDocId}
              onSelectDocument={handleSelectDocument}
              onDeleteDocument={handleDeleteDocument}
              onToggleFolder={toggleFolderExpanded}
              onCreateDocument={(folderId) => handleNewDocument(folderId)}
              onDeleteFolder={deleteFolder}
              onRenameFolder={renameFolder}
              subfolders={getSubfolders(folder.id)}
              allFolders={folders}
              allDocuments={documents}
              formatDate={formatDate}
            />
          ))}

          {/* Root Documents (not in any folder) */}
          {rootDocuments.map((doc) => (
            <DocumentItem
              key={doc.id}
              doc={doc}
              level={0}
              isActive={doc.id === activeDocId}
              canDelete={documents.length > 1}
              onSelect={() => handleSelectDocument(doc.id)}
              onDelete={(e) => handleDeleteDocument(e, doc.id)}
              formatDate={formatDate}
            />
          ))}
        </nav>
      </div>

      {/* User Profile Section */}
      {user && (
        <div className="sidebar-user">
          <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="user-logout" onClick={onLogout} title="Log out">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        <span>Chronicle v1.0</span>
        <span className="footer-divider">·</span>
        <span>Auto-saved</span>
      </div>
    </aside>
  );
};

export default Sidebar;
