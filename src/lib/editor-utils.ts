import { Selection } from "prosemirror-state";
import { Node } from "prosemirror-model";

/**
 * Find the parent node that matches a predicate
 */
export function findParentNode(
  predicate: (node: Node) => boolean,
  selection: Selection
): { pos: number; node: Node; depth: number } | null {
  const { $from } = selection;

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (predicate(node)) {
      return {
        pos: $from.before(depth),
        node,
        depth,
      };
    }
  }

  return null;
}

/**
 * Find the parent node of a specific type
 */
export function findParentNodeOfType(
  typeName: string,
  selection: Selection
): { pos: number; node: Node; depth: number } | null {
  return findParentNode((node) => node.type.name === typeName, selection);
}

/**
 * Check if cursor is at the start of a block
 */
export function isAtBlockStart(selection: Selection): boolean {
  const { $from, empty } = selection;
  if (!empty) return false;
  return $from.parentOffset === 0;
}

/**
 * Check if cursor is at the end of a block
 */
export function isAtBlockEnd(selection: Selection): boolean {
  const { $to, empty } = selection;
  if (!empty) return false;
  return $to.parentOffset === $to.parent.content.size;
}

/**
 * Get the block node at the current selection
 */
export function getCurrentBlock(selection: Selection): Node | null {
  const { $from } = selection;

  // Start from depth 1 (skip doc node)
  for (let depth = $from.depth; depth >= 1; depth--) {
    const node = $from.node(depth);
    if (node.isBlock) {
      return node;
    }
  }

  return null;
}

/**
 * Get position info for the current block
 */
export function getBlockRange(
  selection: Selection
): { start: number; end: number; node: Node } | null {
  const parent = findParentNode((node) => node.isBlock, selection);

  if (!parent) return null;

  return {
    start: parent.pos,
    end: parent.pos + parent.node.nodeSize,
    node: parent.node,
  };
}

/**
 * Check if the selection is inside a specific node type
 */
export function isInsideNodeType(
  typeName: string,
  selection: Selection
): boolean {
  const parent = findParentNodeOfType(typeName, selection);
  return parent !== null;
}

/**
 * Get all block positions in the document
 */
export function getAllBlockPositions(doc: Node): number[] {
  const positions: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isBlock && node.type.name !== "doc") {
      positions.push(pos);
    }
    return true;
  });

  return positions;
}

/**
 * Calculate the menu position relative to editor
 */
export function calculateMenuPosition(
  coords: { top: number; left: number; bottom: number },
  editorRect: DOMRect,
  menuHeight: number = 300
): { top: number; left: number; direction: "up" | "down" } {
  const spaceBelow = window.innerHeight - coords.bottom;
  const spaceAbove = coords.top;

  // Prefer showing below, but flip if not enough space
  const showAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;

  return {
    top: showAbove
      ? coords.top - editorRect.top - menuHeight
      : coords.bottom - editorRect.top + 4,
    left: coords.left - editorRect.left,
    direction: showAbove ? "up" : "down",
  };
}

/**
 * Check if a node can be converted to another type
 */
export function canConvertTo(from: Node, toTypeName: string): boolean {
  // Most text blocks can be converted to each other
  const textBlocks = ["paragraph", "heading", "blockquote"];
  const listTypes = ["bullet_list", "ordered_list", "task_list", "toggle_list"];

  if (textBlocks.includes(from.type.name) && textBlocks.includes(toTypeName)) {
    return true;
  }

  if (listTypes.includes(from.type.name) && listTypes.includes(toTypeName)) {
    return true;
  }

  // Allow converting text blocks to lists and vice versa
  return true;
}
