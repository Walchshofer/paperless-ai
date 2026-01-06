# Frontend Architecture & Developer Guide

## Overview

The `paperless-ai` frontend is a **Multi-Page Application (MPA)** built on a traditional stack:

-   **Server-Side Rendering (SSR):** [Express.js](https://expressjs.com/) + [EJS (Embedded JavaScript)](https://ejs.co/).
-   **Client-Side Logic:** Vanilla JavaScript (ES6+) with a custom component pattern.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) (CDN) + custom CSS files.
-   **No Build Step:** Currently, there is no frontend build pipeline (Webpack/Vite). Files are served directly from `public/`.

## Directory Structure

```text
paperless-ai/
├── views/                  # Server-side EJS templates
│   ├── layouts/            # Base HTML skeletons (if applicable)
│   ├── partials/           # Reusable EJS snippets (e.g., modals)
│   ├── chat.ejs            # Main Chat Interface
│   ├── dashboard.ejs       # Dashboard Page
│   ├── layout.ejs          # Global layout wrapper
│   └── ...                 # Other page templates
│
├── public/                 # Static Assets
│   ├── css/                # Stylesheets
│   │   ├── chat.css        # Chat-specific styles
│   │   ├── expert-components.css # Styles for JS components
│   │   └── ...
│   │
│   └── js/                 # Client-side Scripts
│       ├── chat.js         # Page controller for Chat
│       ├── dashboard.js    # Page controller for Dashboard
│       └── components/     # Reusable Vanilla JS classes
│           ├── ExpertMessage.js
│           ├── DocumentOverlay.js
│           ├── ThinkingAccordion.js
│           └── ...
```

## Core Technologies

1.  **EJS (Embedded JavaScript):**
    Used for composing HTML on the server. Data (like `documents` list, `user` info) is injected into templates at render time by Express controllers.

2.  **Tailwind CSS:**
    Loaded via CDN in `layout.ejs` (or individual page headers). Provides the utility-first styling framework.

3.  **Vanilla JS Component Pattern:**
    Since there is no bundler, "components" are implemented as **Global Classes** attached to the `window` object.
    
    *Example (`public/js/components/DocumentOverlay.js`):*
    ```javascript
    (function() {
      class DocumentOverlay {
        constructor(container) { ... }
        render(data) { ... }
      }
      window.DocumentOverlay = DocumentOverlay; // Export to global scope
    })();
    ```

## Page Architecture

Each major feature (Dashboard, Chat, Settings) corresponds to a specific **Route** -> **Controller** -> **View** flow.

### 1. Global Layout (`views/layout.ejs`)
The "shell" of the application. It typically handles:
-   `<html>`, `<head>`, `<body>` tags.
-   Global styles (Tailwind CDN).
-   Navigation Sidebar (often included directly or via partial).
-   `theme-toggle` logic.

### 2. Chat Interface (`views/chat.ejs` + `public/js/chat.js`)
This is the most complex page, featuring the "Visual RAG" capabilities.

-   **Structure:**
    -   **Sidebar:** Navigation.
    -   **Main Area:**
        -   **Document Select:** Dropdown to switch contexts.
        -   **Chat Tab:** Conversation history and input.
        -   **Visual Tab:** High-res document preview with bounding box overlays.
-   **Key Components:**
    -   `ExpertMessage`: Renders AI responses, including "Thinking" blocks and citations.
    -   `ThinkingAccordion`: Collapsible UI for showing the AI's internal reasoning chain.
    -   `OverlayViewer`: Manages the image canvas for visual grounding.
    -   `DocumentOverlay`: Draws bounding boxes on top of the document image.
    -   `OrchestratorStatus`: Shows the real-time status of the AI pipeline (e.g., "Routing...", "Generating...").

### 3. Dashboard (`views/dashboard.ejs` + `public/js/dashboard.js`)
Displays system overview, recent documents, and stats.

## Component Reference (Vanilla JS)

These components are located in `public/js/components/`. They must be included via `<script>` tags in the EJS view *before* the main page script runs.

