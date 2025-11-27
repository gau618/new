import { Schema } from "prosemirror-model";
import type { NodeSpec, MarkSpec } from "prosemirror-model";

// ============ Node Specifications ============

const doc: NodeSpec = {
  content: "block+",
};

const paragraph: NodeSpec = {
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p" }],
  toDOM() {
    return ["p", 0];
  },
};

const text: NodeSpec = {
  group: "inline",
};

const hard_break: NodeSpec = {
  inline: true,
  group: "inline",
  selectable: false,
  parseDOM: [{ tag: "br" }],
  toDOM() {
    return ["br"];
  },
};

// Headings (1-6)
const heading: NodeSpec = {
  attrs: { level: { default: 1 } },
  content: "inline*",
  group: "block",
  defining: true,
  parseDOM: [
    { tag: "h1", attrs: { level: 1 } },
    { tag: "h2", attrs: { level: 2 } },
    { tag: "h3", attrs: { level: 3 } },
    { tag: "h4", attrs: { level: 4 } },
    { tag: "h5", attrs: { level: 5 } },
    { tag: "h6", attrs: { level: 6 } },
  ],
  toDOM(node) {
    return ["h" + node.attrs.level, 0];
  },
};

// Blockquote
const blockquote: NodeSpec = {
  content: "block+",
  group: "block",
  defining: true,
  parseDOM: [{ tag: "blockquote" }],
  toDOM() {
    return ["blockquote", 0];
  },
};

// Code block with optional language
const code_block: NodeSpec = {
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  attrs: { language: { default: "" } },
  parseDOM: [
    {
      tag: "pre",
      preserveWhitespace: "full",
      getAttrs(node) {
        const el = node as HTMLElement;
        const code = el.querySelector("code");
        const lang = code?.className?.match(/language-(\w+)/)?.[1] || "";
        return { language: lang };
      },
    },
  ],
  toDOM(node) {
    return [
      "pre",
      { class: node.attrs.language ? `language-${node.attrs.language}` : "" },
      ["code", 0],
    ];
  },
};

// Horizontal rule / divider
const horizontal_rule: NodeSpec = {
  group: "block",
  parseDOM: [{ tag: "hr" }],
  toDOM() {
    return ["hr"];
  },
};

// Image
const image: NodeSpec = {
  inline: false,
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
  },
  group: "block",
  draggable: true,
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return {
          src: el.getAttribute("src"),
          alt: el.getAttribute("alt"),
          title: el.getAttribute("title"),
        };
      },
    },
  ],
  toDOM(node) {
    return ["img", node.attrs];
  },
};

// ============ List Nodes ============

const bullet_list: NodeSpec = {
  content: "list_item+",
  group: "block",
  parseDOM: [{ tag: "ul" }],
  toDOM() {
    return ["ul", 0];
  },
};

const ordered_list: NodeSpec = {
  content: "list_item+",
  group: "block",
  attrs: { order: { default: 1 } },
  parseDOM: [
    {
      tag: "ol",
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return {
          order: el.hasAttribute("start") ? +el.getAttribute("start")! : 1,
        };
      },
    },
  ],
  toDOM(node) {
    return node.attrs.order === 1
      ? ["ol", 0]
      : ["ol", { start: node.attrs.order }, 0];
  },
};

const list_item: NodeSpec = {
  content: "paragraph block*",
  parseDOM: [{ tag: "li" }],
  toDOM() {
    return ["li", 0];
  },
  defining: true,
};

// ============ Notion-like Block Types ============

// To-do list (task list)
const task_list: NodeSpec = {
  content: "task_item+",
  group: "block",
  parseDOM: [{ tag: 'ul[data-type="task-list"]' }],
  toDOM() {
    return ["ul", { "data-type": "task-list", class: "task-list" }, 0];
  },
};

const task_item: NodeSpec = {
  content: "paragraph block*",
  attrs: { checked: { default: false } },
  defining: true,
  parseDOM: [
    {
      tag: 'li[data-type="task-item"]',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return { checked: el.getAttribute("data-checked") === "true" };
      },
    },
  ],
  toDOM(node) {
    return [
      "li",
      {
        "data-type": "task-item",
        "data-checked": node.attrs.checked ? "true" : "false",
        class: `task-item ${node.attrs.checked ? "task-item-checked" : ""}`,
      },
      [
        "label",
        { class: "task-checkbox-wrapper", contenteditable: "false" },
        [
          "input",
          {
            type: "checkbox",
            class: "task-checkbox",
            ...(node.attrs.checked ? { checked: "checked" } : {}),
          },
        ],
      ],
      ["div", { class: "task-content" }, 0],
    ];
  },
};

