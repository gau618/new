import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// Available writing tones
export type WritingTone =
  | "professional"
  | "casual"
  | "formal"
  | "friendly"
  | "creative"
  | "academic";

// Continuation length options
export type ContinuationLength = "short" | "medium" | "long";

export const LENGTH_OPTIONS: {
  value: ContinuationLength;
  label: string;
  description: string;
}[] = [
  { value: "short", label: "Short", description: "3-4 sentences" },
  { value: "medium", label: "Medium", description: "5-6 sentences" },
  { value: "long", label: "Long", description: "7-8 sentences" },
];

const lengthInstructions: Record<ContinuationLength, string> = {
  short: "Write exactly 3-4 sentences",
  medium: "Write exactly 5-6 sentences",
  long: "Write exactly 7-8 sentences",
};

// Modify actions for AI suggestions
export type ModifyAction =
  | "shorten"
  | "expand"
  | "rephrase"
  | "formal"
  | "casual"
  | "summarize"
  | "improve"
  | "brainstorm";

// Context information for smarter AI responses
export interface EditorContext {
  textBefore: string;
  textAfter: string;
  currentBlockType: string;
  isInList: boolean;
  isInCode: boolean;
  recentContext: string;
  documentTitle?: string;
}

// ProseMirror schema definition for the AI
const PROSEMIRROR_SCHEMA = `
You must output valid JSON matching this ProseMirror document schema.

AVAILABLE NODE TYPES:
1. "paragraph" - Regular text paragraph
   { "type": "paragraph", "content": [{ "type": "text", "text": "Your text here." }] }

2. "heading" - Headings (attrs.level: 1, 2, or 3)
   { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Heading" }] }

3. "bullet_list" - Unordered list containing list_item nodes
   { "type": "bullet_list", "content": [
     { "type": "list_item", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item 1" }] }] },
     { "type": "list_item", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item 2" }] }] }
   ]}

4. "ordered_list" - Numbered list containing list_item nodes
   { "type": "ordered_list", "content": [
     { "type": "list_item", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Step 1" }] }] }
   ]}

5. "task_list" - Todo list containing task_item nodes
   { "type": "task_list", "content": [
     { "type": "task_item", "attrs": { "checked": false }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Task" }] }] }
   ]}

6. "code_block" - Code block
   { "type": "code_block", "content": [{ "type": "text", "text": "const x = 1;" }] }

7. "blockquote" - Quote block
   { "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Quote" }] }] }

8. "callout" - Note/callout box
   { "type": "callout", "attrs": { "type": "info" }, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Note" }] }] }

TEXT MARKS (optional, for formatting):
- Bold: { "type": "text", "marks": [{ "type": "bold" }], "text": "bold" }
- Italic: { "type": "text", "marks": [{ "type": "italic" }], "text": "italic" }
- Code: { "type": "text", "marks": [{ "type": "code" }], "text": "code" }

OUTPUT FORMAT - Return ONLY a JSON object like this:
{
  "content": [
    { "type": "paragraph", "content": [{ "type": "text", "text": "Your content here." }] }
  ]
}
`;

export const TONE_OPTIONS: { value: WritingTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
  { value: "creative", label: "Creative" },
  { value: "academic", label: "Academic" },
];

const toneDescriptions: Record<WritingTone, string> = {
  professional: "professional and business-appropriate",
  casual: "casual and conversational",
  formal: "formal and polished",
  friendly: "warm and friendly",
  creative: "creative and expressive with vivid language",
  academic: "academic and scholarly",
};

// Determine what node type(s) to generate based on context
function getExpectedNodeType(context: EditorContext): string {
  const { currentBlockType, isInList, isInCode, textBefore } = context;

  if (isInCode || currentBlockType === "code_block") {
    return "Generate a code_block node. Continue the code.";
  }

  if (
    currentBlockType === "list_item" ||
    (isInList && currentBlockType !== "task_item")
  ) {
    return "Generate a bullet_list with more list_item nodes. Continue the list.";
  }

  if (currentBlockType === "task_item") {
    return "Generate a task_list with task_item nodes (checked: false).";
  }

  if (currentBlockType === "blockquote") {
    return "Generate content inside a blockquote node.";
  }

  if (currentBlockType === "callout") {
    return "Generate content inside a callout node.";
  }

  // Check for list-suggesting patterns
  const recentText = textBefore.slice(-200);
  if (
    /(?:here are|following|these are|list of|steps to|ways to|features:|benefits:|points:|reasons:)\s*$/i.test(
      recentText
    )
  ) {
    return "Generate a bullet_list with 3-5 list_item nodes.";
  }

  if (/:\s*$/.test(recentText)) {
    return "Context ends with colon - generate a bullet_list.";
  }

  // Check for code patterns
  if (
    /(?:code|function|implement|example in|write a)\s*(?:javascript|typescript|python|java|react)/i.test(
      recentText
    )
  ) {
    return "Generate a code_block with appropriate code.";
  }

  // Default: paragraph
  return "Generate paragraph node(s) with natural prose.";
}

