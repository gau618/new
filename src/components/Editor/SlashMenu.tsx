import React, { useState, useEffect, useRef, useCallback } from "react";
import { blockTypes } from "../../lib/editor-config";
import type { BlockType } from "../../lib/editor-config";
import "./SlashMenu.css";

interface SlashMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  query: string;
  onSelect: (blockType: BlockType) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  isOpen,
  position,
  query,
  onSelect,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter block types by query
  const filteredTypes = blockTypes.filter((block) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    return (
      block.label.toLowerCase().includes(lowerQuery) ||
      block.description.toLowerCase().includes(lowerQuery) ||
      block.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
    );
  });

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem && menuRef.current) {
      selectedItem.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredTypes.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredTypes.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredTypes[selectedIndex]) {
            onSelect(filteredTypes[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredTypes, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group blocks by category
  const textBlocks = filteredTypes.filter((b) =>
    ["paragraph", "heading1", "heading2", "heading3"].includes(b.id)
  );
  const listBlocks = filteredTypes.filter((b) =>
    ["bullet_list", "ordered_list", "task_list", "toggle_list"].includes(b.id)
  );
  const aiBlocks = filteredTypes.filter((b) => b.id.startsWith("ai_"));
  const otherBlocks = filteredTypes.filter(
    (b) =>
      ![
        "paragraph",
        "heading1",
        "heading2",
        "heading3",
        "bullet_list",
        "ordered_list",
        "task_list",
        "toggle_list",
      ].includes(b.id) && !b.id.startsWith("ai_")
  );

  const renderGroup = (
    title: string,
    blocks: BlockType[],
    startIndex: number
  ) => {
    if (blocks.length === 0) return null;
    return (
      <div className="slash-menu-group">
        <div className="slash-menu-group-title">{title}</div>
        {blocks.map((block, idx) => {
          const globalIndex = startIndex + idx;
          return (
            <button
              key={block.id}
              ref={(el) => {
                itemRefs.current[globalIndex] = el;
              }}
              className={`slash-menu-item ${
                selectedIndex === globalIndex ? "selected" : ""
              }`}
              onClick={() => onSelect(block)}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
            >
              <span className="slash-menu-icon">{block.icon}</span>
              <div className="slash-menu-text">
                <span className="slash-menu-label">{block.label}</span>
                <span className="slash-menu-description">
                  {block.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // Calculate starting indices for each group
  let currentIndex = 0;
  const textStartIndex = currentIndex;
  currentIndex += textBlocks.length;
  const listStartIndex = currentIndex;
  currentIndex += listBlocks.length;
  const otherStartIndex = currentIndex;
  currentIndex += otherBlocks.length;
  const aiStartIndex = currentIndex;

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="slash-menu-header">
        {query ? (
          <span>
            Filtering by "<strong>{query}</strong>"
          </span>
        ) : (
          <span>Type to filter, or select a block</span>
        )}
      </div>
      <div className="slash-menu-content">
        {filteredTypes.length === 0 ? (
          <div className="slash-menu-empty">No results found</div>
        ) : (
          <>
            {renderGroup("Text", textBlocks, textStartIndex)}
            {renderGroup("Lists", listBlocks, listStartIndex)}
            {renderGroup("Blocks", otherBlocks, otherStartIndex)}
            {renderGroup("AI Assistant ✨", aiBlocks, aiStartIndex)}
          </>
        )}
      </div>
      <div className="slash-menu-footer">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> navigate
        </span>
        <span>
          <kbd>↵</kbd> select
        </span>
        <span>
          <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
};

export default SlashMenu;