// Toggle block (collapsible)
const toggle_list: NodeSpec = {
  content: "toggle_item+",
  group: "block",
  parseDOM: [{ tag: 'ul[data-type="toggle-list"]' }],
  toDOM() {
    return ["ul", { "data-type": "toggle-list", class: "toggle-list" }, 0];
  },
};

const toggle_item: NodeSpec = {
  content: "paragraph block*",
  attrs: { open: { default: true } },
  defining: true,
  parseDOM: [
    {
      tag: 'li[data-type="toggle-item"]',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return { open: el.getAttribute("data-open") !== "false" };
      },
    },
  ],
  toDOM(node) {
    return [
      "li",
      {
        "data-type": "toggle-item",
        "data-open": node.attrs.open ? "true" : "false",
        class: `toggle-item ${
          node.attrs.open ? "toggle-open" : "toggle-closed"
        }`,
      },
      [
        "span",
        { class: "toggle-icon", contenteditable: "false" },
        node.attrs.open ? "▼" : "▶",
      ],
      ["div", { class: "toggle-content" }, 0],
    ];
  },
};

// Callout block
const callout: NodeSpec = {
  content: "paragraph block*",
  group: "block",
  attrs: {
    emoji: { default: "💡" },
    type: { default: "info" }, // info, warning, success, error
  },
  parseDOM: [
    {
      tag: 'div[data-type="callout"]',
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return {
          emoji: el.getAttribute("data-emoji") || "💡",
          type: el.getAttribute("data-callout-type") || "info",
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "div",
      {
        "data-type": "callout",
        "data-emoji": node.attrs.emoji,
        "data-callout-type": node.attrs.type,
        class: `callout callout-${node.attrs.type}`,
      },
      [
        "span",
        { class: "callout-emoji", contenteditable: "false" },
        node.attrs.emoji,
      ],
      ["div", { class: "callout-content" }, 0],
    ];
  },
};

// ============ Mark Specifications ============

const strong: MarkSpec = {
  parseDOM: [
    { tag: "strong" },
    {
      tag: "b",
      getAttrs: (node) =>
        (node as HTMLElement).style.fontWeight !== "normal" && null,
    },
    { style: "font-weight=400", clearMark: (m) => m.type.name === "strong" },
    {
      style: "font-weight",
      getAttrs: (value) =>
        /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
    },
  ],
  toDOM() {
    return ["strong", 0];
  },
};

const em: MarkSpec = {
  parseDOM: [
    { tag: "i" },
    { tag: "em" },
    { style: "font-style=italic" },
    { style: "font-style=normal", clearMark: (m) => m.type.name === "em" },
  ],
  toDOM() {
    return ["em", 0];
  },
};

const code: MarkSpec = {
  parseDOM: [{ tag: "code" }],
  toDOM() {
    return ["code", 0];
  },
};

const underline: MarkSpec = {
  parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
  toDOM() {
    return ["u", 0];
  },
};

const strikethrough: MarkSpec = {
  parseDOM: [
    { tag: "s" },
    { tag: "del" },
    { style: "text-decoration=line-through" },
  ],
  toDOM() {
    return ["s", 0];
  },
};

const link: MarkSpec = {
  attrs: {
    href: {},
    title: { default: null },
    target: { default: "_blank" },
  },
  inclusive: false,
  parseDOM: [
    {
      tag: "a[href]",
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return {
          href: el.getAttribute("href"),
          title: el.getAttribute("title"),
          target: el.getAttribute("target"),
        };
      },
    },
  ],
  toDOM(node) {
    return ["a", node.attrs, 0];
  },
};

const highlight: MarkSpec = {
  attrs: { color: { default: "yellow" } },
  parseDOM: [
    {
      tag: "mark",
      getAttrs(dom) {
        const el = dom as HTMLElement;
        return { color: el.getAttribute("data-color") || "yellow" };
      },
    },
  ],
  toDOM(node) {
    return [
      "mark",
      {
        "data-color": node.attrs.color,
        class: `highlight-${node.attrs.color}`,
      },
      0,
    ];
  },
};

// ============ Schema Export ============

export const schema = new Schema({
  nodes: {
    doc,
    paragraph,
    text,
    hard_break,
    heading,
    blockquote,
    code_block,
    horizontal_rule,
    image,
    bullet_list,
    ordered_list,
    list_item,
    task_list,
    task_item,
    toggle_list,
    toggle_item,
    callout,
  },
  marks: {
    strong,
    em,
    code,
    underline,
    strikethrough,
    link,
    highlight,
  },
});

