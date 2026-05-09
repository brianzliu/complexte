import { create } from 'zustand'
import {
  clonePlateDocument,
  emptyPlateDocument,
  markdownToPlateDocument,
  plateDocumentToMarkdown,
  plateDocumentToPlainText,
  type PlateDocumentValue,
} from '../lib/plateDocument'
import { loadPersistedSnapshot, savePersistedSnapshot } from '../lib/documentPersistence'
import { organizeDocument } from '../lib/documentIntelligence'
import type { DocumentRevision, PageMeta, PersistedDocumentContent, PersistedDocumentSnapshot, PromptSession, SelectionAiAction, Workspace } from '../../../shared/documentSnapshot'

export type Theme = 'dark' | 'light' | 'auto'
export type { DocumentRevision, PageMeta, PromptSession, SelectionAiAction, Workspace } from '../../../shared/documentSnapshot'

export interface AiSettings {
  openRouterApiKey: string
  openRouterModel: string
}

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem('complexte-theme')
    if (v === 'dark' || v === 'light' || v === 'auto') return v as Theme
  } catch {}
  return 'dark'
}

function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem('complexte-ai-settings')
    if (raw) {
      const settings = JSON.parse(raw) as Partial<AiSettings>
      return {
        openRouterApiKey: settings.openRouterApiKey ?? '',
        openRouterModel: settings.openRouterModel ?? 'openai/gpt-5.2',
      }
    }
  } catch {}

  return {
    openRouterApiKey: '',
    openRouterModel: 'openai/gpt-5.2',
  }
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
  { id: 'getting-started', workspaceId: 'personal', name: 'Getting Started', indexedPath: ['Inbox'], collections: ['Inbox', 'Projects'], relatedIds: ['scratch'], modified: new Date(2026, 3, 11, 9, 0).toISOString(), order: 0, isInitialized: true },
  { id: 'project-roadmap', workspaceId: 'personal', name: 'Project Roadmap', indexedPath: ['Projects', 'Roadmap'], collections: ['Projects', 'Design'], relatedIds: ['design-philosophy'], modified: new Date(2026, 3, 10, 14, 30).toISOString(), order: 1, isInitialized: true },
  { id: 'meeting-notes', workspaceId: 'personal', name: 'Meeting Notes', indexedPath: ['Work', 'Meetings'], collections: ['Work', 'Projects'], relatedIds: ['project-roadmap'], modified: new Date(2026, 3, 11, 10, 15).toISOString(), order: 2, isInitialized: true },
  { id: 'design-philosophy', workspaceId: 'personal', name: 'Design Philosophy', indexedPath: ['Projects', 'Design'], collections: ['Projects', 'Design'], relatedIds: ['project-roadmap'], modified: new Date(2026, 3, 8, 16, 0).toISOString(), order: 3, isInitialized: true },
  { id: 'scratch', workspaceId: 'personal', name: 'Scratch Pad', indexedPath: ['Inbox'], collections: ['Inbox'], relatedIds: ['getting-started'], modified: new Date(2026, 3, 11, 8, 45).toISOString(), order: 4, isInitialized: true },
  { id: 'research', workspaceId: 'client-work', name: 'Research', indexedPath: ['Research'], collections: ['Research'], relatedIds: ['drafts'], modified: new Date(2026, 3, 9, 11, 30).toISOString(), order: 0, isInitialized: true },
  { id: 'drafts', workspaceId: 'client-work', name: 'Drafts', indexedPath: ['Writing', 'Drafts'], collections: ['Writing', 'Research'], relatedIds: ['research'], modified: new Date(2026, 3, 9, 12, 15).toISOString(), order: 1, isInitialized: true },
]

let contentStore: Record<string, PlateDocumentValue> = Object.fromEntries(
  Object.entries(MOCK_CONTENT).map(([id, markdown]) => [id, markdownToPlateDocument(markdown)]),
)
let pageCounter = INITIAL_PAGES.length
let workspaceCounter = INITIAL_WORKSPACES.length
let promptSessionCounter = 0
let selectionAiActionCounter = 0
let documentRevisionCounter = 0
let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistRequestId = 0

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled'
}

function generatePageId(name: string): string {
  return `${slugify(name)}-${++pageCounter}`
}

function generateWorkspaceId(name: string): string {
  return `${slugify(name)}-${++workspaceCounter}`
}

function generatePromptSessionId(): string {
  return `prompt-session-${++promptSessionCounter}`
}