// Build the structured prompt for JSON output
function buildStructuredPrompt(
  context: EditorContext,
  tone: WritingTone,
  length: ContinuationLength = "short"
): string {
  const {
    textBefore,
    textAfter,
    documentTitle,
    currentBlockType,
    isInList,
    isInCode,
  } = context;
  const toneDesc = toneDescriptions[tone];
  const expectedNodeType = getExpectedNodeType(context);

  const precedingText = textBefore.slice(-1000).trim();
  const followingText = textAfter.slice(0, 200).trim();

  let positionDesc = "in a paragraph";
  if (isInCode) positionDesc = "inside a code block";
  else if (currentBlockType === "task_item")
    positionDesc = "inside a task list";
  else if (currentBlockType === "list_item" || isInList)
    positionDesc = "inside a bullet list";
  else if (currentBlockType === "blockquote")
    positionDesc = "inside a blockquote";
  else if (currentBlockType === "callout") positionDesc = "inside a callout";
  else if (currentBlockType.startsWith("heading"))
    positionDesc = `after a ${currentBlockType}`;

  return `You are an AI writing assistant. Generate content as ProseMirror JSON.

${PROSEMIRROR_SCHEMA}

CONTEXT:
${documentTitle ? `- Document: "${documentTitle}"` : ""}
- Position: ${positionDesc}
- Tone: ${toneDesc}

PRECEDING TEXT:
"""
${precedingText}
"""
${followingText ? `\nFOLLOWING TEXT:\n"""\n${followingText}\n"""` : ""}

TASK: ${expectedNodeType}

RULES:
1. Output ONLY valid JSON - no markdown, no explanations
2. Do NOT repeat existing text
3. ${lengthInstructions[length]} or 2-3 list items - be concise
4. Use ${toneDesc} tone
5. CRITICAL: Stay strictly on the SAME topic as the preceding text. Do NOT introduce new topics, subjects, or unrelated content
6. Only continue the thought or idea that was being written - do not add conclusions or transitions to other topics

JSON OUTPUT:`;
}

// Parse AI response to extract JSON
export function parseAIResponse(response: string): any {
  let jsonStr = response.trim();

  // Remove markdown code fences if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse AI JSON:", e, jsonStr);
    // Fallback: create a simple paragraph
    return {
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: response.trim().slice(0, 500) }],
        },
      ],
    };
  }
}

// Extract plain text from parsed nodes for display during streaming
function extractDisplayText(parsed: any): string {
  const extractText = (node: any): string => {
    if (node.text) return node.text;
    if (node.content) {
      const texts = node.content.map(extractText);
      if (
        node.type === "bullet_list" ||
        node.type === "ordered_list" ||
        node.type === "task_list"
      ) {
        return texts.map((t: string) => `• ${t}`).join("\n");
      }
      if (node.type === "list_item" || node.type === "task_item") {
        return texts.join("");
      }
      return texts.join(" ");
    }
    return "";
  };

  if (!parsed.content) return "";

  return parsed.content.map((node: any) => extractText(node)).join("\n\n");
}

// Non-streaming generation that returns structured JSON
export async function generateStructuredContent(
  context: EditorContext,
  tone: WritingTone = "professional",
  length: ContinuationLength = "short"
): Promise<any> {
  try {
    const prompt = buildStructuredPrompt(context, tone, length);
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log("AI Structured Response:", response);
    return parseAIResponse(response);
  } catch (error) {
    console.error("Structured generation error:", error);
    throw error;
  }
}

// Streaming version - shows text preview then provides JSON
export async function* generateContinuationStream(
  currentText: string,
  tone: WritingTone = "professional",
  editorContext?: EditorContext,
  length: ContinuationLength = "short"
) {
  try {
    if (!editorContext) {
      // Simple fallback for no context
      const toneInstruction = toneDescriptions[tone];
      const lengthInstruction = lengthInstructions[length];
      const prompt = `Continue writing naturally in a ${toneInstruction} tone. ${lengthInstruction}. Do not repeat original text.

"${currentText}"

Continue:`;

      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          for (const char of chunkText) {
            yield char;
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        }
      }
      return;
    }

    // For structured output, get the full response
    const prompt = buildStructuredPrompt(editorContext, tone, length);
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse the JSON
    const parsed = parseAIResponse(response);

    // Extract display text for streaming preview
    const displayText = extractDisplayText(parsed);

    // Stream the display text for visual feedback
    for (const char of displayText) {
      yield char;
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    // Yield the JSON data with a special marker
    yield `<<<PMJSON>>>${JSON.stringify(parsed)}<<<PMJSON>>>`;
  } catch (error) {
    console.error("Stream error:", error);
    throw error;
  }
}

