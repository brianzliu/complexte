export interface Workspace {
  id: string
  name: string
  modified: string
}

export interface PromptSession {
  id: string
  workspaceId: string
  pageId: string
  prompt: string
  createdAt: string
  relatedDocumentIds: string[]
}

export interface SelectionAiAction {
  id: string
  workspaceId: string
  pageId: string
  instruction: string
  selectionPreview: string
  applyMode: 'replace' | 'insert-below'
  createdAt: string
}

export interface PageMeta {
  id: string
  workspaceId: string
  name: string
  indexedPath: string[]
  collections: string[]
  relatedIds: string[]
  modified: string
  order: number
  isInitialized: boolean
}

export type PersistedDocumentContent = unknown[]

export interface PersistedDocumentSnapshot {
  version: 2
  workspaces: Workspace[]
  activeWorkspaceId: string
  pages: PageMeta[]
  activeId: string | null
  openTabIds: string[]
  promptSessions: PromptSession[]
  selectionAiActions: SelectionAiAction[]
  contentById: Record<string, PersistedDocumentContent>
  pageCounter: number
  workspaceCounter: number
}
