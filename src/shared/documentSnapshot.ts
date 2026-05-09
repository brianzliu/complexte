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
  contentById: Record<string, PersistedDocumentContent>
  pageCounter: number
  workspaceCounter: number
}
