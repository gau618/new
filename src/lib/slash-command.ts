import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export interface SlashMenuState {
  active: boolean;
  query: string;
  from: number;
  to: number;
}

export const slashMenuKey = new PluginKey<SlashMenuState>("slashMenu");

/**
 * Slash command plugin that tracks "/" input and manages menu state
 */
export const slashCommandPlugin = (
  _onTrigger: () => void,
  onMenuStateChange?: (state: SlashMenuState | null) => void
) => {
  return new Plugin<SlashMenuState>({
    key: slashMenuKey,

    state: {
      init() {
        return { active: false, query: "", from: 0, to: 0 };
      },

      apply(tr, prev) {
        const meta = tr.getMeta(slashMenuKey);

        if (meta !== undefined) {
          // Explicit state change (open/close/update)
          if (meta === null) {
            onMenuStateChange?.(null);
            return { active: false, query: "", from: 0, to: 0 };
          }
          onMenuStateChange?.(meta);
          return meta;
        }

        // If menu is active, update based on document changes
        if (prev.active && tr.docChanged) {
          // Get the text from slash position to cursor
          const $pos = tr.doc.resolve(tr.selection.from);
          const textBefore = $pos.parent.textBetween(
            0,
            $pos.parentOffset,
            null,
            "\ufffc"
          );

          // Find the slash and extract query
          const slashIndex = textBefore.lastIndexOf("/");

          if (slashIndex === -1) {
            // Slash was deleted
            onMenuStateChange?.(null);
            return { active: false, query: "", from: 0, to: 0 };
          }

          const query = textBefore.slice(slashIndex + 1);

          // Close menu if query contains space (user moved on)
          if (query.includes(" ")) {
            onMenuStateChange?.(null);
            return { active: false, query: "", from: 0, to: 0 };
          }

          const newState = {
            active: true,
            query,
            from: $pos.start() + slashIndex,
            to: tr.selection.from,
          };

          onMenuStateChange?.(newState);
          return newState;
        }

        // Selection changed without doc change - check if we moved away
        if (prev.active && !tr.docChanged) {
          const { from: cursorFrom } = tr.selection;
          const { from: slashFrom, to: slashTo } = prev;

          // If cursor moved outside the slash command range, close menu
          if (cursorFrom < slashFrom || cursorFrom > slashTo + 20) {
            onMenuStateChange?.(null);
            return { active: false, query: "", from: 0, to: 0 };
          }
        }

        return prev;
      },
    },

    props: {
      handleKeyDown(view, event) {
        const state = slashMenuKey.getState(view.state);

        // Handle "/" to open menu
        if (event.key === "/") {
          const { $from } = view.state.selection;

          // Check if at start of block or after whitespace
          const textBefore = $from.parent.textBetween(
            0,
            $from.parentOffset,
            null,
            "\ufffc"
          );

          const isValidPosition =
            $from.parentOffset === 0 ||
            textBefore.endsWith(" ") ||
            textBefore.endsWith("\n");

          if (isValidPosition) {
            // Open slash menu
            const from = $from.pos;

            // Let the "/" be typed first, then activate menu
            setTimeout(() => {
              const newState: SlashMenuState = {
                active: true,
                query: "",
                from: from,
                to: from + 1,
              };

              const tr = view.state.tr.setMeta(slashMenuKey, newState);
              view.dispatch(tr);
            }, 0);
          }
        }

        // Handle Escape to close menu
        if (event.key === "Escape" && state?.active) {
          const tr = view.state.tr.setMeta(slashMenuKey, null);
          view.dispatch(tr);
          return true;
        }

        // Let arrow keys and Enter be handled by the React component
        if (state?.active) {
          if (
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "Enter"
          ) {
            // Prevent ProseMirror from handling these
            return false; // Let it bubble up to React
          }
        }

        return false;
      },

      // Decorations to highlight the slash command
      decorations(state) {
        const pluginState = slashMenuKey.getState(state);

        if (!pluginState?.active) {
          return DecorationSet.empty;
        }

        const { from, to } = pluginState;

        return DecorationSet.create(state.doc, [
          Decoration.inline(from, to, {
            class: "slash-command-highlight",
          }),
        ]);
      },
    },
  });
};

/**
 * Close the slash menu and optionally delete the slash command text
 */
export function closeSlashMenu(view: any, deleteText: boolean = true): void {
  const state = slashMenuKey.getState(view.state);

  if (!state?.active) return;

  let tr = view.state.tr.setMeta(slashMenuKey, null);

  if (deleteText) {
    tr = tr.delete(state.from, state.to);
  }

  view.dispatch(tr);
}

/**
 * Get current slash menu state from editor view
 */
export function getSlashMenuState(view: any): SlashMenuState | null {
  const state = slashMenuKey.getState(view.state);
  return state?.active ? state : null;
}