// Modify text actions
const modifyInstructions: Record<ModifyAction, string> = {
  shorten: "Make shorter and more concise. Keep same format.",
  expand: "Expand with more details. If a list, add more items.",
  rephrase: "Rephrase differently. Keep same meaning and format.",
  formal: "Rewrite in a more formal tone. Keep same format.",
  casual: "Rewrite in a casual tone. Keep same format.",
  summarize: "Summarize key points. Use bullet_list if appropriate.",
  improve: "Improve clarity and flow. Keep format intact.",
  brainstorm: "Generate creative ideas as a bullet_list.",
};

export async function* modifyTextStream(
  text: string,
  action: ModifyAction,
  _editorContext?: EditorContext
) {
  try {
    const instruction = modifyInstructions[action];

    const prompt = `${instruction}

INPUT:
"""
${text}
"""

Output only the modified text:`;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        const cleaned = chunkText.replace(/\s{3,}/g, "  ");
        for (const char of cleaned) {
          yield char;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
    }
  } catch (error) {
    console.error("Modify stream error:", error);
    throw error;
  }
}

// ============ Agent Mode (Pro Feature) ============

const AGENT_SYSTEM_PROMPT = `You are Chronicle AI Agent, an advanced writing assistant with FULL EDITOR CONTROL. You can directly manipulate the user's document.

YOUR CAPABILITIES (Full Editor Access):
1. **Insert Content**: Add text at cursor or end of document (PREFERRED)
2. **Append Content**: Add content at the end
3. **Replace Content**: Replace entire document (only when explicitly asked)
4. **Generate Outlines**: Create structured outlines

ACTION COMMANDS (Use these to control the editor):
When you want to make changes to the document, wrap the content in these special tags:

- To INSERT content (DEFAULT - use this most often): [[[INSERT]]]your content here[[[/INSERT]]]
- To APPEND at end: [[[APPEND]]]content to add at end[[[/APPEND]]]
- To REPLACE all content (ONLY if user explicitly asks to replace): [[[REPLACE_ALL]]]new content[[[/REPLACE_ALL]]]

IMPORTANT FORMATTING RULES:
1. ALWAYS use INSERT unless user explicitly says "replace" or "rewrite everything"
2. Use proper markdown formatting:
   - # for main headings (H1)
   - ## for section headings (H2)
   - ### for subsection headings (H3)
   - **bold text** for emphasis
   - *italic text* for slight emphasis
   - - for bullet points (dash followed by space)
   - 1. for numbered lists
3. Put each heading on its own line
4. Put each bullet point on its own line
5. Add blank lines between sections

EXAMPLE OF WELL-FORMATTED CONTENT:
[[[INSERT]]]
# Main Title

This is an introduction paragraph with **bold text** and *italic text*.

## Section Heading

- First bullet point
- Second bullet point with **emphasis**
- Third bullet point

### Subsection

Another paragraph here.
[[[/INSERT]]]

RESPONSE FORMAT:
- Be conversational but brief
- Always use action tags to add content
- Explain briefly what you're adding

PERSONALITY:
- Proactive and action-oriented
- Professional yet friendly`;

export async function* generateAgentResponse(
  userMessage: string,
  documentContext?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const contextSection = documentContext
      ? `\n\nDOCUMENT CONTEXT:\n"""\n${documentContext.slice(0, 3000)}\n"""\n`
      : "";

    const prompt = `${AGENT_SYSTEM_PROMPT}
${contextSection}
USER: ${userMessage}

AGENT:`;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error("Agent response error:", error);
    throw error;
  }
}

// Agent task types for structured responses
export type AgentTaskType =
  | "research"
  | "outline"
  | "rewrite"
  | "analyze"
  | "expand"
  | "summarize";

export interface AgentTask {
  type: AgentTaskType;
  input: string;
  context?: string;
}

// Execute a specific agent task
export async function* executeAgentTask(
  task: AgentTask
): AsyncGenerator<string, void, unknown> {
  const taskPrompts: Record<AgentTaskType, string> = {
    research: `Research the following topic and provide detailed, accurate information with key facts and insights:

Topic: ${task.input}
${task.context ? `\nContext: ${task.context}` : ""}

Provide comprehensive research:`,

    outline: `Create a detailed outline for the following topic or content:

${task.input}
${task.context ? `\nExisting context: ${task.context}` : ""}

Generate a structured outline with main sections and subsections:`,

    rewrite: `Completely rewrite the following content with improved clarity, flow, and engagement:

Original:
"""
${task.input}
"""
${task.context ? `\nDocument context: ${task.context}` : ""}

Rewritten version:`,

    analyze: `Analyze the following content and provide detailed suggestions for improvement:

Content:
"""
${task.input}
"""
${task.context ? `\nDocument context: ${task.context}` : ""}

Analysis and suggestions:`,

    expand: `Expand the following content with more details, examples, and depth:

Content:
"""
${task.input}
"""
${task.context ? `\nDocument context: ${task.context}` : ""}

Expanded content:`,

    summarize: `Summarize the following content, capturing the key points:

Content:
"""
${task.input}
"""

Summary:`,
  };

  try {
    const prompt = taskPrompts[task.type];
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error("Agent task error:", error);
    throw error;
  }
}