function generateSelectionAiActionId(): string {
  return `selection-ai-action-${++selectionAiActionCounter}`
}

function generateDocumentRevisionId(): string {
  return `document-revision-${++documentRevisionCounter}`
}

function createRevisionPreview(content: PlateDocumentValue): string {
  return plateDocumentToPlainText(content)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function getWorkspaceDocuments(pages: PageMeta[], workspaceId: string, excludeId?: string) {
  return pages
    .filter(page => page.workspaceId === workspaceId && page.id !== excludeId)
    .map(page => ({
      id: page.id,
      name: page.name,
      indexedPath: page.indexedPath,
      content: plateDocumentToPlainText(contentStore[page.id] ?? emptyPlateDocument()),
    }))
}

interface DocumentStore {
  workspaces: Workspace[]
  activeWorkspaceId: string
  pages: PageMeta[]
  activeId: string | null
  openTabIds: string[]
  promptSessions: PromptSession[]
  selectionAiActions: SelectionAiAction[]
  documentRevisions: DocumentRevision[]
  content: PlateDocumentValue
  contentVersion: number
  isSidebarCollapsed: boolean
  isHydrated: boolean
  theme: Theme
  aiSettings: AiSettings

  hydrateFromPersistence: () => Promise<void>
  openPage: (id: string) => void
  closeTab: (id: string) => string | null
  setContent: (content: PlateDocumentValue) => void
  setPageContent: (id: string, content: string, options?: { initialize?: boolean; name?: string }) => void
  initializePage: (id: string) => void
  saveDocument: () => void
  createWorkspace: (name: string) => Workspace
  setActiveWorkspace: (id: string) => void
  createPage: (name: string, indexedPath?: string[]) => PageMeta
  deletePage: (id: string) => void
  renamePage: (id: string, newName: string) => void
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
  setAiSettings: (settings: Partial<AiSettings>) => void
  addPromptSession: (session: Omit<PromptSession, 'id' | 'createdAt'>) => void
  addSelectionAiAction: (action: Omit<SelectionAiAction, 'id' | 'createdAt'>) => void
  addDocumentRevision: (revision: Omit<DocumentRevision, 'id' | 'createdAt' | 'preview'>) => void
  restoreDocumentRevision: (revisionId: string) => void
  getPageContent: (id: string) => string
}

function cloneWorkspaces(workspaces: Workspace[]): Workspace[] {
  return workspaces.map(workspace => ({ ...workspace }))
}

function clonePages(pages: PageMeta[]): PageMeta[] {
  return pages.map(page => ({
    ...page,
    indexedPath: [...page.indexedPath],
    collections: [...page.collections],
    relatedIds: [...page.relatedIds],
  }))
}

function cloneContentRecord(
  source: Record<string, PersistedDocumentContent | PlateDocumentValue>,
): Record<string, PlateDocumentValue> {
  return Object.fromEntries(
    Object.entries(source).map(([id, value]) => [id, clonePlateDocument(value as PlateDocumentValue)]),
  )
}

function serializeContentRecord(source: Record<string, PlateDocumentValue>): Record<string, PersistedDocumentContent> {
  return Object.fromEntries(
    Object.entries(source).map(([id, value]) => [id, clonePlateDocument(value) as PersistedDocumentContent]),
  )
}

function buildSnapshot(state: Pick<
  DocumentStore,
  'workspaces' | 'activeWorkspaceId' | 'pages' | 'activeId' | 'openTabIds' | 'promptSessions' | 'selectionAiActions' | 'documentRevisions'
>): PersistedDocumentSnapshot {
  return {
    version: 3,
    workspaces: cloneWorkspaces(state.workspaces),
    activeWorkspaceId: state.activeWorkspaceId,
    pages: clonePages(state.pages),
    activeId: state.activeId,
    openTabIds: [...state.openTabIds],
    promptSessions: state.promptSessions.map(session => ({ ...session, relatedDocumentIds: [...session.relatedDocumentIds] })),
    selectionAiActions: state.selectionAiActions.map(action => ({ ...action })),
    documentRevisions: state.documentRevisions.map(revision => ({
      ...revision,
      content: clonePlateDocument(revision.content as PlateDocumentValue) as PersistedDocumentContent,
    })),
    contentById: serializeContentRecord(contentStore),
    pageCounter,
    workspaceCounter,
  }
}

function applySnapshot(snapshot: PersistedDocumentSnapshot): Pick<
  DocumentStore,
  'workspaces' | 'activeWorkspaceId' | 'pages' | 'activeId' | 'openTabIds' | 'promptSessions' | 'selectionAiActions' | 'documentRevisions' | 'content' | 'contentVersion'
> {
  const normalizedPages = snapshot.pages.map(page => ({
    ...page,
    collections: page.collections ?? [],
    relatedIds: page.relatedIds ?? [],
  }))
  contentStore = cloneContentRecord(snapshot.contentById)
  pageCounter = snapshot.pageCounter
  workspaceCounter = snapshot.workspaceCounter

  const workspaces = cloneWorkspaces(snapshot.workspaces)
  const pages = clonePages(normalizedPages)
  const activeWorkspaceId = snapshot.activeWorkspaceId || workspaces[0]?.id || ''
  const activeId = snapshot.activeId && pages.some(page => page.id === snapshot.activeId)
    ? snapshot.activeId
    : null
  const openTabIds = snapshot.openTabIds.filter(id => pages.some(page => page.id === id))
  const promptSessions = (snapshot.promptSessions ?? []).map(session => ({
    ...session,
    relatedDocumentIds: session.relatedDocumentIds ?? [],
  }))
  const selectionAiActions = (snapshot.selectionAiActions ?? []).map(action => ({ ...action }))
  const documentRevisions = (snapshot.documentRevisions ?? []).map(revision => ({
    ...revision,
    content: clonePlateDocument(revision.content as PlateDocumentValue) as PersistedDocumentContent,
  }))
  promptSessionCounter = promptSessions.length
  selectionAiActionCounter = selectionAiActions.length
  documentRevisionCounter = documentRevisions.length

  return {
    workspaces,
    activeWorkspaceId,
    pages,
    activeId,
    openTabIds,
    promptSessions,
    selectionAiActions,
    documentRevisions,
    content: clonePlateDocument(activeId ? contentStore[activeId] ?? emptyPlateDocument() : emptyPlateDocument()),
    contentVersion: Date.now(),
  }
}

async function flushPersistedSnapshot(snapshot: PersistedDocumentSnapshot): Promise<void> {
  const requestId = ++persistRequestId
  await savePersistedSnapshot(snapshot)
  if (persistRequestId !== requestId) {
    await savePersistedSnapshot(buildSnapshot(useDocumentStore.getState()))
  }
}

function queuePersist(state: DocumentStore, immediate = false): void {
  if (!state.isHydrated) return

  const snapshot = buildSnapshot(state)
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }

  if (immediate) {
    void flushPersistedSnapshot(snapshot)
    return
  }

  persistTimer = setTimeout(() => {
    persistTimer = null
    void flushPersistedSnapshot(snapshot)
  }, 180)
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  workspaces: cloneWorkspaces(INITIAL_WORKSPACES),
  activeWorkspaceId: INITIAL_WORKSPACES[0].id,
  pages: clonePages(INITIAL_PAGES),
  activeId: null,
  openTabIds: [],
  promptSessions: [],
  selectionAiActions: [],
  documentRevisions: [],
  content: emptyPlateDocument(),
  contentVersion: 0,
  isSidebarCollapsed: false,
  isHydrated: false,
  theme: loadTheme(),
  aiSettings: loadAiSettings(),

  hydrateFromPersistence: async () => {
    try {
      const snapshot = await loadPersistedSnapshot()
      if (snapshot) {
        set(() => ({
          ...applySnapshot(snapshot),
          isHydrated: true,
        }))
        return
      }

      set({ isHydrated: true })
      queuePersist(useDocumentStore.getState(), true)
    } catch {
      set({ isHydrated: true })
    }
  },

  openPage: (id: string) => {
    const page = get().pages.find(item => item.id === id)
    if (!page) return
    set({
      activeId: id,
      activeWorkspaceId: page.workspaceId,
      openTabIds: get().openTabIds.includes(id) ? get().openTabIds : [...get().openTabIds, id],
      content: clonePlateDocument(contentStore[id] ?? emptyPlateDocument()),
      contentVersion: get().contentVersion + 1,
    })
    queuePersist(get())
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
      content: isClosingActiveTab
        ? clonePlateDocument(nextActiveId ? contentStore[nextActiveId] ?? emptyPlateDocument() : emptyPlateDocument())
        : content,
      contentVersion: isClosingActiveTab ? get().contentVersion + 1 : get().contentVersion,
    })
    queuePersist(get())

    return nextActiveId
  },

  setContent: (content: PlateDocumentValue) => {
    const value = clonePlateDocument(content)
    set({ content: value })
    const { activeId } = get()
    if (activeId) {
      contentStore[activeId] = clonePlateDocument(value)
    }
  },

  setPageContent: (id: string, content: string, options = {}) => {
    const { activeId, contentVersion, pages, workspaces } = get()
    const page = pages.find(item => item.id === id)
    if (!page) return

    const modified = new Date().toISOString()
    const organization = organizeDocument(
      {
        id,
        name: options.name ?? page.name,
        indexedPath: page.indexedPath,
        content,
      },
      getWorkspaceDocuments(pages, page.workspaceId, id),
    )
    const value = markdownToPlateDocument(content)
    contentStore[id] = value

    set({
      content: activeId === id ? clonePlateDocument(value) : get().content,
      contentVersion: activeId === id ? contentVersion + 1 : contentVersion,
      pages: pages.map(item => item.id === id
        ? {
            ...item,
            name: options.name ?? item.name,
            indexedPath: organization.indexedPath,
            collections: organization.collections,
            relatedIds: organization.relatedIds,
            modified,
            isInitialized: options.initialize ? true : item.isInitialized,
          }
        : item,
      ),
      workspaces: workspaces.map(workspace =>
        workspace.id === page.workspaceId ? { ...workspace, modified } : workspace,
      ),
    })
    queuePersist(get())
  },

  initializePage: (id: string) => {
    const modified = new Date().toISOString()
    set(state => ({
      pages: state.pages.map(page => page.id === id ? { ...page, isInitialized: true, modified } : page),
      workspaces: state.workspaces.map(workspace => {
        const page = state.pages.find(item => item.id === id)
        return page?.workspaceId === workspace.id ? { ...workspace, modified } : workspace
      }),
    }))
    queuePersist(get())
  },

  saveDocument: () => {
    const { activeId, content, pages, workspaces } = get()
    if (!activeId) return

    const page = pages.find(item => item.id === activeId)
    if (!page) return

    const modified = new Date().toISOString()
    const plainText = plateDocumentToPlainText(content)
    const organization = organizeDocument(
      {
        id: activeId,
        name: page.name,
        indexedPath: page.indexedPath,
        content: plainText,
      },
      getWorkspaceDocuments(pages, page.workspaceId, activeId),
    )
    contentStore[activeId] = clonePlateDocument(content)
    set({
      pages: pages.map(item => item.id === activeId
        ? {
            ...item,
            indexedPath: organization.indexedPath,
            collections: organization.collections,
            relatedIds: organization.relatedIds,
            modified,
            isInitialized: true,
          }
        : item),
      workspaces: workspaces.map(workspace =>
        workspace.id === page.workspaceId ? { ...workspace, modified } : workspace,
      ),
    })
    get().addDocumentRevision({
      workspaceId: page.workspaceId,
      pageId: page.id,
      title: page.name,
      source: 'save',
      content: clonePlateDocument(content) as PersistedDocumentContent,
    })
    queuePersist(get())
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
      content: emptyPlateDocument(),
      contentVersion: state.contentVersion + 1,
    }))
    queuePersist(get())
    return workspace
  },

  setActiveWorkspace: (id: string) => {
    const workspace = get().workspaces.find(item => item.id === id)
    if (!workspace) return
    set(state => ({
      activeWorkspaceId: id,
      activeId: null,
      content: emptyPlateDocument(),
      contentVersion: state.contentVersion + 1,
    }))
    queuePersist(get())
  },

  createPage: (name: string, indexedPath = ['Inbox']) => {
    const { activeWorkspaceId, pages } = get()
    const siblingCount = pages.filter(item => item.workspaceId === activeWorkspaceId).length
    const id = generatePageId(name)
    const page: PageMeta = {
      id,
      workspaceId: activeWorkspaceId,
      name,
      indexedPath,
      collections: indexedPath.slice(0, 1),
      relatedIds: [],
      modified: new Date().toISOString(),
      order: siblingCount,
      isInitialized: false,
    }
    contentStore[id] = emptyPlateDocument()
    set(state => ({
      pages: [...state.pages, page],
      openTabIds: [...state.openTabIds, id],
    }))
    queuePersist(get())
    return page
  },

  deletePage: (id: string) => {
    const { activeId } = get()
    delete contentStore[id]
    set(state => ({
      pages: state.pages.filter(page => page.id !== id),
      openTabIds: state.openTabIds.filter(tabId => tabId !== id),
      activeId: activeId === id ? null : activeId,
      content: activeId === id ? emptyPlateDocument() : state.content,
      contentVersion: activeId === id ? state.contentVersion + 1 : state.contentVersion,
    }))
    queuePersist(get())
  },

  renamePage: (id: string, newName: string) => {
    const modified = new Date().toISOString()
    const { pages } = get()
    const page = pages.find(item => item.id === id)
    const organization = page
      ? organizeDocument(
          {
            id,
            name: newName,
            indexedPath: page.indexedPath,
            content: plateDocumentToPlainText(contentStore[id] ?? emptyPlateDocument()),
          },
          getWorkspaceDocuments(pages, page.workspaceId, id),
        )
      : { indexedPath: ['Inbox'], collections: ['Inbox'], relatedIds: [] }
    set(state => ({
      pages: state.pages.map(page => page.id === id
        ? {
            ...page,
            name: newName,
            indexedPath: organization.indexedPath,
            collections: organization.collections,
            relatedIds: organization.relatedIds,
            modified,
          }
        : page),
    }))
    queuePersist(get())
  },

  toggleSidebar: () => {
    set(state => ({ isSidebarCollapsed: !state.isSidebarCollapsed }))
  },

  setTheme: (theme: Theme) => {
    try { localStorage.setItem('complexte-theme', theme) } catch {}
    set({ theme })
  },

  setAiSettings: (settings: Partial<AiSettings>) => {
    const nextSettings = { ...get().aiSettings, ...settings }
    try { localStorage.setItem('complexte-ai-settings', JSON.stringify(nextSettings)) } catch {}
    set({ aiSettings: nextSettings })
  },

  addPromptSession: session => {
    set(state => ({
      promptSessions: [
        {
          ...session,
          id: generatePromptSessionId(),
          createdAt: new Date().toISOString(),
          relatedDocumentIds: [...session.relatedDocumentIds],
        },
        ...state.promptSessions,
      ].slice(0, 40),
    }))
    queuePersist(get())
  },

  addSelectionAiAction: action => {
    set(state => ({
      selectionAiActions: [
        {
          ...action,
          id: generateSelectionAiActionId(),
          createdAt: new Date().toISOString(),
        },
        ...state.selectionAiActions,
      ].slice(0, 120),
    }))
    queuePersist(get())
  },

  addDocumentRevision: revision => {
    set(state => ({
      documentRevisions: [
        {
          ...revision,
          id: generateDocumentRevisionId(),
          createdAt: new Date().toISOString(),
          preview: createRevisionPreview(revision.content as PlateDocumentValue),
          content: clonePlateDocument(revision.content as PlateDocumentValue) as PersistedDocumentContent,
        },
        ...state.documentRevisions.filter(item => !(item.pageId === revision.pageId && item.source === revision.source && item.preview === createRevisionPreview(revision.content as PlateDocumentValue))),
      ].slice(0, 200),
    }))
    queuePersist(get())
  },

  restoreDocumentRevision: revisionId => {
    const { activeId, contentVersion, documentRevisions, pages, workspaces } = get()
    const revision = documentRevisions.find(item => item.id === revisionId)
    if (!revision) return

    const page = pages.find(item => item.id === revision.pageId)
    if (!page) return

    const nextContent = clonePlateDocument(revision.content as PlateDocumentValue)
    const plainText = plateDocumentToPlainText(nextContent)
    const modified = new Date().toISOString()
    const organization = organizeDocument(
      {
        id: page.id,
        name: page.name,
        indexedPath: page.indexedPath,
        content: plainText,
      },
      getWorkspaceDocuments(pages, page.workspaceId, page.id),
    )

    contentStore[page.id] = clonePlateDocument(nextContent)
    set({
      content: activeId === page.id ? clonePlateDocument(nextContent) : get().content,
      contentVersion: activeId === page.id ? contentVersion + 1 : contentVersion,
      pages: pages.map(item => item.id === page.id
        ? {
            ...item,
            indexedPath: organization.indexedPath,
            collections: organization.collections,
            relatedIds: organization.relatedIds,
            modified,
            isInitialized: true,
          }
        : item),
      workspaces: workspaces.map(workspace =>
        workspace.id === page.workspaceId ? { ...workspace, modified } : workspace,
      ),
    })

    get().addDocumentRevision({
      workspaceId: page.workspaceId,
      pageId: page.id,
      title: page.name,
      source: 'restore',
      content: nextContent as PersistedDocumentContent,
    })
    queuePersist(get())
  },

  getPageContent: (id: string) => plateDocumentToMarkdown(contentStore[id] ?? emptyPlateDocument()),
}))