| Component | Description | Usage |
| :--- | :--- | :--- |
| **`ExpertMessage`** | Renders a rich chat bubble. Handles Markdown parsing (via `marked`), syntax highlighting (via `highlight.js`), and citation rendering. | `new ExpertMessage(data).render()` |
| **`ThinkingAccordion`** | A collapsible detail view for "Chain of Thought" or debug logs provided by the AI model. | `new ThinkingAccordion(container).addStep(...)` |
| **`DocumentOverlay`** | Low-level class for drawing bounding boxes (`x,y,w,h`) on a container. Handles coordinate normalization (0-1000 scale to %). | `new DocumentOverlay(el).render(boxes)` |
| **`OverlayViewer`** | Higher-level controller for the "Visual" tab. Manages the image loading and delegates drawing to `DocumentOverlay`. | `const viewer = new OverlayViewer(...)` |
| **`OrchestratorStatus`** | Displays a stepper or status indicator for the backend RAG pipeline stages. | `new OrchestratorStatus(el)` |
| **`FeedbackForm`** | (If implemented) Handles user thumbs up/down and text feedback for AI responses. | `new FeedbackForm(...)` |

## Styling Strategy

-   **Primary:** Tailwind CSS utility classes (e.g., `flex`, `p-4`, `bg-blue-500`).
-   **Custom:**
    -   `expert-components.css`: Specific complex styles for the Chat components (accordions, message bubbles) that are too verbose for inline Tailwind.
    -   `overlay-viewer.css`: Positioning logic for the document visualizer layers.
-   **Theming:** Dark/Light mode is supported via a `data-theme` attribute on the `<html>` tag, toggled by local storage state.

## Data Flow & State

1.  **Initialization:**
    -   EJS templates render initial HTML state.
    -   Global variables (e.g., `documents`) are sometimes injected via `<script>` tags in the template: `const ALL_DOCS = <%- JSON.stringify(documents) %>;`.

2.  **Interactivity:**
    -   Page scripts (`chat.js`) attach event listeners to DOM elements.
    -   **API Calls:** `fetch()` is used to communicate with the backend (e.g., `/api/chat`, `/api/documents`).
    -   **State:** Managed in memory within the page script (e.g., `let currentDocumentId = null;`).

## Asset Management

-   **Images/Icons:** Stored in `public/` or `public/img/`.
-   **Font Awesome:** Loaded via CDN for icons.
-   **Markdown/Highlighting:** `marked.min.js` and `highlight.min.js` are loaded via CDN in `chat.ejs` and other relevant views.

## Development Workflow

1.  **Edit EJS:** Changes to `.ejs` files require a server restart (unless `nodemon` is handling the view engine reload, typically standard behavior).
2.  **Edit JS/CSS:** Changes to `public/` files are immediate on browser refresh (standard static file serving).
3.  **No Compilation:** You write standard ES6; no Babel or TypeScript transpilation is currently performed.

---

# Modernization: Preact Islands & Engineering Guardrails

To manage complexity while maintaining stability, we are adopting a strict "Islands" architecture coupled with formal engineering guardrails. This ensures the agent (and team) can build, verify, and maintain the UI without introducing stale fields or zombie code.

## 1. Engineering Policy: The "No Staleness" Mandate

To enable automated auditing and safe iteration, all UI development must adhere to three core constraints.

### A. View Model Contracts (No Stale Fields)
Instead of ad-hoc global injections, every page must render a single strict `vm` object validated by a Zod schema.

*   **Rule:** Server must render via `res.render("viewName", { vm })`.
*   **Rule:** Templates must only access data via `vm.*`.
*   **Implementation:**
    *   Define schemas in `src/ui/contracts/*.contract.ts` (using Zod).
    *   Validate data against the contract before rendering.
    *   **Build-Time Check:** Scripts must verify that EJS templates only reference fields defined in the contract.

### B. Element Identity (No Stale Elements)
To prevent "zombie buttons" and untestable UIs, every interactive element must be uniquely addressable.

*   **Rule:** Every page root must have `data-page="pageName"` (e.g., `data-page="chat"`).
*   **Rule:** Every interactive element (button, input, island anchor) must have `data-testid="feature-element"`.
*   **Naming Convention:** `kebab-case` (e.g., `chat-send-btn`, `doc-select-dropdown`).

