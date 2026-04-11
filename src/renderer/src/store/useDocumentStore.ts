import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'auto'

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem('complexte-theme')
    if (v === 'dark' || v === 'light' || v === 'auto') return v as Theme
  } catch {}
  return 'dark'
}

export interface Workspace {
  id: string
  name: string
  modified: string
}

export interface PageMeta {
  id: string
  workspaceId: string
  name: string
  indexedPath: string[]
  modified: string
  order: number
}

const MOCK_CONTENT: Record<string, string> = {
  'getting-started': `# Getting Started

Welcome to **Complexte** — a focused workspace for linked notes and writing.

## What changed

- Workspaces keep separate sets of pages
- Pages are indexed into workspace-local paths
- The sidebar reflects the index instead of manual folders

## Writing in Markdown

\`\`\`
# Heading 1
## Heading 2

**Bold text**, *italic text*, \`inline code\`

- Unordered list item
- Another item

> Blockquote for emphasis
\`\`\`
`,

  'project-roadmap': `# Project Roadmap

## Q2 2026

### In Progress
- [ ] Add persistent workspace storage
- [x] Split-pane markdown editor with live preview
- [x] Workspace and indexed page navigation

### Upcoming
- [ ] Drag-and-drop page reordering
- [ ] Command palette
- [ ] Backlinks
`,

  'meeting-notes': `# Meeting Notes

## Design Review — April 11, 2026

### Discussion

The navigation should feel closer to Obsidian and Notion: workspaces at the top, pages in a nested tree, and child pages attached directly to their parent.
`,

  'design-philosophy': `# Design Philosophy

## Principles

### 1. Content First

The interface should disappear when you write. Every pixel of chrome is a pixel stolen from your words.

### 2. Progressive Disclosure

Simple things should be simple. Complex things should be possible.
`,

  'scratch': `# Scratch Pad

Use this page for quick notes and temporary ideas.
`,

  'research': `# Research

Collect source notes, ideas, and open questions here.
`,

  'drafts': `# Drafts

Loose drafts and outlines.
`,
}

const INITIAL_WORKSPACES: Workspace[] = [
  { id: 'personal', name: 'Personal', modified: new Date(2026, 3, 11, 9, 0).toISOString() },
  { id: 'client-work', name: 'Client Work', modified: new Date(2026, 3, 10, 14, 30).toISOString() },
]

const INITIAL_PAGES: PageMeta[] = [
  { id: 'getting-started', workspaceId: 'personal', name: 'Getting Started', indexedPath: ['Inbox'], modified: new Date(2026, 3, 11, 9, 0).toISOString(), order: 0 },
  { id: 'project-roadmap', workspaceId: 'personal', name: 'Project Roadmap', indexedPath: ['Projects', 'Roadmap'], modified: new Date(2026, 3, 10, 14, 30).toISOString(), order: 1 },
  { id: 'meeting-notes', workspaceId: 'personal', name: 'Meeting Notes', indexedPath: ['Work', 'Meetings'], modified: new Date(2026, 3, 11, 10, 15).toISOString(), order: 2 },
  { id: 'design-philosophy', workspaceId: 'personal', name: 'Design Philosophy', indexedPath: ['Projects', 'Design'], modified: new Date(2026, 3, 8, 16, 0).toISOString(), order: 3 },
  { id: 'scratch', workspaceId: 'personal', name: 'Scratch Pad', indexedPath: ['Inbox'], modified: new Date(2026, 3, 11, 8, 45).toISOString(), order: 4 },
  { id: 'research', workspaceId: 'client-work', name: 'Research', indexedPath: ['Research'], modified: new Date(2026, 3, 9, 11, 30).toISOString(), order: 0 },
  { id: 'drafts', workspaceId: 'client-work', name: 'Drafts', indexedPath: ['Writing', 'Drafts'], modified: new Date(2026, 3, 9, 12, 15).toISOString(), order: 1 },
]

let contentStore: Record<string, string> = { ...MOCK_CONTENT }
let pageCounter = INITIAL_PAGES.length
let workspaceCounter = INITIAL_WORKSPACES.length

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled'
}

function generatePageId(name: string): string {
  return `${slugify(name)}-${++pageCounter}`
}

function generateWorkspaceId(name: string): string {
  return `${slugify(name)}-${++workspaceCounter}`
}

function inferIndexedPath(name: string, content: string, workspacePages: PageMeta[]): string[] {
  const text = `${name}\n${content}`.toLowerCase()
  const existingTopLevel = new Set(workspacePages.map(page => page.indexedPath[0]).filter(Boolean))

  if (/\b(homework|assignment|problem set|calculus|integral|math|algebra|geometry|class|course)\b/.test(text)) {
    if (/\b(calculus|integral|derivative|algebra|geometry|math)\b/.test(text)) {
      return /\b(homework|assignment|problem set)\b/.test(text)
        ? ['Classes', 'Math', 'Homework']
        : ['Classes', 'Math', 'Notes']
    }
    return ['Classes', 'Notes']
  }

  if (/\b(meeting|agenda|attendees|action items?|standup|review)\b/.test(text)) {
    return ['Work', 'Meetings']
  }

  if (/\b(roadmap|milestone|q[1-4]|project|upcoming|in progress)\b/.test(text)) {
    return ['Projects', 'Roadmap']
  }

  if (/\b(design|interface|typography|layout|principles?|aesthetic)\b/.test(text)) {
    return ['Projects', 'Design']
  }

  if (/\b(research|source|study|paper|question|hypothesis)\b/.test(text)) {
    return ['Research']
  }

  if (/\b(draft|outline|essay|article|post)\b/.test(text)) {
    return ['Writing', 'Drafts']
  }

  return existingTopLevel.has('Inbox') ? ['Inbox'] : ['Unsorted']
}

