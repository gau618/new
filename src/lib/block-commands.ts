import { EditorState, Transaction, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Fragment } from "prosemirror-model";
import { schema } from "./editor-config";
import type { BlockType } from "./editor-config";
import { getBlockRange } from "./editor-utils";
import { wrapInList } from "prosemirror-schema-list";
import {
  setBlockType,
  toggleMark,
  lift,
  joinUp,
  joinDown,
} from "prosemirror-commands";

// ============ Block Insertion Commands ============

/**
 * Insert a block at the current position
 */
export function insertBlock(view: EditorView, blockType: BlockType): boolean {
  const { state, dispatch } = view;

  // Handle custom actions (like image upload)
  if (blockType.action === "custom") {
    if (blockType.id === "image") {
      const url = prompt("Enter image URL:");
      if (url) {
        const node = schema.nodes.image.create({ src: url });
        const tr = state.tr.replaceSelectionWith(node);
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    return false;
  }

  // Get the node type from schema
  const nodeType = schema.nodes[blockType.nodeType!];
  if (!nodeType) return false;

  let tr = state.tr;

  // Handle different block types
  switch (blockType.id) {
    case "paragraph":
    case "heading1":
    case "heading2":
    case "heading3": {
      const attrs = blockType.attrs || {};
      if (setBlockType(nodeType, attrs)(state, dispatch)) {
        return true;
      }
      break;
    }

    case "bullet_list":
    case "ordered_list": {
      return wrapInListCommand(view, nodeType);
    }

    case "task_list": {
      return insertTaskList(view);
    }

    case "toggle_list": {
      return insertToggleList(view);
    }

    case "blockquote": {
      // Wrap current paragraph in blockquote
      const blockquoteType = schema.nodes.blockquote;
      const paragraph = schema.nodes.paragraph.create();
      const blockquote = blockquoteType.create(null, paragraph);
      tr = tr.replaceSelectionWith(blockquote);
      dispatch(tr.scrollIntoView());
      return true;
    }

    case "callout": {
      return insertCallout(view, blockType.attrs);
    }

    case "code_block": {
      const codeBlock = schema.nodes.code_block.create(
        blockType.attrs || { language: "" }
      );
      tr = tr.replaceSelectionWith(codeBlock);
      dispatch(tr.scrollIntoView());
      return true;
    }

    case "horizontal_rule": {
      const hr = schema.nodes.horizontal_rule.create();
      const paragraph = schema.nodes.paragraph.create();
      const fragment = Fragment.from([hr, paragraph]);
      tr = tr
        .delete(tr.selection.from, tr.selection.to)
        .insert(tr.selection.from, fragment);
      dispatch(tr.scrollIntoView());
      return true;
    }

    default:
      return false;
  }

  return false;
}

/**
 * Wrap selection in a list
 */
function wrapInListCommand(view: EditorView, listType: any): boolean {
  const { state, dispatch } = view;

  // Create a list with a single item containing current text
  const itemType = schema.nodes.list_item;

  if (wrapInList(listType)(state, dispatch)) {
    return true;
  }

  // If wrap fails, try inserting a new list
  const paragraph = schema.nodes.paragraph.create();
  const listItem = itemType.create(null, paragraph);
  const list = listType.create(null, listItem);

  const tr = state.tr.replaceSelectionWith(list);
  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Insert a task list (to-do list)
 */
function insertTaskList(view: EditorView): boolean {
  const { state, dispatch } = view;

  const paragraph = schema.nodes.paragraph.create();
  const taskItem = schema.nodes.task_item.create({ checked: false }, paragraph);
  const taskList = schema.nodes.task_list.create(null, taskItem);

  const tr = state.tr.replaceSelectionWith(taskList);
  // Position cursor inside the task item
  const pos = tr.selection.from - 2;
  dispatch(tr.setSelection(TextSelection.create(tr.doc, pos)).scrollIntoView());
  return true;
}

/**
 * Insert a toggle list
 */
function insertToggleList(view: EditorView): boolean {
  const { state, dispatch } = view;

  const paragraph = schema.nodes.paragraph.create();
  const toggleItem = schema.nodes.toggle_item.create({ open: true }, paragraph);
  const toggleList = schema.nodes.toggle_list.create(null, toggleItem);

  const tr = state.tr.replaceSelectionWith(toggleList);
  const pos = tr.selection.from - 2;
  dispatch(tr.setSelection(TextSelection.create(tr.doc, pos)).scrollIntoView());
  return true;
}

/**
 * Insert a callout block
 */
function insertCallout(
  view: EditorView,
  attrs?: Record<string, unknown>
): boolean {
  const { state, dispatch } = view;

  const paragraph = schema.nodes.paragraph.create();
  const callout = schema.nodes.callout.create(
    { emoji: "💡", type: "info", ...attrs },
    paragraph
  );

  const tr = state.tr.replaceSelectionWith(callout);
  dispatch(tr.scrollIntoView());
  return true;
}

// ============ Block Transformation Commands ============

/**
 * Transform the current block to a different type
 */
export function transformBlock(view: EditorView, targetType: string): boolean {
  const { state, dispatch } = view;

  // Find the current block
  const blockRange = getBlockRange(state.selection);
  if (!blockRange) return false;

  const nodeType = schema.nodes[targetType];
  if (!nodeType) {
    // Handle special cases like heading with level
    if (targetType.startsWith("heading")) {
      const level = parseInt(targetType.replace("heading", "")) || 1;
      return setBlockType(schema.nodes.heading, { level })(state, dispatch);
    }
    return false;
  }

  // Use setBlockType for simple block transformations
  if (["paragraph", "code_block"].includes(targetType)) {
    return setBlockType(nodeType)(state, dispatch);
  }

  // Handle heading transformation
  if (targetType === "heading") {
    return setBlockType(nodeType, { level: 1 })(state, dispatch);
  }

  // For list types, try to wrap
  if (["bullet_list", "ordered_list"].includes(targetType)) {
    return wrapInListCommand(view, nodeType);
  }

  // For task/toggle lists
  if (targetType === "task_list") {
    return insertTaskList(view);
  }

  if (targetType === "toggle_list") {
    return insertToggleList(view);
  }

  if (targetType === "blockquote") {
    return lift(state, dispatch) || false;
  }

  if (targetType === "callout") {
    return insertCallout(view);
  }

  return false;
}

// ============ Block Movement Commands ============

/**
 * Move the current block up
 */
export function moveBlockUp(view: EditorView): boolean {
  const { state, dispatch } = view;

  // Try joinUp first (ProseMirror's built-in)
  if (joinUp(state, dispatch)) {
    return true;
  }

  // Manual block swap
  const blockRange = getBlockRange(state.selection);
  if (!blockRange) return false;

  const { start, end, node } = blockRange;

  // Find previous sibling block
  const $pos = state.doc.resolve(start);
  if ($pos.index($pos.depth) === 0) return false; // Already first

  const prevStart = $pos.before($pos.depth);
  const prevNode = state.doc.nodeAt(prevStart);
  if (!prevNode) return false;

  // Swap blocks
  const tr = state.tr;
  const nodeSlice = state.doc.slice(start, end);
  const prevSlice = state.doc.slice(prevStart, start);

  tr.delete(prevStart, end);
  tr.insert(prevStart, nodeSlice.content);
  tr.insert(prevStart + node.nodeSize, prevSlice.content);

  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Move the current block down
 */
export function moveBlockDown(view: EditorView): boolean {
  const { state, dispatch } = view;

  // Try joinDown first
  if (joinDown(state, dispatch)) {
    return true;
  }

  const blockRange = getBlockRange(state.selection);
  if (!blockRange) return false;

  const { start, end, node } = blockRange;

  // Find next sibling block
  const $pos = state.doc.resolve(end);
  if ($pos.index($pos.depth) >= $pos.node($pos.depth).childCount - 1) {
    return false; // Already last
  }

  const nextNode = state.doc.nodeAt(end);
  if (!nextNode) return false;

  // Swap blocks
  const tr = state.tr;
  tr.delete(start, end + nextNode.nodeSize);
  tr.insert(start, state.doc.slice(end, end + nextNode.nodeSize).content);
  tr.insert(start + nextNode.nodeSize, node);

  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Delete the current block
 */
export function deleteBlock(view: EditorView): boolean {
  const { state, dispatch } = view;

  const blockRange = getBlockRange(state.selection);
  if (!blockRange) return false;

  const { start, end } = blockRange;

  // Don't delete if it's the only block
  if (state.doc.childCount === 1) {
    // Just clear the content instead
    const tr = state.tr.delete(start + 1, end - 1);
    dispatch(tr.scrollIntoView());
    return true;
  }

  const tr = state.tr.delete(start, end);
  dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Duplicate the current block
 */
export function duplicateBlock(view: EditorView): boolean {
  const { state, dispatch } = view;

  const blockRange = getBlockRange(state.selection);
  if (!blockRange) return false;

  const { end, node } = blockRange;

  // Insert a copy after the current block
  const tr = state.tr.insert(end, node.copy(node.content));

  // Move cursor to the duplicated block
  const newPos = end + 1;
  dispatch(
    tr.setSelection(TextSelection.create(tr.doc, newPos)).scrollIntoView()
  );
  return true;
}

// ============ Task Item Commands ============

/**
 * Toggle task item checkbox
 */
export function toggleTaskItem(view: EditorView, pos: number): boolean {
  const { state, dispatch } = view;

  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "task_item") return false;

  const tr = state.tr.setNodeMarkup(pos, null, {
    ...node.attrs,
    checked: !node.attrs.checked,
  });

  dispatch(tr);
  return true;
}

/**
 * Toggle toggle item open/closed
 */
export function toggleToggleItem(view: EditorView, pos: number): boolean {
  const { state, dispatch } = view;

  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "toggle_item") return false;

  const tr = state.tr.setNodeMarkup(pos, null, {
    ...node.attrs,
    open: !node.attrs.open,
  });

  dispatch(tr);
  return true;
}

// ============ Formatting Commands ============

/**
 * Exit from a special block (callout, code_block, toggle, task list, blockquote)
 * Creates a new paragraph after the block
 */
export function exitBlock(view: EditorView): boolean {
  const { state, dispatch } = view;
  const { $from, empty } = state.selection;

  if (!empty) return false;

  // Find if we're inside a special block
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const nodeType = node.type.name;

    // Check if we're in a special block that we want to exit from
    const exitableBlocks = [
      "callout",
      "code_block",
      "blockquote",
      "task_list",
      "toggle_list",
      "task_item",
      "toggle_item",
    ];

    if (exitableBlocks.includes(nodeType)) {
      // For list items, check if we're in an empty item
      if (nodeType === "task_item" || nodeType === "toggle_item") {
        // Check if the content is empty (just an empty paragraph)
        const itemContent = $from.parent;
        if (itemContent.content.size === 0 || itemContent.textContent === "") {
          // Find the parent list
          const listDepth = depth - 1;
          if (listDepth > 0) {
            const listNode = $from.node(listDepth);
            const listEnd = $from.end(listDepth);

            // Create a new paragraph after the list
            const paragraph = schema.nodes.paragraph.create();

            // If this is the only item in the list, replace the whole list
            if (listNode.childCount === 1) {
              const listStart = $from.before(listDepth);
              const tr = state.tr.replaceWith(
                listStart,
                listEnd + 1,
                paragraph
              );
              dispatch(tr.scrollIntoView());
              return true;
            }

            // Otherwise, delete this item and add paragraph after list
            const itemStart = $from.before(depth);
            const itemEnd = $from.after(depth);
            let tr = state.tr.delete(itemStart, itemEnd);

            // Insert paragraph after the list (adjust position after delete)
            const newListEnd = listEnd - (itemEnd - itemStart);
            tr = tr.insert(newListEnd, paragraph);
            dispatch(tr.scrollIntoView());
            return true;
          }
        }
      }

      // For callout/blockquote/code_block - check if cursor is at end
      const blockEnd = $from.after(depth);

      // Create paragraph after the block
      const paragraph = schema.nodes.paragraph.create();
      const tr = state.tr.insert(blockEnd, paragraph);

      // Move cursor to the new paragraph
      dispatch(
        tr
          .setSelection(TextSelection.create(tr.doc, blockEnd + 1))
          .scrollIntoView()
      );
      return true;
    }
  }

  return false;
}

/**
 * Handle backspace at the start of a block to convert it to paragraph
 */
export function exitBlockOnBackspace(view: EditorView): boolean {
  const { state, dispatch } = view;
  const { $from, empty } = state.selection;

  if (!empty) return false;

  // Check if we're at the start of a block
  if ($from.parentOffset !== 0) return false;

  // Find if we're inside a special block
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const nodeType = node.type.name;

    // Check if we're in a special block that we want to convert
    const exitableBlocks = [
      "callout",
      "blockquote",
      "task_item",
      "toggle_item",
    ];

    if (exitableBlocks.includes(nodeType)) {
      // For list items with empty content, lift them out
      if (nodeType === "task_item" || nodeType === "toggle_item") {
        const itemContent = $from.parent;
        if (itemContent.content.size === 0 || itemContent.textContent === "") {
          // Use lift command
          if (lift(state, dispatch)) {
            return true;
          }
        }
      }

      // For callout/blockquote - if empty, convert to paragraph
      if (nodeType === "callout" || nodeType === "blockquote") {
        // Check if the content is empty
        if (node.textContent === "") {
          const blockStart = $from.before(depth);
          const blockEnd = $from.after(depth);
          const paragraph = schema.nodes.paragraph.create();
          const tr = state.tr.replaceWith(blockStart, blockEnd, paragraph);
          dispatch(tr.scrollIntoView());
          return true;
        }
      }
    }
  }

  return false;
}

export const toggleBold = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => toggleMark(schema.marks.strong)(state, dispatch);

export const toggleItalic = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => toggleMark(schema.marks.em)(state, dispatch);

export const toggleCode = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => toggleMark(schema.marks.code)(state, dispatch);

export const toggleUnderline = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => toggleMark(schema.marks.underline)(state, dispatch);

export const toggleStrikethrough = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) => toggleMark(schema.marks.strikethrough)(state, dispatch);

/**
 * Insert a link
 */
export function insertLink(view: EditorView): boolean {
  const { state, dispatch } = view;
  const { from, to, empty } = state.selection;

  const url = prompt("Enter URL:");
  if (!url) return false;

  const linkMark = schema.marks.link.create({ href: url });

  if (empty) {
    // Insert link text if no selection
    const linkText = prompt("Enter link text:", url) || url;
    const tr = state.tr.insertText(linkText, from);
    tr.addMark(from, from + linkText.length, linkMark);
    dispatch(tr);
  } else {
    // Add link to selection
    const tr = state.tr.addMark(from, to, linkMark);
    dispatch(tr);
  }

  return true;
}

// ============ Keyboard Shortcut Bindings ============

export const keyboardShortcuts = {
  "Mod-b": toggleBold,
  "Mod-i": toggleItalic,
  "Mod-`": toggleCode,
  "Mod-u": toggleUnderline,
  "Mod-Shift-s": toggleStrikethrough,
  // Mod-Enter to exit current block and create new paragraph below
  "Mod-Enter": (
    _state: EditorState,
    _dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ) => {
    if (view) return exitBlock(view);
    return false;
  },
  // Escape can also exit blocks
  Escape: (
    _state: EditorState,
    _dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ) => {
    if (view) return exitBlock(view);
    return false;
  },
  "Mod-k": (
    _state: EditorState,
    _dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ) => {
    if (view) return insertLink(view);
    return false;
  },
  "Alt-ArrowUp": (
    _state: EditorState,
    _dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ) => {
    if (view) return moveBlockUp(view);
    return false;
  },
  "Alt-ArrowDown": (
    _state: EditorState,
    _dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ) => {
    if (view) return moveBlockDown(view);
    return false;
  },
  "Mod-d": (
    _state: EditorState,
    _dispatch?: (tr: Transaction) => void,
    view?: EditorView
  ) => {
    if (view) return duplicateBlock(view);
    return false;
  },
  "Mod-Shift-1": (state: EditorState, dispatch?: (tr: Transaction) => void) =>
    setBlockType(schema.nodes.heading, { level: 1 })(state, dispatch),
  "Mod-Shift-2": (state: EditorState, dispatch?: (tr: Transaction) => void) =>
    setBlockType(schema.nodes.heading, { level: 2 })(state, dispatch),
  "Mod-Shift-3": (state: EditorState, dispatch?: (tr: Transaction) => void) =>
    setBlockType(schema.nodes.heading, { level: 3 })(state, dispatch),
  "Mod-Shift-0": (state: EditorState, dispatch?: (tr: Transaction) => void) =>
    setBlockType(schema.nodes.paragraph)(state, dispatch),
};
