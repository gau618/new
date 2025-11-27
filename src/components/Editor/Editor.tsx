import React, { useEffect, useRef, useState, useCallback } from "react";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { Node as ProseMirrorNode, Fragment } from "prosemirror-model";
import {
  splitListItem,
  liftListItem,
  sinkListItem,
} from "prosemirror-schema-list";
import {
  slashCommandPlugin,
  closeSlashMenu,
  type SlashMenuState,
} from "../../lib/slash-command";
import { buildInputRules } from "../../lib/inputRules";
import { schema, type BlockType } from "../../lib/editor-config";
import {
  insertBlock,
  toggleTaskItem,
  toggleToggleItem,
  keyboardShortcuts,
} from "../../lib/block-commands";
import { SlashMenu } from "./SlashMenu";
import { type EditorContext } from "../../lib/ai";
import {
  useProMode,
  type EditorController,
} from "../../contexts/ProModeContext";
import "prosemirror-view/style/prosemirror.css";
import "./EditorStyles.css";
import "./SlashMenu.css";

export type AiAction =
  | "shorten"
  | "expand"
  | "rephrase"
  | "formal"
  | "casual"
  | "summarize"
  | "improve"
  | "brainstorm";

interface EditorProps {
  onUpdate: (docText: string) => void;
  apiText?: string | null;
  onGenerate: (
    action?: AiAction,
    selectedText?: string,
    editorContext?: EditorContext
  ) => void;
  initialContent?: string;
  isStreaming?: boolean;
  hasPendingSuggestion?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onModify?: (action: AiAction) => void;
  documentTitle?: string;
}