interface DocumentStore {
  workspaces: Workspace[]
  activeWorkspaceId: string
  pages: PageMeta[]
  activeId: string | null
  openTabIds: string[]
  content: string
  isSidebarCollapsed: boolean
  theme: Theme

  openPage: (id: string) => void
  closeTab: (id: string) => string | null
  setContent: (content: string) => void
  saveDocument: () => void
  createWorkspace: (name: string) => Workspace
  setActiveWorkspace: (id: string) => void
  createPage: (name: string) => PageMeta
  deletePage: (id: string) => void
  renamePage: (id: string, newName: string) => void
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
  getPageContent: (id: string) => string
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  workspaces: INITIAL_WORKSPACES,
  activeWorkspaceId: INITIAL_WORKSPACES[0].id,
  pages: INITIAL_PAGES,
  activeId: null,
  openTabIds: [],
  content: '',
  isSidebarCollapsed: false,
  theme: loadTheme(),

  openPage: (id: string) => {
    const page = get().pages.find(item => item.id === id)
    if (!page) return
    set({
      activeId: id,
      activeWorkspaceId: page.workspaceId,
      openTabIds: get().openTabIds.includes(id) ? get().openTabIds : [...get().openTabIds, id],
      content: contentStore[id] ?? '',
    })
  },

  closeTab: (id: string) => {
    const { activeId, activeWorkspaceId, content, openTabIds, pages } = get()
    const tabIndex = openTabIds.indexOf(id)
    if (tabIndex === -1) return activeId

    const nextOpenTabIds = openTabIds.filter(tabId => tabId !== id)
    const isClosingActiveTab = activeId === id
    const nextActiveId = isClosingActiveTab
      ? nextOpenTabIds[Math.min(tabIndex, nextOpenTabIds.length - 1)] ?? null
      : activeId
    const nextPage = nextActiveId ? pages.find(page => page.id === nextActiveId) : null

    set({
      activeId: nextActiveId,
      activeWorkspaceId: isClosingActiveTab && nextPage ? nextPage.workspaceId : activeWorkspaceId,
      openTabIds: nextOpenTabIds,
      content: isClosingActiveTab ? (nextActiveId ? contentStore[nextActiveId] ?? '' : '') : content,
    })

    return nextActiveId
  },

  setContent: (content: string) => {
    set({ content })
    const { activeId } = get()
    if (activeId) {
      contentStore[activeId] = content
    }
  },

  saveDocument: () => {
    const { activeId, content, pages, workspaces } = get()
    if (!activeId) return

    const page = pages.find(item => item.id === activeId)
    if (!page) return

    const modified = new Date().toISOString()
    const workspacePages = pages.filter(item => item.workspaceId === page.workspaceId)
    const indexedPath = inferIndexedPath(page.name, content, workspacePages)
    contentStore[activeId] = content
    set({
      pages: pages.map(item => item.id === activeId ? { ...item, indexedPath, modified } : item),
      workspaces: workspaces.map(workspace =>
        workspace.id === page.workspaceId ? { ...workspace, modified } : workspace,
      ),
    })
  },

  createWorkspace: (name: string) => {
    const workspace: Workspace = {
      id: generateWorkspaceId(name),
      name,
      modified: new Date().toISOString(),
    }
    set(state => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspaceId: workspace.id,
      activeId: null,
      content: '',
    }))
    return workspace
  },

  setActiveWorkspace: (id: string) => {
    const workspace = get().workspaces.find(item => item.id === id)
    if (!workspace) return
    set({ activeWorkspaceId: id, activeId: null, content: '' })
  },

  createPage: (name: string) => {
    const { activeWorkspaceId, pages } = get()
    const siblingCount = pages.filter(item => item.workspaceId === activeWorkspaceId).length
    const id = generatePageId(name)
    const page: PageMeta = {
      id,
      workspaceId: activeWorkspaceId,
      name,
      indexedPath: ['Inbox'],
      modified: new Date().toISOString(),
      order: siblingCount,
    }
    contentStore[id] = `# ${name}\n\n`
    set(state => ({
      pages: [...state.pages, page],
      openTabIds: [...state.openTabIds, id],
    }))
    return page
  },

  deletePage: (id: string) => {
    const { activeId } = get()
    delete contentStore[id]
    set(state => ({
      pages: state.pages.filter(page => page.id !== id),
      openTabIds: state.openTabIds.filter(tabId => tabId !== id),
      activeId: activeId === id ? null : activeId,
      content: activeId === id ? '' : state.content,
    }))
  },

  renamePage: (id: string, newName: string) => {
    const modified = new Date().toISOString()
    const { pages } = get()
    const page = pages.find(item => item.id === id)
    const workspacePages = page ? pages.filter(item => item.workspaceId === page.workspaceId) : []
    const indexedPath = page ? inferIndexedPath(newName, contentStore[id] ?? '', workspacePages) : ['Inbox']
    set(state => ({
      pages: state.pages.map(page => page.id === id ? { ...page, name: newName, indexedPath, modified } : page),
    }))
  },

  toggleSidebar: () => {
    set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }))
  },

  setTheme: (theme: Theme) => {
    try { localStorage.setItem('complexte-theme', theme) } catch {}
    set({ theme })
  },

  getPageContent: (id: string) => contentStore[id] ?? '',
}))