// ============ Block Type Definitions for Slash Menu ============

export interface BlockType {
  id: string;
  label: string;
  description: string;
  icon: string;
  keywords: string[];
  action: "node" | "mark" | "custom";
  nodeType?: string;
  attrs?: Record<string, unknown>;
}

export const blockTypes: BlockType[] = [
  // Text blocks
  {
    id: "paragraph",
    label: "Text",
    description: "Just start writing with plain text.",
    icon: "Aa",
    keywords: ["text", "paragraph", "plain"],
    action: "node",
    nodeType: "paragraph",
  },
  {
    id: "heading1",
    label: "Heading 1",
    description: "Big section heading.",
    icon: "H1",
    keywords: ["h1", "heading", "title", "big"],
    action: "node",
    nodeType: "heading",
    attrs: { level: 1 },
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Medium section heading.",
    icon: "H2",
    keywords: ["h2", "heading", "subtitle", "medium"],
    action: "node",
    nodeType: "heading",
    attrs: { level: 2 },
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "Small section heading.",
    icon: "H3",
    keywords: ["h3", "heading", "small"],
    action: "node",
    nodeType: "heading",
    attrs: { level: 3 },
  },
  // Lists
  {
    id: "bullet_list",
    label: "Bulleted List",
    description: "Create a simple bulleted list.",
    icon: "•",
    keywords: ["bullet", "list", "unordered", "ul"],
    action: "node",
    nodeType: "bullet_list",
  },
  {
    id: "ordered_list",
    label: "Numbered List",
    description: "Create a list with numbering.",
    icon: "1.",
    keywords: ["number", "list", "ordered", "ol"],
    action: "node",
    nodeType: "ordered_list",
  },
  {
    id: "task_list",
    label: "To-do List",
    description: "Track tasks with a to-do list.",
    icon: "☑",
    keywords: ["todo", "task", "checkbox", "check"],
    action: "node",
    nodeType: "task_list",
  },
  {
    id: "toggle_list",
    label: "Toggle List",
    description: "Toggles can hide and show content.",
    icon: "▶",
    keywords: ["toggle", "collapse", "expand", "dropdown"],
    action: "node",
    nodeType: "toggle_list",
  },
  // Blocks
  {
    id: "blockquote",
    label: "Quote",
    description: "Capture a quote.",
    icon: "❝",
    keywords: ["quote", "blockquote", "citation"],
    action: "node",
    nodeType: "blockquote",
  },
  {
    id: "callout",
    label: "Callout",
    description: "Make writing stand out.",
    icon: "💡",
    keywords: ["callout", "info", "note", "tip", "warning"],
    action: "node",
    nodeType: "callout",
  },
  {
    id: "code_block",
    label: "Code",
    description: "Capture a code snippet.",
    icon: "</>",
    keywords: ["code", "snippet", "pre", "programming"],
    action: "node",
    nodeType: "code_block",
  },
  {
    id: "horizontal_rule",
    label: "Divider",
    description: "Visually divide blocks.",
    icon: "—",
    keywords: ["divider", "hr", "line", "separator"],
    action: "node",
    nodeType: "horizontal_rule",
  },
  {
    id: "image",
    label: "Image",
    description: "Upload or embed an image.",
    icon: "🖼",
    keywords: ["image", "picture", "photo", "img"],
    action: "custom",
  },
  // AI-powered blocks
  {
    id: "ai_continue",
    label: "Continue writing",
    description: "Let AI continue your text.",
    icon: "✨",
    keywords: ["ai", "continue", "write", "generate", "auto"],
    action: "custom",
  },
  {
    id: "ai_summarize",
    label: "Summarize",
    description: "AI summarizes your content.",
    icon: "📝",
    keywords: ["ai", "summarize", "summary", "tldr", "short"],
    action: "custom",
  },
  {
    id: "ai_expand",
    label: "Expand",
    description: "AI expands on your ideas.",
    icon: "📖",
    keywords: ["ai", "expand", "elaborate", "more", "detail"],
    action: "custom",
  },
  {
    id: "ai_improve",
    label: "Improve writing",
    description: "AI improves your text quality.",
    icon: "✏️",
    keywords: ["ai", "improve", "enhance", "better", "fix"],
    action: "custom",
  },
  {
    id: "ai_brainstorm",
    label: "Brainstorm ideas",
    description: "Generate ideas about a topic.",
    icon: "💭",
    keywords: ["ai", "brainstorm", "ideas", "suggest", "think"],
    action: "custom",
  },
];

export default schema;
