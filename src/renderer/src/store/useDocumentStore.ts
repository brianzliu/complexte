import { create } from 'zustand'

export interface DocumentMeta {
  id: string
  name: string
  modified: string
}

const MOCK_CONTENT: Record<string, string> = {
  'getting-started': `# Getting Started

Welcome to **Complexte** — a sophisticated document workspace designed for focused writing.

## Features

- Live markdown preview with split-pane editing
- Fast document search and navigation
- Clean, distraction-free interface
- Automatic saving as you type

## Writing in Markdown

Complexte uses standard Markdown syntax. Here are some examples:

\`\`\`
# Heading 1
## Heading 2

**Bold text**, *italic text*, \`inline code\`

- Unordered list item
- Another item

1. Ordered list
2. Second item

> Blockquote for emphasis

[Link text](https://example.com)
\`\`\`

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New document | ⌘N |
| Save | ⌘S |
| Toggle sidebar | ⌘\\ |

---

> "Simplicity is the ultimate sophistication." — Leonardo da Vinci
`,

  'project-roadmap': `# Project Roadmap

## Q2 2026

### In Progress
- [ ] Implement full-text search across all documents
- [ ] Add folder/tag organization system
- [x] Split-pane markdown editor with live preview
- [x] Document creation, renaming, and deletion

### Upcoming
- [ ] Sync across devices via end-to-end encrypted vault
- [ ] Plugin system for custom extensions
- [ ] Export to PDF, HTML, and EPUB
- [ ] Command palette (⌘K)

## Q3 2026

- [ ] Mobile companion app
- [ ] Collaborative real-time editing
- [ ] Version history and document diffs
- [ ] AI-powered writing assistant

---

## Notes

The core principle of Complexte is **clarity through constraint**. Every feature must serve the writing experience.
`,

  'meeting-notes': `# Meeting Notes

## Design Review — April 11, 2026

**Attendees:** Brian, Sarah, Marcus

### Agenda

1. Review new interface mockups
2. Discuss typography choices
3. Align on color system
4. Next steps

### Discussion

**Typography:** We agreed to use Geist for UI elements and Geist Mono for the editor. The pairing creates clear visual hierarchy between the shell and the writing surface.

**Color system:** Dark-first approach inspired by OpenAI's aesthetic. Primary background at \`#0d0d0d\`, surfaces at \`#111\` and \`#171717\`. Accent color \`#19c37d\` for interactive states.

**Layout:** Three-panel layout (sidebar | editor | preview) with the ability to collapse to single-pane when focused writing is needed.

### Action Items

- [ ] Brian: Finalize icon set (@2026-04-15)
- [ ] Sarah: Write accessibility guidelines
- [ ] Marcus: Prototype the command palette

---

Next meeting: **April 18, 2026 at 10:00 AM**
`,

  'design-philosophy': `# Design Philosophy

## Principles

### 1. Content First

The interface should disappear when you write. Every pixel of chrome is a pixel stolen from your words. We obsess over negative space.

### 2. Progressive Disclosure

Simple things should be simple. Complex things should be possible. The default view is a blank canvas; power features reveal themselves as needed.

### 3. Honest Materials

No skeuomorphic tricks. No unnecessary gradients. The aesthetic should feel **inevitable** — as if no other design was possible.

### 4. Speed as a Feature

Every interaction should feel instant. Loading states are a failure mode, not a UX pattern. Cache aggressively. Optimize relentlessly.

---

## Aesthetic References

- **OpenAI** — Restrained dark palette, confident typography
- **Linear** — Keyboard-first, dense information design
- **Obsidian** — Personal knowledge, graph of ideas
- **iA Writer** — Focus mode, typographic purity

---

*These are living principles. They will evolve as Complexte evolves.*
`,

  'scratch': `# Scratch Pad

Use this document for quick notes and temporary ideas.

---

`,
}

const INITIAL_DOCUMENTS: DocumentMeta[] = [
  { id: 'getting-started', name: 'Getting Started', modified: new Date(2026, 3, 11, 9, 0).toISOString() },
  { id: 'project-roadmap', name: 'Project Roadmap', modified: new Date(2026, 3, 10, 14, 30).toISOString() },
  { id: 'meeting-notes', name: 'Meeting Notes', modified: new Date(2026, 3, 11, 10, 15).toISOString() },
  { id: 'design-philosophy', name: 'Design Philosophy', modified: new Date(2026, 3, 8, 16, 0).toISOString() },
  { id: 'scratch', name: 'Scratch Pad', modified: new Date(2026, 3, 11, 8, 45).toISOString() },
]

let contentStore: Record<string, string> = { ...MOCK_CONTENT }

let docCounter = INITIAL_DOCUMENTS.length

function generateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + (++docCounter)
}

interface DocumentStore {
  documents: DocumentMeta[]
  activeId: string | null
  content: string
  isSidebarCollapsed: boolean

  openDocument: (id: string) => void
  setContent: (content: string) => void
  saveDocument: () => void
  createDocument: (name: string) => DocumentMeta
  deleteDocument: (id: string) => void
  renameDocument: (id: string, newName: string) => void
  toggleSidebar: () => void
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: INITIAL_DOCUMENTS,
  activeId: null,
  content: '',
  isSidebarCollapsed: false,

  openDocument: (id: string) => {
    const content = contentStore[id] ?? ''
    set({ activeId: id, content })
  },

  setContent: (content: string) => {
    set({ content })
    const { activeId } = get()
    if (activeId) {
      contentStore[activeId] = content
    }
  },

  saveDocument: () => {
    const { activeId, content, documents } = get()
    if (!activeId) return
    contentStore[activeId] = content
    set({
      documents: documents.map(d =>
        d.id === activeId ? { ...d, modified: new Date().toISOString() } : d,
      ),
    })
  },

  createDocument: (name: string) => {
    const id = generateId(name)
    const doc: DocumentMeta = {
      id,
      name,
      modified: new Date().toISOString(),
    }
    contentStore[id] = `# ${name}\n\n`
    set(state => ({
      documents: [doc, ...state.documents],
    }))
    return doc
  },

  deleteDocument: (id: string) => {
    delete contentStore[id]
    set(state => ({
      documents: state.documents.filter(d => d.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
      content: state.activeId === id ? '' : state.content,
    }))
  },

  renameDocument: (id: string, newName: string) => {
    set(state => ({
      documents: state.documents.map(d => d.id === id ? { ...d, name: newName } : d),
    }))
  },

  toggleSidebar: () => {
    set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }))
  },
}))
