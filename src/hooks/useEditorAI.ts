import { useCallback } from "react";
import { useMachine } from "@xstate/react";
import { editorMachine } from "../machines/editorMachine";
import type {
  WritingTone,
  ModifyAction,
  EditorContext,
  ContinuationLength,
} from "../lib/ai";

export function useEditorAI() {
  const [state, send] = useMachine(editorMachine);

  const handleGenerate = useCallback(
    (
      currentContent: string,
      tone: WritingTone,
      action?: ModifyAction,
      selectedText?: string,
      editorContext?: EditorContext,
      length?: ContinuationLength
    ) => {
      if (action && selectedText) {
        send({
          type: "GENERATE_WITH_ACTION",
          selectedText,
          action,
          editorContext,
        });
      } else {
        send({
          type: "GENERATE",
          currentText: currentContent,
          tone,
          editorContext,
          length: length || "short",
        });
      }
    },
    [send]
  );

  const handleStop = useCallback(() => {
    send({ type: "STOP" });
  }, [send]);

  const handleAccept = useCallback(() => {
    send({ type: "ACCEPT" });
  }, [send]);

  const handleReject = useCallback(() => {
    send({ type: "REJECT" });
  }, [send]);

  const handleModify = useCallback(
    (action: ModifyAction) => {
      send({ type: "MODIFY", action });
    },
    [send]
  );

  return {
    state,
    handleGenerate,
    handleStop,
    handleAccept,
    handleReject,
    handleModify,
    isStreaming: state.matches("streaming"),
    isModifying: state.matches("modifying"),
    hasPendingSuggestion: state.matches("pending"),
    hasError: state.matches("idle") && !!state.context.error,
  };
}
