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

export interface DocumentRevision {
  id: string
  workspaceId: string
  pageId: string
  title: string
  preview: string
  source: 'save' | 'prompt' | 'restore'
  createdAt: string
  content: PersistedDocumentContent
}

export interface PageMeta {
  id: string
  workspaceId: string
  name: string
  indexedPath: string[]
  collections: string[]
  relatedIds: string[]
  semanticVector: number[]
  organizationConfidence: number
  modified: string
  order: number
  isInitialized: boolean
}

export type PersistedDocumentContent = unknown[]

export interface PersistedDocumentSnapshot {
  version: 5
  workspaces: Workspace[]
  activeWorkspaceId: string
  pages: PageMeta[]
  activeId: string | null
  openTabIds: string[]
  promptSessions: PromptSession[]
  selectionAiActions: SelectionAiAction[]
  documentRevisions: DocumentRevision[]
  contentById: Record<string, PersistedDocumentContent>
  pageCounter: number
  workspaceCounter: number
}
