import { setup, fromCallback, assign } from "xstate";
import {
  generateContinuationStream,
  modifyTextStream,
  type WritingTone,
  type ModifyAction,
  type EditorContext,
  type ContinuationLength,
} from "../lib/ai";

export const editorMachine = setup({
  types: {
    context: {} as {
      generatedText: string;
      pendingSuggestion: string;
      error: string | null;
      selectedText: string;
    },
    events: {} as
      | {
          type: "GENERATE";
          currentText: string;
          tone: WritingTone;
          editorContext?: EditorContext;
          length?: ContinuationLength;
        }
      | {
          type: "GENERATE_WITH_ACTION";
          selectedText: string;
          action: ModifyAction;
          editorContext?: EditorContext;
        }
      | { type: "AI.CHUNK"; chunk: string }
      | { type: "AI.DONE" }
      | { type: "AI.ERROR"; error: unknown }
      | { type: "STOP" }
      | { type: "ACCEPT" }
      | { type: "REJECT" }
      | { type: "MODIFY"; action: ModifyAction },
  },
  actors: {
    streamingAI: fromCallback(
      ({
        input,
        sendBack,
      }: {
        input: {
          text: string;
          tone: WritingTone;
          editorContext?: EditorContext;
          length?: ContinuationLength;
        };
        sendBack: (event: any) => void;
      }) => {
        let cancelled = false;

        const run = async () => {
          try {
            const stream = generateContinuationStream(
              input.text,
              input.tone,
              input.editorContext,
              input.length || "short"
            );
            for await (const chunk of stream) {
              if (cancelled) break;
              sendBack({ type: "AI.CHUNK", chunk });
            }
            if (!cancelled) {
              sendBack({ type: "AI.DONE" });
            }
          } catch (err) {
            if (!cancelled) {
              sendBack({ type: "AI.ERROR", error: err });
            }
          }
        };

        run();

        // Cleanup function
        return () => {
          cancelled = true;
        };
      }
    ),
    modifyingAI: fromCallback(
      ({
        input,
        sendBack,
      }: {
        input: {
          text: string;
          action: ModifyAction;
          editorContext?: EditorContext;
        };
        sendBack: (event: any) => void;
      }) => {
        let cancelled = false;

        const run = async () => {
          try {
            const stream = modifyTextStream(
              input.text,
              input.action,
              input.editorContext
            );
            for await (const chunk of stream) {
              if (cancelled) break;
              sendBack({ type: "AI.CHUNK", chunk });
            }
            if (!cancelled) {
              sendBack({ type: "AI.DONE" });
            }
          } catch (err) {
            if (!cancelled) {
              sendBack({ type: "AI.ERROR", error: err });
            }
          }
        };

        run();

        return () => {
          cancelled = true;
        };
      }
    ),
  },
}).createMachine({
  id: "editor",
  initial: "idle",
  context: {
    generatedText: "",
    pendingSuggestion: "",
    error: null,
    selectedText: "",
  },
  states: {
    idle: {
      on: {
        GENERATE: {
          target: "streaming",
          actions: assign({
            generatedText: "",
            pendingSuggestion: "",
            error: null,
          }),
        },
        GENERATE_WITH_ACTION: {
          target: "modifying",
          actions: assign({
            generatedText: "",
            pendingSuggestion: "",
            selectedText: ({ event }) => (event as any).selectedText,
            error: null,
          }),
        },
      },
    },
    streaming: {
      invoke: {
        src: "streamingAI",
        input: ({ event }) => ({
          text: (event as any).currentText,
          tone: (event as any).tone as WritingTone,
          editorContext: (event as any).editorContext as
            | EditorContext
            | undefined,
          length: (event as any).length as ContinuationLength | undefined,
        }),
      },
      on: {
        "AI.CHUNK": {
          actions: assign({
            generatedText: ({ context, event }) =>
              context.generatedText + event.chunk,
          }),
        },
        "AI.DONE": {
          target: "pending",
          actions: assign({
            pendingSuggestion: ({ context }) => context.generatedText,
          }),
        },
        "AI.ERROR": {
          target: "idle",
          actions: assign({
            error: ({ event }) => String((event as any).error),
          }),
        },
        STOP: {
          target: "idle",
        },
      },
    },
    pending: {
      on: {
        ACCEPT: {
          target: "idle",
          actions: assign({
            generatedText: "",
            pendingSuggestion: "",
          }),
        },
        REJECT: {
          target: "idle",
          actions: assign({
            generatedText: "",
            pendingSuggestion: "",
          }),
        },
        MODIFY: {
          target: "modifying",
          actions: assign({
            generatedText: "",
          }),
        },
      },
    },
    modifying: {
      invoke: {
        src: "modifyingAI",
        input: ({ context, event }) => ({
          text: context.pendingSuggestion || context.selectedText,
          action: (event as any).action as ModifyAction,
          editorContext: (event as any).editorContext as
            | EditorContext
            | undefined,
        }),
      },
      on: {
        "AI.CHUNK": {
          actions: assign({
            generatedText: ({ context, event }) =>
              context.generatedText + event.chunk,
          }),
        },
        "AI.DONE": {
          target: "pending",
          actions: assign({
            pendingSuggestion: ({ context }) => context.generatedText,
          }),
        },
        "AI.ERROR": {
          target: "pending",
          actions: assign({
            error: ({ event }) => String((event as any).error),
          }),
        },
        STOP: {
          target: "pending",
        },
      },
    },
  },
});
