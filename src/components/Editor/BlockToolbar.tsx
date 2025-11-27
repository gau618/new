import React, { useState, useRef, useEffect, useCallback } from "react";
import { EditorView } from "prosemirror-view";
import { Node as ProseMirrorNode } from "prosemirror-model";
import type { Selection } from "prosemirror-state";
import "./BlockToolbar.css";

// Helper function to find parent node matching a predicate
function findParentNode(
  predicate: (node: ProseMirrorNode) => boolean,
  selection: Selection
): { pos: number; node: ProseMirrorNode; depth: number } | null {
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (predicate(node)) {
      return { pos: $from.before(depth), node, depth };
    }
  }
  return null;
}

interface BlockToolbarProps {
  view: EditorView | null;
  onTransform: (type: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  view,
  onTransform,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showTransformMenu, setShowTransformMenu] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Update position based on current selection
  const updatePosition = useCallback(() => {
    if (!view) return;

    const parentBlock = findParentNode(
      (node: ProseMirrorNode) => node.isBlock,
      view.state.selection
    );

    if (parentBlock) {
      const coords = view.coordsAtPos(parentBlock.pos);
      const editorRect = view.dom.getBoundingClientRect();

      setPosition({
        top: coords.top - editorRect.top,
        left: -40, // Position to the left of the block
      });
      setIsOpen(true);
    }
  }, [view]);

  // Listen for selection changes
  useEffect(() => {
    if (!view) return;

    const handleSelectionChange = () => {
      const { empty } = view.state.selection;
      if (empty) {
        updatePosition();
      } else {
        setIsOpen(false);
      }
    };

    // Check on mount and when view changes
    handleSelectionChange();
  }, [view, updatePosition]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as HTMLElement)
      ) {
        setShowTransformMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen || !view) return null;

  const transformOptions = [
    { id: "paragraph", label: "Text", icon: "Aa" },
    { id: "heading1", label: "Heading 1", icon: "H1" },
    { id: "heading2", label: "Heading 2", icon: "H2" },
    { id: "heading3", label: "Heading 3", icon: "H3" },
    { id: "bullet_list", label: "Bulleted List", icon: "•" },
    { id: "ordered_list", label: "Numbered List", icon: "1." },
    { id: "task_list", label: "To-do List", icon: "☑" },
    { id: "blockquote", label: "Quote", icon: "❝" },
    { id: "code_block", label: "Code", icon: "</>" },
    { id: "callout", label: "Callout", icon: "💡" },
  ];

  return (
    <div
      ref={toolbarRef}
      className="block-toolbar"
      style={{ top: position.top, left: position.left }}
    >
      {/* Drag Handle / Menu Trigger */}
      <div
        ref={dragHandleRef}
        className="block-toolbar-handle"
        onClick={() => setShowTransformMenu(!showTransformMenu)}
        title="Drag to move • Click for options"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4" cy="3" r="1.25" fill="currentColor" />
          <circle cx="10" cy="3" r="1.25" fill="currentColor" />
          <circle cx="4" cy="7" r="1.25" fill="currentColor" />
          <circle cx="10" cy="7" r="1.25" fill="currentColor" />
          <circle cx="4" cy="11" r="1.25" fill="currentColor" />
          <circle cx="10" cy="11" r="1.25" fill="currentColor" />
        </svg>
      </div>

      {/* Add Block Button */}
      <button
        className="block-toolbar-add"
        onClick={() => onTransform("paragraph")}
        title="Add block below"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 2V12M2 7H12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showTransformMenu && (
        <div className="block-toolbar-menu">
          <div className="block-toolbar-menu-section">
            <div className="block-toolbar-menu-title">Turn into</div>
            {transformOptions.map((option) => (
              <button
                key={option.id}
                className="block-toolbar-menu-item"
                onClick={() => {
                  onTransform(option.id);
                  setShowTransformMenu(false);
                }}
              >
                <span className="block-toolbar-menu-icon">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <div className="block-toolbar-menu-divider" />
          <div className="block-toolbar-menu-section">
            <div className="block-toolbar-menu-title">Actions</div>
            <button
              className="block-toolbar-menu-item"
              onClick={() => {
                onMoveUp();
                setShowTransformMenu(false);
              }}
            >
              <span className="block-toolbar-menu-icon">↑</span>
              <span>Move up</span>
              <span className="block-toolbar-shortcut">⌥↑</span>
            </button>
            <button
              className="block-toolbar-menu-item"
              onClick={() => {
                onMoveDown();
                setShowTransformMenu(false);
              }}
            >
              <span className="block-toolbar-menu-icon">↓</span>
              <span>Move down</span>
              <span className="block-toolbar-shortcut">⌥↓</span>
            </button>
            <button
              className="block-toolbar-menu-item"
              onClick={() => {
                onDuplicate();
                setShowTransformMenu(false);
              }}
            >
              <span className="block-toolbar-menu-icon">⧉</span>
              <span>Duplicate</span>
              <span className="block-toolbar-shortcut">⌘D</span>
            </button>
            <button
              className="block-toolbar-menu-item danger"
              onClick={() => {
                onDelete();
                setShowTransformMenu(false);
              }}
            >
              <span className="block-toolbar-menu-icon">🗑</span>
              <span>Delete</span>
              <span className="block-toolbar-shortcut">⌫</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockToolbar;