### C. Automated Auditing (Runtime Verification)
An automated loop ensures the actual rendered UI matches expectations.

*   **Inventory Crawl:** A Playwright script visits pages and extracts all `data-testid`, form names, and `data-island` anchors.
*   **Snapshot Diffing:** This inventory is compared against a committed baseline (`tests/baselines/*.json`). Any unapproved drift triggers an alert.

## 2. Preact Islands Architecture

We use **Preact** for complex, stateful components (Chat, Visual Viewer) while keeping the EJS shell.

### Mounting Strategy: The Island Registry
Instead of manual script tags, we use a central registry to auto-mount islands. This allows the Auditor to verify that all intended islands are present.

**EJS Template:**
```html
<div data-page="chat">
  <!-- Island Anchor -->
  <div 
    data-island="thinking-accordion" 
    data-testid="thinking-accordion-island"
    data-props='<%- JSON.stringify(vm.thinkingProps) %>'
  ></div>

  <!-- Shared Island Runtime -->
  <script type="module">
    import { mountIslands } from '/js/dist/island-runtime.js'
    mountIslands(document.currentScript.parentElement)
  </script>
</div>
```

**Island Registry (`src/islands/runtime.ts`):**
```typescript
import { ThinkingAccordion } from './ThinkingAccordion.tsx'
/* ... imports ... */

const islandRegistry = {
  'thinking-accordion': ThinkingAccordion,
  /* ... mappings ... */
}

export function mountIslands(container: HTMLElement) {
  // Query [data-island], parse props, and render Preact components
}
```

### Build Configuration (Vite Library Mode)
We use Vite to generate deterministic bundles for each island, keeping bundle sizes small and predictable.

```typescript
// vite.config.ts
build: {
  lib: {
    entry: {
      'thinking-accordion': resolve(__dirname, 'src/islands/ThinkingAccordion.tsx'),
      'chat': resolve(__dirname, 'src/islands/Chat.tsx'),
      // ...
    },
    formats: ['es'],
    fileName: (format, entryName) => `${entryName}.island.js`,
  }
}
```

## 3. Implementation Plan

### Phase 1: Infrastructure (Weeks 1-2)
*   **Goal:** Establish the build pipeline and contract validation.
*   **Actions:**
    *   Create `vite.config.ts` with library mode & named entry points.
    *   Create `src/ui/contracts/` and add Zod validation to Express controllers.
    *   Implement `src/islands/runtime.ts` (registry).
    *   Add `scripts/check-contracts.js` for build-time verification.

### Phase 2: Pilot Island (Weeks 3-4)
*   **Goal:** Validate the workflow with `ThinkingAccordion`.
*   **Actions:**
    *   Convert `ThinkingAccordion.js` to `ThinkingAccordion.tsx`.
    *   Define `thinking-accordion.contract.ts`.
    *   Update `chat.ejs` to use `data-island`.
    *   Establish the Playwright audit baseline.

### Phase 3: Core Islands (Weeks 5-8)
*   **Goal:** Migrate Chat and Visual Viewer.
*   **Actions:**
    *   Create `Chat.tsx` and `VisualViewer.tsx`.
    *   Implement **Shared Signals** (`src/islands/shared-signals.ts`) for cross-island communication (e.g., hovering citations).
    *   Use Feature Flags (`vm.islands.chatEnabled`) for safe, percentage-based rollouts.

## 4. Agent Workflow

The AI Agent operates in three distinct modes to ensure quality:

### Mode A: Designer (Architect)
*   **Focus:** Information Architecture & System Design.
*   **Outputs:** EJS layout structure, Tailwind tokens, Page maps, Component interfaces (Props & Anchors).

### Mode B: Developer (Implementer)
*   **Focus:** Code Generation & Integration.
*   **Outputs:** Preact islands (`.tsx`), Zod contracts (`.contract.ts`), EJS templates with `data-island` anchors.

### Mode C: Auditor (Verifier)
*   **Focus:** Quality Assurance & Staleness Prevention.
*   **Actions:**
    *   **Contract Check:** Verifies `Template <-> Contract` alignment.
    *   **Inventory Crawl:** Runs Playwright to extract the runtime UI map.
    *   **Diff Analysis:** Compares current inventory against the baseline.