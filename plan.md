# Complexte Product + Implementation Plan

## Goal

Turn the current bare-bones Electron note app into a local-first, agent-managed writing workspace:

- The primary creation flow is "prompt the LLM, get a document".
- Documents are automatically organized by semantic similarity and agent-assigned relationships.
- Users can still create and edit documents manually.
- The editor should feel closer to Notion than a thin markdown demo.
- Highlighting text should open an inline AI prompt that can expand, rewrite, or transform the selected passage in place.
- New prompts should retrieve the most relevant existing documents before generation.

## What Exists Today

The current app already has useful scaffolding:

- Electron + React renderer architecture.
- Zustand document store.
- Plate editor with basic formatting, slash commands, and selection bubble UI.
- Prompt-first draft generation via OpenRouter.
- Workspace/page concepts and a sidebar tree.

The main limitation is that most of the "intelligence" is still mocked or heuristic:

- No persistent database for pages, embeddings, or relationships.
- Page placement is driven by `inferIndexedPath(...)` keyword heuristics in [`src/renderer/src/store/useDocumentStore.ts`](/Users/brianliu/Documents/personal/coding/complexte/src/renderer/src/store/useDocumentStore.ts:163), not by an agent or retrieval system.
- Document content is kept in memory, with only settings stored in `localStorage`.
- The selection bubble in [`src/renderer/src/components/Editor.tsx`](/Users/brianliu/Documents/personal/coding/complexte/src/renderer/src/components/Editor.tsx:295) only formats text; it does not invoke AI on a selected range.
- The editor UX is functional, but still feels like "markdown tooling" rather than a polished writing surface.

## Product Direction

### Core interaction model

1. User opens the app.
2. Primary CTA is a prompt composer.
3. User asks for a document.
4. App retrieves the most relevant existing documents.
5. LLM creates the draft with that retrieved context.
6. Agent assigns the new document to one or more semantic collections / relationships.
7. User edits manually in a strong writing interface.
8. User can highlight any span and ask the LLM to expand or revise only that section.

### Secondary interaction model

- Users can still create a blank document manually.
- That entry point should exist, but visually remain secondary to prompting.

## Product Decisions

### 1. Persistence should be local-first

Because this is an Electron desktop app, the fastest credible architecture is:

- SQLite for document metadata, content snapshots, relationships, prompts, and activity.
- A local vector index for semantic retrieval.
- Filesystem export/import later, not as the primary storage model.

Recommended implementation:

- Use SQLite as the source of truth.
- Store embeddings locally per document and per chunk.
- Prefer a local vector extension or embedded vector index over a hosted vector DB for MVP.

Reasoning:

- This app feels personal and knowledge-base-like.
- Local-first reduces setup friction.
- It matches the "agent-managed workspace" idea better than a remote backend requirement.

## Recommended Information Model

### Entities

- `workspace`
- `document`
- `document_revision`
- `document_chunk`
- `document_link`
- `document_collection`
- `document_collection_membership`
- `prompt_session`
- `selection_ai_action`

### Document shape

Each document should carry:

- Stable `id`
- `workspace_id`
- `title`
- `content` as Plate JSON
- `plain_text`
- `summary`
- `status` (`draft`, `active`, `archived`)
- `source_type` (`prompt`, `manual`, `selection_transform`)
- `created_at`, `updated_at`
- `last_prompt`
- `embedding_status`

### Relationship model

Do not treat organization as only a folder tree.

Use three parallel structures:

- `collections`: user-facing grouped areas that replace the current heuristic folder placement.
- `links`: explicit doc-to-doc relations such as `supports`, `extends`, `related_to`, `derived_from`.
- `similarity edges`: system-generated, scored semantic neighbors.

This allows a sidebar that feels organized without pretending knowledge always belongs in one folder.

## Sidebar Recommendation

Do not make the raw agent placement tree the only navigation model.

Recommended sidebar layout:

- Top: primary actions (`New with AI`, `Blank doc`)
- Next: workspace switcher
- Next: curated sections:
  - `Inbox`
  - `Recent`
  - `Collections`
  - `Starred`
  - `Suggested links`
- Optional collapsible `Agent View` showing where the system thinks documents belong

Reasoning:

- Users need predictability.
- A pure agent-managed tree will feel unstable if documents move too often.
- The agent can propose structure without making the UI feel uncontrollable.

## Editor Direction

The editor should evolve from "markdown editor with controls" into "clean writing surface with AI affordances".

### Required improvements

- Reduce chrome and make the page feel more like a document canvas.
- Improve typography, spacing, and block rhythm.
- Replace clunky toolbar behavior with a tighter block/selection command model.
- Keep slash commands, but make them faster and more intentional.
- Improve selection bubble positioning and behavior.
- Add inline AI actions directly in the selection bubble.

### Inline AI on selection

When text is highlighted, the default interaction should be a compact input anchored to the selection, not a row of preset rewrite buttons.

The user should be able to type any instruction they want, for example:

- "expand this with more detail"
- "make this clearer"
- "rewrite this in a more technical tone"
- "turn this into a short summary"

Preset suggestions can exist as lightweight placeholders or examples, but the primary UX should always be a freeform ask box.

The model receives:

- selected text
- surrounding document context
- user instruction
- relevant retrieved documents when useful

The user should be able to:

- replace selection
- insert below
- append as comment/suggestion
- cancel without side effects

## Retrieval and Generation Flow

### When creating a new document from a prompt

Pipeline:

1. Embed the user prompt.
2. Retrieve top related documents/chunks in the current workspace.
3. Build a generation context from those results.
4. Generate the draft.
5. Generate title + summary.
6. Persist the document.
7. Compute document/chunk embeddings.
8. Ask the organizer agent to assign collections and links.

### When editing a selected passage with AI

Pipeline:

1. Capture selected range and nearby block context.
2. Retrieve relevant workspace documents if needed.
3. Send selection + instruction + context to model.
4. Return a structured transform result.
5. Let user choose apply mode.

## Agent Responsibilities

Split the "agent" concept into bounded jobs instead of one magical system:

### Drafting agent

- Creates first-pass documents from prompts.
- Uses retrieved context.

### Organizer agent

- Assigns collections.
- Proposes related docs.
- Creates typed relationships.
- Re-evaluates placement after meaningful edits.

### Inline editing agent

- Operates on a selected range.
- Must preserve local intent and document voice.

## Implementation Phases

## Phase 1: Real data foundation

Ship first:

- Replace in-memory page/content storage with SQLite-backed persistence.
- Persist workspaces, documents, editor content, timestamps, and AI metadata.
- Add a document repository layer instead of keeping all logic inside the Zustand store.
- Keep Zustand as UI state, not the database.

Deliverable:

- Restarting the app preserves documents and workspace state reliably.

## Phase 2: Prompt-first document creation

- Keep the current `DocumentStarter` concept.
- Make AI creation the obvious primary home-screen action.
- Keep `Start with a blank document` as a secondary action.
- Add prompt history and retry/regenerate support.
- Save prompt sessions alongside generated docs.

Deliverable:

- The app feels centered on prompting, not on creating empty notes.

## Phase 3: Retrieval and embeddings

- Add embedding generation for prompts and documents.
- Chunk documents for semantic retrieval.
- Store chunk text + embedding references.
- Retrieve top-k similar chunks before generation.
- Show lightweight "used context" provenance in the UI.

Deliverable:

- New drafts are context-aware and grounded in existing workspace knowledge.

## Phase 4: Agent-managed organization

- Replace `inferIndexedPath(...)` heuristics with an organizer service.
- Introduce collections and semantic relationships.
- Keep an `Inbox` fallback for low-confidence placement.
- Recompute placement on document creation and major edits.
- Surface "related documents" inside the document view.

Deliverable:

- Document organization is semantic, explainable, and not just keyword routing.

## Phase 5: Editor redesign

- Refine Plate configuration for a cleaner Notion-like authoring experience.
- Improve block spacing, heading rhythm, lists, quotes, and code blocks.
- Rework the selection bubble and slash menu interaction model.
- Support better placeholder states and empty-page affordances.
- Audit keyboard shortcuts and command discoverability.

Deliverable:

- The editor is pleasant enough for sustained writing.

## Phase 6: Inline AI editing

- Add selection-aware AI actions to the bubble menu.
- Build the anchored inline prompt input.
- Support replace/insert/cancel flows.
- Track AI transforms in revision history.

Deliverable:

- Users can expand or revise a selected passage without leaving the document.

## Phase 7: Relationship views and navigation polish

- Add document backlinks / related docs.
- Add a graph or graph-lite relationship view.
- Improve sidebar information architecture.
- Add search across titles, content, and semantic similarity.

Deliverable:

- Navigation feels intelligent instead of tree-bound.

## Phase 8: Stability and trust

- Add autosave confidence indicators.
- Add revision history / undo across AI actions.
- Add error states for failed generation or embedding jobs.
- Add diagnostics for agent placement confidence.

Deliverable:

- The app feels reliable enough for real use.

## Suggested Technical Refactor

### Current issue

Too much domain logic lives in the renderer store.

### Target structure

- `main`: persistence, embeddings, model orchestration, background jobs
- `preload`: narrow typed bridge APIs
- `renderer/store`: UI/session state only
- `renderer/features/documents`: document screens and actions
- `renderer/features/editor`: editor UI and inline AI tools
- `shared`: request/response types and domain contracts

This keeps LLM orchestration and database concerns out of the view layer.

## MVP Acceptance Criteria

The product is meaningfully "there" when:

- A user can create a document primarily by prompting the model.
- The app retrieves relevant existing documents before generation.
- Generated docs persist across restarts.
- The agent assigns the doc to sensible collections with related-doc links.
- The editor feels polished enough for direct manual writing.
- Highlighting text opens an inline AI prompt flow that can transform the selection in place.
- Users can still create a blank doc manually.

## Open Questions

### 1. Should the sidebar expose raw file placement?

Recommendation:

- Not by default.
- Show stable user-facing collections first.
- Hide raw agent structure behind an optional advanced view.

### 2. Should there be literal files/folders on disk?

Recommendation:

- No for MVP.
- Use a database-first model and add export later.

### 3. Should the organizer move documents automatically?

Recommendation:

- Yes, but conservatively.
- Use confidence thresholds.
- Prefer suggestions or soft moves over surprising hard relocations.

## Immediate Next Build Order

1. Add SQLite persistence and move document storage out of the current store.
2. Introduce a document service boundary and IPC APIs.
3. Add embeddings + retrieval for prompt-based generation.
4. Replace heuristic `indexedPath` inference with collections + related-doc assignment.
5. Redesign editor UX and selection bubble.
6. Add inline AI selection transforms.

## Summary

The correct next version of Complexte is not "more markdown features". It is a local-first AI writing workspace where prompting creates documents, retrieval grounds them in prior knowledge, an organizer agent maintains semantic structure, and the editor supports both manual writing and precise inline AI collaboration.