export const Editor: React.FC<EditorProps> = ({
  onUpdate,
  apiText,
  onGenerate,
  initialContent = "",
  isStreaming = false,
  hasPendingSuggestion = false,
  onAccept,
  onReject,
  onModify,
  documentTitle,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastInsertedLengthRef = useRef(0);
  const aiTextStartPosRef = useRef<number | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [skeletonPos, setSkeletonPos] = useState({ top: 0, left: 0 });
  const [showToolbar, setShowToolbar] = useState(false);

  // Pro mode editor controller
  const { setEditorController } = useProMode();

  // Selection toolbar state (for AI actions on selected text)
  const [showSelectionToolbar, setShowSelectionToolbar] = useState(false);
  const [selectionToolbarPos, setSelectionToolbarPos] = useState({
    top: 0,
    left: 0,
  });
  const [selectedText, setSelectedText] = useState("");
  const selectionRangeRef = useRef<{ from: number; to: number } | null>(null);
  const isReplacingSelectionRef = useRef(false);
  const originalTextRef = useRef<string>("");

  // Slash menu state
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuState | null>(
    null
  );
  const [slashMenuPosition, setSlashMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  // Store initial content in a ref so it doesn't cause re-initialization
  const initialContentRef = useRef(initialContent);

  // Helper function to gather editor context for AI
  const gatherEditorContext = useCallback((): EditorContext => {
    if (!viewRef.current) {
      return {
        textBefore: "",
        textAfter: "",
        currentBlockType: "paragraph",
        isInList: false,
        isInCode: false,
        recentContext: "",
        documentTitle,
      };
    }

    const view = viewRef.current;
    const { state } = view;
    const { selection, doc } = state;
    const { from, to } = selection;

    // Get text before and after cursor
    const textBefore = doc.textBetween(0, from, " ", " ");
    const textAfter = doc.textBetween(to, doc.content.size, " ", " ");

    // Get current block info
    const $from = selection.$from;
    const currentNode = $from.parent;
    const currentBlockType = currentNode.type.name;

    // Check if in a list
    const isInList =
      !!$from.node($from.depth - 1)?.type.name.includes("list") ||
      !!$from.node($from.depth - 1)?.type.name.includes("item");

    // Check if in code block
    const isInCode =
      currentBlockType === "code_block" ||
      !!$from.marks().find((m) => m.type.name === "code");

    // Get recent context (last 800 chars)
    const recentContext = doc.textBetween(
      Math.max(0, from - 800),
      from,
      " ",
      " "
    );

    return {
      textBefore,
      textAfter,
      currentBlockType,
      isInList,
      isInCode,
      recentContext,
      documentTitle,
    };
  }, [documentTitle]);

  // Show skeleton when streaming starts, hide when first text arrives
  useEffect(() => {
    if (isStreaming && !apiText) {
      // Calculate skeleton position at current cursor
      if (viewRef.current && editorRef.current) {
        const view = viewRef.current;
        const cursorPos = view.state.selection.from;
        const coords = view.coordsAtPos(cursorPos);
        const rect = editorRef.current.getBoundingClientRect();

        if (coords) {
          // Position skeleton at the cursor line (use top instead of bottom)
          setSkeletonPos({
            top: coords.top - rect.top,
            left: 0,
          });
        }
      }
      setShowSkeleton(true);
    } else if (apiText && apiText.length > 0) {
      setShowSkeleton(false);
    } else if (!isStreaming) {
      setShowSkeleton(false);
    }
  }, [isStreaming, apiText]);

  // Handle slash menu state changes
  const handleSlashMenuStateChange = useCallback(
    (state: SlashMenuState | null) => {
      setSlashMenuState(state);

      if (state?.active && viewRef.current) {
        const view = viewRef.current;
        const coords = view.coordsAtPos(state.from);
        const editorRect = editorRef.current?.getBoundingClientRect();

        if (coords && editorRect) {
          setSlashMenuPosition({
            top: coords.bottom - editorRect.top + 4,
            left: coords.left - editorRect.left,
          });
        }
      }
    },
    []
  );

  // Handle block type selection from slash menu
  const handleBlockSelect = useCallback(
    (blockType: BlockType) => {
      if (!viewRef.current) return;

      const view = viewRef.current;

      // Close the slash menu and delete the slash command text
      closeSlashMenu(view, true);

      // Handle AI-specific actions
      if (blockType.id.startsWith("ai_")) {
        const { from, to, empty } = view.state.selection;
        let selectedText = "";

        if (!empty) {
          selectedText = view.state.doc.textBetween(from, to);
        } else {
          // Get text from current block or document
          const { $from } = view.state.selection;
          const parent = $from.parent;
          selectedText = parent.textContent || view.state.doc.textContent;
        }

        // Gather editor context for smarter AI
        const editorContext = gatherEditorContext();

        // Map AI block types to actions
        const aiActionMap: Record<string, AiAction> = {
          ai_continue: "expand",
          ai_summarize: "summarize",
          ai_expand: "expand",
          ai_improve: "improve",
          ai_brainstorm: "brainstorm",
        };

        const action = aiActionMap[blockType.id];
        if (action) {
          onGenerate(action, selectedText, editorContext);
        } else {
          onGenerate(undefined, undefined, editorContext);
        }

        view.focus();
        return;
      }

      // Insert the selected block
      insertBlock(view, blockType);

      // Focus the editor
      view.focus();
    },
    [onGenerate, gatherEditorContext]
  );

  // Handle click on task checkboxes and toggle icons
  const handleEditorClick = useCallback((e: MouseEvent) => {
    if (!viewRef.current) return;

    const target = e.target as HTMLElement;

    // Handle task checkbox click
    if (
      target.classList.contains("task-checkbox") ||
      target.classList.contains("task-checkbox-wrapper")
    ) {
      e.preventDefault();
      const taskItem = target.closest('[data-type="task-item"]');
      if (taskItem) {
        const pos = viewRef.current.posAtDOM(taskItem, 0);
        if (pos !== null) {
          toggleTaskItem(viewRef.current, pos - 1);
        }
      }
    }

    // Handle toggle icon click
    if (target.classList.contains("toggle-icon")) {
      e.preventDefault();
      const toggleItem = target.closest('[data-type="toggle-item"]');
      if (toggleItem) {
        const pos = viewRef.current.posAtDOM(toggleItem, 0);
        if (pos !== null) {
          toggleToggleItem(viewRef.current, pos - 1);
        }
      }
    }
  }, []);

  // Initialize ProseMirror only once per mount
  useEffect(() => {
    if (!editorRef.current) return;

    // Create initial document content from the ref (captured at mount time)
    const content = initialContentRef.current;
    let doc: ProseMirrorNode | undefined;

    if (content) {
      try {
        // Try to parse as JSON (structured document)
        const parsed = JSON.parse(content);
        doc = ProseMirrorNode.fromJSON(schema, parsed);
      } catch {
        // Fallback: treat as plain text (legacy content)
        // Split by newlines to create separate paragraphs
        const paragraphs = content.split(/\n\n+/).filter(Boolean);
        if (paragraphs.length > 0) {
          const nodes = paragraphs.map((text) =>
            schema.node(
              "paragraph",
              null,
              text.trim() ? [schema.text(text.trim())] : []
            )
          );
          doc = schema.node("doc", null, nodes);
        }
      }
    }

    const state = EditorState.create({
      schema,
      doc,
      plugins: [
        history(),
        keymap({
          "Mod-z": undo,
          "Mod-Shift-z": redo,
          "Mod-y": redo,
          ...keyboardShortcuts,
        }),
        // List-specific keybindings - Enter to split, Tab to indent, Shift-Tab to outdent
        keymap({
          Enter: splitListItem(schema.nodes.list_item),
          Tab: sinkListItem(schema.nodes.list_item),
          "Shift-Tab": liftListItem(schema.nodes.list_item),
        }),
        // Task list keybindings
        keymap({
          Enter: splitListItem(schema.nodes.task_item),
          Tab: sinkListItem(schema.nodes.task_item),
          "Shift-Tab": liftListItem(schema.nodes.task_item),
        }),
        // Toggle list keybindings
        keymap({
          Enter: splitListItem(schema.nodes.toggle_item),
          Tab: sinkListItem(schema.nodes.toggle_item),
          "Shift-Tab": liftListItem(schema.nodes.toggle_item),
        }),
        keymap(baseKeymap),
        slashCommandPlugin(onGenerate, handleSlashMenuStateChange),
        buildInputRules(),
      ],
    });

    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        if (transaction.docChanged) {
          // Save document as JSON to preserve structure (paragraphs, headings, lists, etc.)
          const docJson = JSON.stringify(newState.doc.toJSON());
          onUpdate(docJson);
        }

        // Check for text selection to show AI toolbar
        const { from, to, empty } = newState.selection;
        if (!empty && to - from > 3) {
          // Only show for selections > 3 chars
          const text = newState.doc.textBetween(from, to);
          setSelectedText(text);

          // Get coordinates for toolbar position
          const coords = view.coordsAtPos(from);
          const editorRect = editorRef.current?.getBoundingClientRect();
          if (coords && editorRect) {
            setSelectionToolbarPos({
              top: coords.top - editorRect.top - 45,
              left: coords.left - editorRect.left,
            });
            setShowSelectionToolbar(true);
          }
        } else {
          setShowSelectionToolbar(false);
          setSelectedText("");
        }
      },
    });

    // Make the editable DOM focusable and accessible
    try {
      view.dom.setAttribute("tabindex", "0");
      view.dom.setAttribute("spellcheck", "true");
      (view.dom as HTMLElement).style.caretColor = "var(--notion-accent)";
    } catch (e) {
      // ignore
    }

    // Add click handler for interactive elements
    view.dom.addEventListener("click", handleEditorClick);

    // Focus the editor when mounted
    setTimeout(() => {
      try {
        view.focus();
      } catch (e) {
        /* ignore */
      }
    }, 50);

    viewRef.current = view;

    // Helper function to parse inline markdown (bold, italic, code)
    const parseInlineMarkdown = (text: string): ProseMirrorNode[] => {
      const result: ProseMirrorNode[] = [];
      let remaining = text;

      while (remaining.length > 0) {
        // Check for bold (**text**)
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
          result.push(
            schema.text(boldMatch[1], [schema.marks.strong.create()])
          );
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Check for italic (*text*)
        const italicMatch = remaining.match(/^\*(.+?)\*/);
        if (italicMatch) {
          result.push(schema.text(italicMatch[1], [schema.marks.em.create()]));
          remaining = remaining.slice(italicMatch[0].length);
          continue;
        }

        // Check for inline code (`text`)
        const codeMatch = remaining.match(/^`(.+?)`/);
        if (codeMatch) {
          result.push(schema.text(codeMatch[1], [schema.marks.code.create()]));
          remaining = remaining.slice(codeMatch[0].length);
          continue;
        }

        // Find the next special character
        const nextSpecial = remaining.search(/[\*`]/);
        if (nextSpecial === -1) {
          // No more special characters
          if (remaining) result.push(schema.text(remaining));
          break;
        } else if (nextSpecial === 0) {
          // Special char at start but didn't match a pattern, treat as regular text
          result.push(schema.text(remaining[0]));
          remaining = remaining.slice(1);
        } else {
          // Add text before the special character
          result.push(schema.text(remaining.slice(0, nextSpecial)));
          remaining = remaining.slice(nextSpecial);
        }
      }

      return result.length > 0 ? result : [schema.text(text)];
    };

    // Helper function to parse markdown text into proper ProseMirror nodes
    const parseMarkdownToNodes = (text: string): ProseMirrorNode[] => {
      const lines = text.split("\n");
      const nodes: ProseMirrorNode[] = [];
      let currentListItems: ProseMirrorNode[] = [];
      let listType: "bullet" | "ordered" | null = null;

      const flushList = () => {
        if (currentListItems.length > 0) {
          if (listType === "bullet") {
            nodes.push(schema.nodes.bullet_list.create(null, currentListItems));
          } else {
            nodes.push(
              schema.nodes.ordered_list.create(null, currentListItems)
            );
          }
          currentListItems = [];
          listType = null;
        }
      };

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines but flush lists
        if (!trimmedLine) {
          flushList();
          continue;
        }

        // Check for headings
        if (trimmedLine.startsWith("### ")) {
          flushList();
          const content = trimmedLine.slice(4);
          const inlineNodes = parseInlineMarkdown(content);
          nodes.push(schema.nodes.heading.create({ level: 3 }, inlineNodes));
          continue;
        }
        if (trimmedLine.startsWith("## ")) {
          flushList();
          const content = trimmedLine.slice(3);
          const inlineNodes = parseInlineMarkdown(content);
          nodes.push(schema.nodes.heading.create({ level: 2 }, inlineNodes));
          continue;
        }
        if (trimmedLine.startsWith("# ")) {
          flushList();
          const content = trimmedLine.slice(2);
          const inlineNodes = parseInlineMarkdown(content);
          nodes.push(schema.nodes.heading.create({ level: 1 }, inlineNodes));
          continue;
        }

        // Check for bullet list items (-, *, •)
        const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
          if (listType !== "bullet") {
            flushList();
            listType = "bullet";
          }
          const content = bulletMatch[1];
          const inlineNodes = parseInlineMarkdown(content);
          const itemNode = schema.nodes.list_item.create(
            null,
            schema.nodes.paragraph.create(null, inlineNodes)
          );
          currentListItems.push(itemNode);
          continue;
        }

        // Check for numbered list items
        const numberedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
        if (numberedMatch) {
          if (listType !== "ordered") {
            flushList();
            listType = "ordered";
          }
          const content = numberedMatch[1];
          const inlineNodes = parseInlineMarkdown(content);
          const itemNode = schema.nodes.list_item.create(
            null,
            schema.nodes.paragraph.create(null, inlineNodes)
          );
          currentListItems.push(itemNode);
          continue;
        }

        // Regular paragraph
        flushList();
        const inlineNodes = parseInlineMarkdown(trimmedLine);
        nodes.push(schema.nodes.paragraph.create(null, inlineNodes));
      }

      // Flush any remaining list
      flushList();

      return nodes.length > 0 ? nodes : [schema.nodes.paragraph.create()];
    };

    // Create EditorController for Pro Mode agent access
    const controller: EditorController = {
      insertText: (text: string, position?: "cursor" | "start" | "end") => {
        const { state } = view;
        let insertPos: number;

        if (position === "start") {
          insertPos = 0;
        } else if (position === "end") {
          insertPos = state.doc.content.size;
        } else {
          insertPos = state.selection.from;
        }

        // Parse markdown and insert as proper nodes
        const nodes = parseMarkdownToNodes(text);
        const fragment = Fragment.from(nodes);
        const tr = state.tr.insert(insertPos, fragment);
        view.dispatch(tr);
        view.focus();
      },

      replaceContent: (text: string) => {
        const { state } = view;
        const nodes = parseMarkdownToNodes(text);
        const newDoc = schema.nodes.doc.create(null, nodes);
        const tr = state.tr.replaceWith(
          0,
          state.doc.content.size,
          newDoc.content
        );
        view.dispatch(tr);
        view.focus();
      },

      replaceSelection: (text: string) => {
        const { state } = view;
        const { from, to, empty } = state.selection;

        const nodes = parseMarkdownToNodes(text);
        const fragment = Fragment.from(nodes);

        if (empty) {
          const tr = state.tr.insert(from, fragment);
          view.dispatch(tr);
        } else {
          const tr = state.tr.replaceWith(from, to, fragment);
          view.dispatch(tr);
        }
        view.focus();
      },

      deleteSelection: () => {
        const { state } = view;
        const { from, to, empty } = state.selection;

        if (!empty) {
          const tr = state.tr.delete(from, to);
          view.dispatch(tr);
        }
        view.focus();
      },

      clearAll: () => {
        const { state } = view;
        const emptyPara = schema.nodes.paragraph.create();
        const newDoc = schema.nodes.doc.create(null, emptyPara);
        const tr = state.tr.replaceWith(
          0,
          state.doc.content.size,
          newDoc.content
        );
        view.dispatch(tr);
        view.focus();
      },

      getContent: () => {
        return view.state.doc.textContent;
      },

      getSelection: () => {
        const { state } = view;
        const { from, to, empty } = state.selection;
        if (empty) return "";
        return state.doc.textBetween(from, to);
      },

      appendText: (text: string) => {
        const { state } = view;
        const endPos = state.doc.content.size;

        const nodes = parseMarkdownToNodes(text);
        const fragment = Fragment.from(nodes);
        const tr = state.tr.insert(endPos, fragment);
        view.dispatch(tr);
        view.focus();
      },

      prependText: (text: string) => {
        const { state } = view;

        const nodes = parseMarkdownToNodes(text);
        const fragment = Fragment.from(nodes);
        const tr = state.tr.insert(0, fragment);
        view.dispatch(tr);
        view.focus();
      },
    };

    setEditorController(controller);

    return () => {
      view.dom.removeEventListener("click", handleEditorClick);
      view.destroy();
      setEditorController(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parse markdown-style AI output into appropriate nodes
  const parseAIOutputToNodes = useCallback(
    (text: string): ProseMirrorNode[] => {
      const lines = text.split("\n");
      const nodes: ProseMirrorNode[] = [];
      let currentListItems: ProseMirrorNode[] = [];
      let inCodeBlock = false;
      let codeContent = "";

      for (const line of lines) {
        // Check for code block markers
        if (line.trim().startsWith("```")) {
          if (inCodeBlock) {
            // End code block
            if (codeContent.trim()) {
              const codeNode = schema.nodes.code_block.create(
                null,
                codeContent.trim() ? schema.text(codeContent.trim()) : null
              );
              nodes.push(codeNode);
            }
            codeContent = "";
            inCodeBlock = false;
          } else {
            // Start code block - flush any pending list items first
            if (currentListItems.length > 0) {
              nodes.push(
                schema.nodes.bullet_list.create(null, currentListItems)
              );
              currentListItems = [];
            }
            inCodeBlock = true;
          }
          continue;
        }

        if (inCodeBlock) {
          codeContent += (codeContent ? "\n" : "") + line;
          continue;
        }

        const trimmedLine = line.trim();

        // Skip empty lines (but they signal end of list)
        if (!trimmedLine) {
          if (currentListItems.length > 0) {
            nodes.push(schema.nodes.bullet_list.create(null, currentListItems));
            currentListItems = [];
          }
          continue;
        }

        // Check for bullet list items
        const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
          const itemContent = bulletMatch[1];
          const itemNode = schema.nodes.list_item.create(
            null,
            schema.nodes.paragraph.create(null, schema.text(itemContent))
          );
          currentListItems.push(itemNode);
          continue;
        }

        // Check for numbered list items
        const numberedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
        if (numberedMatch) {
          // For now, treat as bullet list - can enhance later for ordered
          const itemContent = numberedMatch[1];
          const itemNode = schema.nodes.list_item.create(
            null,
            schema.nodes.paragraph.create(null, schema.text(itemContent))
          );
          currentListItems.push(itemNode);
          continue;
        }

        // Regular paragraph - flush any pending list items first
        if (currentListItems.length > 0) {
          nodes.push(schema.nodes.bullet_list.create(null, currentListItems));
          currentListItems = [];
        }

        // Create paragraph
        nodes.push(
          schema.nodes.paragraph.create(null, schema.text(trimmedLine))
        );
      }

      // Flush any remaining list items or code content
      if (currentListItems.length > 0) {
        nodes.push(schema.nodes.bullet_list.create(null, currentListItems));
      }
      if (inCodeBlock && codeContent.trim()) {
        nodes.push(
          schema.nodes.code_block.create(null, schema.text(codeContent.trim()))
        );
      }

      return nodes;
    },
    []
  );

  // Reference to track full AI text for final parsing
  const fullAiTextRef = useRef<string>("");
  // Reference to store parsed ProseMirror JSON from AI
  const parsedJsonRef = useRef<any>(null);

  // Handle streaming AI text - insert at cursor position with highlight mark
  useEffect(() => {
    if (!apiText || !viewRef.current) {
      if (!apiText) {
        lastInsertedLengthRef.current = 0;
        fullAiTextRef.current = "";
        parsedJsonRef.current = null;
        // Don't reset aiTextStartPosRef here - we need it for modifying
      }
      return;
    }

    const view = viewRef.current;

    // Check for JSON marker in the text
    const jsonMatch = apiText.match(/<<<PMJSON>>>(.+?)<<<PMJSON>>>/);
    if (jsonMatch) {
      try {
        parsedJsonRef.current = JSON.parse(jsonMatch[1]);
        // Store only the display text (without the JSON marker)
        fullAiTextRef.current = apiText
          .replace(/<<<PMJSON>>>.*<<<PMJSON>>>/, "")
          .trim();
      } catch (e) {
        console.error("Failed to parse AI JSON:", e);
        fullAiTextRef.current = apiText;
      }
    } else {
      fullAiTextRef.current = apiText;
    }

    // Get text without JSON marker for display
    const displayText = apiText
      .replace(/<<<PMJSON>>>.*<<<PMJSON>>>/, "")
      .trim();

    if (displayText.length > lastInsertedLengthRef.current) {
      let newChunk = displayText.slice(lastInsertedLengthRef.current);
      // Preserve newlines for display
      newChunk = newChunk.replace(/\r/g, "");

      if (newChunk) {
        // Insert at cursor position or end of document
        const insertPos =
          aiTextStartPosRef.current !== null
            ? aiTextStartPosRef.current + lastInsertedLengthRef.current
            : view.state.selection.from;

        // Track where AI text starts (only on first chunk)
        if (aiTextStartPosRef.current === null) {
          aiTextStartPosRef.current = insertPos;
        }

        // Insert text with italic mark (to indicate AI-generated)
        const emMark = schema.marks.em.create();
        const tr = view.state.tr.insert(
          insertPos +
            lastInsertedLengthRef.current -
            (lastInsertedLengthRef.current > 0
              ? lastInsertedLengthRef.current
              : 0),
          schema.text(newChunk, [emMark])
        );
        tr.scrollIntoView();
        view.dispatch(tr);
      }

      lastInsertedLengthRef.current = displayText.length;
    }
  }, [apiText]);

  // Convert parsed ProseMirror JSON to actual nodes
  const jsonToNodes = useCallback((parsed: any): ProseMirrorNode[] => {
    if (!parsed || !parsed.content) return [];

    const convertNode = (nodeData: any): ProseMirrorNode | null => {
      try {
        const nodeType = schema.nodes[nodeData.type];
        if (!nodeType) {
          console.warn("Unknown node type:", nodeData.type);
          return null;
        }

        let content: ProseMirrorNode[] = [];
        if (nodeData.content) {
          content = nodeData.content
            .map((child: any) => convertNode(child))
            .filter((n: any) => n !== null);
        }

        // Handle text nodes with marks
        if (nodeData.type === "text") {
          let marks: any[] = [];
          if (nodeData.marks) {
            marks = nodeData.marks
              .map((m: any) => {
                const markType = schema.marks[m.type];
                return markType ? markType.create(m.attrs) : null;
              })
              .filter((m: any) => m !== null);
          }
          return schema.text(nodeData.text || "", marks);
        }

        // Create node with attrs and content
        const attrs = nodeData.attrs || null;
        return nodeType.create(attrs, content.length > 0 ? content : null);
      } catch (e) {
        console.error("Failed to convert node:", nodeData, e);
        return null;
      }
    };

    return parsed.content
      .map((node: any) => convertNode(node))
      .filter((n: any) => n !== null);
  }, []);

  // Handle accept - use parsed JSON if available, otherwise just remove italic mark
  const handleAccept = () => {
    if (viewRef.current && aiTextStartPosRef.current !== null) {
      const view = viewRef.current;
      const startPos = aiTextStartPosRef.current;
      const aiText = fullAiTextRef.current;

      // Calculate the end position based on the AI text length
      const endPos = startPos + aiText.length;

      // Check if we have parsed JSON with block-level formatting from the AI
      if (parsedJsonRef.current) {
        // Delete the plain text AI content first
        let tr = view.state.tr.delete(startPos, endPos);
        view.dispatch(tr);

        // Convert JSON to ProseMirror nodes
        const nodes = jsonToNodes(parsedJsonRef.current);
        if (nodes.length > 0) {
          let insertOffset = 0;
          const insertTr = view.state.tr;
          for (const node of nodes) {
            insertTr.insert(startPos + insertOffset, node);
            insertOffset += node.nodeSize;
          }
          view.dispatch(insertTr);
        }
      } else {
        // Check for markdown block formatting
        const hasMarkdownFormatting =
          /^[-*•]\s+/m.test(aiText) ||
          /^\d+[.)]\s+/m.test(aiText) ||
          /```[\s\S]*```/.test(aiText);

        if (hasMarkdownFormatting) {
          // Delete and replace with formatted nodes
          let tr = view.state.tr.delete(startPos, endPos);
          view.dispatch(tr);

          const nodes = parseAIOutputToNodes(aiText);
          if (nodes.length > 0) {
            let insertOffset = 0;
            const insertTr = view.state.tr;
            for (const node of nodes) {
              insertTr.insert(startPos + insertOffset, node);
              insertOffset += node.nodeSize;
            }
            view.dispatch(insertTr);
          }
        } else {
          // Plain text - just remove the italic mark, keep text in place
          const tr = view.state.tr.removeMark(
            startPos,
            endPos,
            schema.marks.em
          );
          view.dispatch(tr);
        }
      }
    }

    // Reset all refs
    aiTextStartPosRef.current = null;
    fullAiTextRef.current = "";
    parsedJsonRef.current = null;
    isReplacingSelectionRef.current = false;
    originalTextRef.current = "";
    selectionRangeRef.current = null;

    setShowToolbar(false);
    onAccept?.();
  };

  // Handle reject - remove AI text from editor (and restore original if replacing)
  const handleReject = () => {
    if (viewRef.current && aiTextStartPosRef.current !== null) {
      const view = viewRef.current;
      const startPos = aiTextStartPosRef.current;
      const endPos = view.state.doc.content.size - 1;

      // Delete the AI-generated text
      let tr = view.state.tr.delete(startPos, endPos);

      // If we were replacing selected text, restore the original
      if (isReplacingSelectionRef.current && originalTextRef.current) {
        tr = tr.insert(startPos, schema.text(originalTextRef.current));
      }

      view.dispatch(tr);
    }

    // Reset all refs
    aiTextStartPosRef.current = null;
    lastInsertedLengthRef.current = 0;
    fullAiTextRef.current = "";
    isReplacingSelectionRef.current = false;
    originalTextRef.current = "";
    selectionRangeRef.current = null;

    setShowToolbar(false);
    onReject?.();
  };

  // Handle modify - delete existing AI text and prepare for new text
  const handleModify = (action: AiAction) => {
    if (viewRef.current && aiTextStartPosRef.current !== null) {
      const view = viewRef.current;
      const startPos = aiTextStartPosRef.current;
      const endPos = view.state.doc.content.size - 1;

      // Delete the AI-generated text
      const tr = view.state.tr.delete(startPos, endPos);
      view.dispatch(tr);

      // Reset for new streaming but keep the start position
      lastInsertedLengthRef.current = 0;
      // aiTextStartPosRef stays at the same position for new AI text
    }
    setShowToolbar(false);
    onModify?.(action);
  };

  // Handle AI action on selected text
  const handleSelectionAiAction = useCallback(
    (action: AiAction) => {
      if (selectedText && viewRef.current) {
        const view = viewRef.current;
        const { from, to } = view.state.selection;

        // Gather editor context before deleting selection
        const editorContext = gatherEditorContext();

        // Store selection range and original text for restore on reject
        selectionRangeRef.current = { from, to };
        isReplacingSelectionRef.current = true;
        originalTextRef.current = selectedText;

        // Delete the selected text first
        const tr = view.state.tr.delete(from, to);
        // Set cursor at deletion point
        tr.setSelection(TextSelection.create(tr.doc, from));
        view.dispatch(tr);

        // Set AI text start position to where we deleted
        aiTextStartPosRef.current = from;
        lastInsertedLengthRef.current = 0;

        setShowSelectionToolbar(false);
        onGenerate(action, selectedText, editorContext);
      }
    },
    [selectedText, onGenerate, gatherEditorContext]
  );

  // Update toolbar visibility when AI text changes
  useEffect(() => {
    if (hasPendingSuggestion && aiTextStartPosRef.current !== null) {
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  }, [hasPendingSuggestion]);

  return (
    <div className="editor-wrapper-inner">
      <div
        className={`editor-container ${isStreaming ? "is-streaming" : ""} ${
          hasPendingSuggestion ? "has-suggestion" : ""
        }`}
        ref={editorRef}
        onClick={() => viewRef.current?.focus()}
      />

      {showSkeleton && (
        <div
          className="ai-skeleton"
          style={{ top: skeletonPos.top, left: skeletonPos.left }}
        >
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
        </div>
      )}

      {/* Slash Command Menu */}
      <SlashMenu
        isOpen={slashMenuState?.active ?? false}
        position={slashMenuPosition}
        query={slashMenuState?.query ?? ""}
        onSelect={handleBlockSelect}
        onClose={() => {
          if (viewRef.current) {
            closeSlashMenu(viewRef.current, false);
          }
        }}
      />

      {/* AI Accept/Reject Toolbar - appears centered at bottom */}
      {showToolbar && hasPendingSuggestion && (
        <div className="ai-action-toolbar">
          <button
            className="ai-action-btn accept"
            onClick={handleAccept}
            title="Accept (Enter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M13 5L6.5 11.5L3 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Accept
          </button>
          <button
            className="ai-action-btn reject"
            onClick={handleReject}
            title="Reject (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Reject
          </button>
          <div className="ai-action-divider"></div>
          <button
            className="ai-action-btn modify"
            onClick={() => handleModify("shorten")}
            title="Make shorter"
          >
            Shorter
          </button>
          <button
            className="ai-action-btn modify"
            onClick={() => handleModify("expand")}
            title="Make longer"
          >
            Longer
          </button>
          <button
            className="ai-action-btn modify"
            onClick={() => handleModify("rephrase")}
            title="Rephrase"
          >
            Rephrase
          </button>
        </div>
      )}

      {/* Selection Toolbar for AI actions on selected text */}
      {showSelectionToolbar &&
        !isStreaming &&
        !hasPendingSuggestion &&
        selectedText && (
          <div
            className="selection-ai-toolbar"
            style={{
              top: selectionToolbarPos.top,
              left: selectionToolbarPos.left,
            }}
          >
            <span className="selection-toolbar-label">✨ AI</span>
            <button
              className="selection-toolbar-btn"
              onClick={() => handleSelectionAiAction("summarize")}
              title="Summarize selected text"
            >
              📝 Summarize
            </button>
            <button
              className="selection-toolbar-btn"
              onClick={() => handleSelectionAiAction("expand")}
              title="Expand selected text"
            >
              📖 Expand
            </button>
            <button
              className="selection-toolbar-btn"
              onClick={() => handleSelectionAiAction("improve")}
              title="Improve selected text"
            >
              ✏️ Improve
            </button>
            <button
              className="selection-toolbar-btn"
              onClick={() => handleSelectionAiAction("rephrase")}
              title="Rephrase selected text"
            >
              🔄 Rephrase
            </button>
          </div>
        )}
    </div>
  );
};
