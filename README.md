# Chronicle: AI-Assisted Editor

Chronicle is a modern, AI-powered text editor designed to act as a creative partner for writers. It helps overcome writer's block by intelligently generating content continuations, rephrasing text, and more, directly within a clean and focused writing environment.

![Demo](https://i.imgur.com/sAV331j.gif)

## Live Demo

Check out the live demo at [https://new-nu-smoky.vercel.app/](https://new-nu-smoky.vercel.app/)

## Features

- **AI-Powered Writing:** Continue your writing, rephrase sentences, change the tone, and more with the "Continue Writing" and text selection AI tools.
- **Rich Text Editor:** Built with Prosemirror, offering a stable, extensible, and familiar writing experience.
- **Slash Commands:** Press `/` to quickly insert different block types (headings, lists) or trigger AI actions.
- **State-Driven Logic:** predictable state management powered by XState ensures that the application behaves as expected, whether the AI is generating text, handling user input, or saving the document.
- **Autosave:** Document changes are saved automatically.
- **Pro Mode:** An advanced "Agent Mode" gives the AI more control to perform complex tasks like generating outlines from a simple prompt.

## Keyboard Shortcuts

### Text Formatting

- `Ctrl/Cmd + B` - Toggle bold
- `Ctrl/Cmd + I` - Toggle italic
- `Ctrl/Cmd + U` - Toggle underline
- `Ctrl/Cmd + Shift + S` - Toggle strikethrough
- `Ctrl/Cmd + Shift + 1-3` - Convert to heading (H1-H3)
- `Ctrl/Cmd + Shift + 0` - Convert to paragraph
- `Ctrl/Cmd + K` - Insert/edit link

### Block Operations

- `Ctrl/Cmd + Enter` - Exit current block
- `Escape` - Exit current block
- `Alt + ↑` - Move block up
- `Alt + ↓` - Move block down
- `Ctrl/Cmd + D` - Duplicate block

### Slash Commands

- `/` - Open slash menu for blocks and AI actions
  - Type to filter options
  - `↑/↓` - Navigate options
  - `Enter` - Select option
  - `Escape` - Close menu

### Available Slash Commands

- **Text:** Paragraph, Heading 1-3
- **Lists:** Bulleted List, Numbered List, To-do List, Toggle List
- **Blocks:** Quote, Callout, Code Block, Divider, Image
- **AI Assistant:** Continue writing, Summarize, Expand, Improve writing, Brainstorm ideas

## Tech Stack

- **Frontend:** React with TypeScript
- **Bundler:** Vite
- **Text Editor:** Prosemirror
- **State Management:** XState
- **AI:** Google Gemini 1.5 Pro
- **Backend/DB:** Firebase (for auth and document storage)

## Architecture Overview

The application is architected around a clear separation of concerns, making it modular and maintainable.

- **`src/components`**: Contains all React components, which are primarily responsible for rendering the UI. The core `Editor.tsx` component encapsulates the entire Prosemirror setup.
- **`src/pages`**: Holds the main page components that assemble the application's UI from smaller components. `EditorPage.tsx` is the main view, bringing together the editor, sidebars, and toolbars.
- **`src/machines`**: The brain of the application's dynamic behavior. `editorMachine.ts` is an XState state machine that orchestrates the entire AI text generation lifecycle, from sending the initial request to handling the streaming response, and managing user actions like accepting or rejecting suggestions.
- **`src/hooks`**: Reusable hooks for managing cross-cutting concerns like autosaving (`useAutoSave`), user preferences (`useUserPreferences`), and interacting with the XState machine (`useEditorAI`).
- **`src/lib`**: Core logic and third-party service integrations.
  - `ai.ts`: Contains all the logic for interacting with the Google Gemini API, including prompt engineering and handling streaming responses. It cleverly asks the AI to respond with Prosemirror-compatible JSON.
  - `editor-config.ts` & `block-commands.ts`: Define the Prosemirror schema, plugins, and custom commands.
  - `firebase.ts`: Handles Firebase authentication and Firestore database interactions.
- **`src/contexts`**: React contexts for sharing global state like the current theme, authentication status, and document data.

## How It Works

1.  The user types in the Prosemirror-based **`Editor`** component.
2.  When the "Continue Writing" button is pressed or a slash command is used, an event is dispatched to the XState machine managed by the **`useEditorAI`** hook.
3.  The **`editorMachine`** enters the `streaming` state and invokes the `generateContinuationStream` function from `lib/ai.ts`.
4.  A carefully constructed prompt is sent to the **Google Gemini API**, instructing it to return a response formatted as Prosemirror JSON.
5.  As the AI response streams back, the `Editor` component inserts the text in real-time and marks it as an italicized suggestion.
6.  Once the stream is complete, the `editorMachine` transitions to the `pending` state, and a toolbar appears allowing the user to **Accept**, **Reject**, or **Modify** the suggestion.
7.  If **Accepted**, the italic styling is removed, and the text is parsed as proper Prosemirror nodes (e.g., lists, headings). If **Rejected**, the suggestion is deleted.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/gau618/new.git
    cd chronicle-editor
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project and add your Google Gemini API key:

    ```
    VITE_GEMINI_API_KEY=your_api_key_here
    ```

    _(You will also need to configure Firebase credentials in `src/lib/firebase.ts` for a full build, but the editor can be run locally without it.)_

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application should now be running on `http://localhost:5173`.

### Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run preview`: Serves the production build locally.
