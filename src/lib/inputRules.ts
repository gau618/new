import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
  InputRule,
} from "prosemirror-inputrules";
import { schema } from "./editor-config";

// Building input rules for Markdown shortcuts
export function buildInputRules() {
  const rules = [...smartQuotes, ellipsis, emDash];

  // Rules for headings (e.g., # Heading 1)
  for (let i = 1; i <= 6; i++) {
    rules.push(
      textblockTypeInputRule(
        new RegExp(`^(#{${i}})\\s$`),
        schema.nodes.heading,
        { level: i }
      )
    );
  }

  // IMPORTANT: Task list rules must come BEFORE bullet list rules
  // because they both start with "-"

  // Rule for task lists: "- [ ] " (dash, space, brackets, space)
  rules.push(
    new InputRule(/^-\s\[\s\]\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const taskItem = schema.nodes.task_item.create(
        { checked: false },
        paragraph
      );
      const taskList = schema.nodes.task_list.create(null, taskItem);

      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, taskList);
    })
  );

  // Rule for checked task items: "- [x] "
  rules.push(
    new InputRule(/^-\s\[x\]\s$/i, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const taskItem = schema.nodes.task_item.create(
        { checked: true },
        paragraph
      );
      const taskList = schema.nodes.task_list.create(null, taskItem);

      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, taskList);
    })
  );

  // Rule for toggle lists: ">> " (double greater-than, space)
  rules.push(
    new InputRule(/^>>\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const toggleItem = schema.nodes.toggle_item.create(
        { open: true },
        paragraph
      );
      const toggleList = schema.nodes.toggle_list.create(null, toggleItem);

      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, toggleList);
    })
  );

  // Rule for blockquotes (e.g., > Quote) - single > only
  rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));

  // Rule for bullet lists (e.g., * Item or + Item) - NOT "-" to avoid conflict with task
  rules.push(wrappingInputRule(/^\s*([+*])\s$/, schema.nodes.bullet_list));

  // Rule for ordered lists (e.g., 1. Item)
  rules.push(
    wrappingInputRule(
      /^(\d+)\.\s$/,
      schema.nodes.ordered_list,
      (match) => ({ order: +match[1] }),
      (match, node) => node.childCount + node.attrs.order === +match[1]
    )
  );

  // Rule for code blocks (e.g., ```)
  rules.push(textblockTypeInputRule(/^```$/, schema.nodes.code_block));

  // Rule for code blocks with language (e.g., ```javascript)
  rules.push(
    textblockTypeInputRule(
      /^```(\w+)\s$/,
      schema.nodes.code_block,
      (match) => ({ language: match[1] })
    )
  );

  // Rule for horizontal rule (e.g., --- or ***)
  rules.push(
    new InputRule(/^([-*_]){3,}\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const hr = schema.nodes.horizontal_rule.create();
      const paragraph = schema.nodes.paragraph.create();

      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, [
        hr,
        paragraph,
      ]);
    })
  );

  // Rule for callouts: "::: " at start of line
  rules.push(
    new InputRule(/^:::\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const callout = schema.nodes.callout.create(
        { emoji: "💡", type: "info" },
        paragraph
      );

      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, callout);
    })
  );

  // Callout variants
  rules.push(
    new InputRule(/^:::info\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const callout = schema.nodes.callout.create(
        { emoji: "ℹ️", type: "info" },
        paragraph
      );
      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, callout);
    })
  );

  rules.push(
    new InputRule(/^:::warning\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const callout = schema.nodes.callout.create(
        { emoji: "⚠️", type: "warning" },
        paragraph
      );
      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, callout);
    })
  );

  rules.push(
    new InputRule(/^:::success\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const callout = schema.nodes.callout.create(
        { emoji: "✅", type: "success" },
        paragraph
      );
      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, callout);
    })
  );

  rules.push(
    new InputRule(/^:::error\s$/, (state, _match, start, _end) => {
      const $start = state.doc.resolve(start);
      const blockStart = $start.start();
      const blockEnd = $start.end();

      const paragraph = schema.nodes.paragraph.create();
      const callout = schema.nodes.callout.create(
        { emoji: "❌", type: "error" },
        paragraph
      );
      return state.tr.replaceWith(blockStart - 1, blockEnd + 1, callout);
    })
  );

  // Inline formatting rules using marks
  // Bold with ** or __
  rules.push(
    new InputRule(/\*\*([^*]+)\*\*$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.strong.create();
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  rules.push(
    new InputRule(/__([^_]+)__$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.strong.create();
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  // Italic with * or _
  rules.push(
    new InputRule(/(?<!\*)\*([^*]+)\*(?!\*)$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.em.create();
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  rules.push(
    new InputRule(/(?<!_)_([^_]+)_(?!_)$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.em.create();
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  // Inline code with `
  rules.push(
    new InputRule(/`([^`]+)`$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.code.create();
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  // Strikethrough with ~~
  rules.push(
    new InputRule(/~~([^~]+)~~$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.strikethrough.create();
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  // Highlight with ==
  rules.push(
    new InputRule(/==([^=]+)==$/, (state, match, start, _end) => {
      const text = match[1];
      const mark = schema.marks.highlight.create({ color: "yellow" });
      return state.tr
        .delete(start, _end)
        .insert(start, schema.text(text, [mark]));
    })
  );

  return inputRules({ rules });
}
