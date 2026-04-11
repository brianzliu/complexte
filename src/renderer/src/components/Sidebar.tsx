import { useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { PageMeta, useDocumentStore } from '../store/useDocumentStore'

interface SidebarProps {
  onNewPage: () => void
}

interface TreeContextMenu {
  type: 'page' | 'folder'
  x: number
  y: number
  id?: string
  path?: string[]
}

interface PendingDelete {
  ids: string[]
  title: string
  message: string
  confirmLabel: string
}

interface TaxonomyNode {
  name: string
  path: string[]
  folders: TaxonomyNode[]
  pages: PageMeta[]
}

function sortPages(a: PageMeta, b: PageMeta): number {
  return a.order - b.order || a.name.localeCompare(b.name)
}

function createNode(name: string, path: string[]): TaxonomyNode {
  return { name, path, folders: [], pages: [] }
}

function addPageToTree(root: TaxonomyNode, page: PageMeta): void {
  const segments = page.indexedPath.length ? page.indexedPath : ['Unsorted']
  let current = root

  segments.forEach(segment => {
    let child = current.folders.find(folder => folder.name === segment)
    if (!child) {
      child = createNode(segment, [...current.path, segment])
      current.folders.push(child)
    }
    current = child
  })

  current.pages.push(page)
}

function sortTree(node: TaxonomyNode): void {
  node.folders.sort((a, b) => a.name.localeCompare(b.name))
  node.pages.sort(sortPages)
  node.folders.forEach(sortTree)
}

function collectFolderPages(node: TaxonomyNode): PageMeta[] {
  return [
    ...node.pages,
    ...node.folders.flatMap(folder => collectFolderPages(folder)),
  ]
}

export default function Sidebar({ onNewPage }: SidebarProps) {
  const navigate = useNavigate()
  const {
    activeId,
    activeWorkspaceId,
    createWorkspace,
    deletePage,
    pages,
    renamePage,
    setActiveWorkspace,
    toggleSidebar,
    workspaces,
  } = useDocumentStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<TreeContextMenu | null>(null)
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(() => new Set())
  const [isSelectingPages, setIsSelectingPages] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(['Inbox', 'Projects', 'Projects/Roadmap', 'Projects/Design', 'Work', 'Work/Meetings', 'Research', 'Writing']),
  )

  const newWorkspaceInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const workspacePages = pages.filter(page => page.workspaceId === activeWorkspaceId)
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visiblePages = workspacePages.filter(page => {
    if (!normalizedSearch) return true
    return `${page.name} ${page.indexedPath.join(' ')}`.toLowerCase().includes(normalizedSearch)
  })

  const taxonomyRoot = createNode('root', [])
  visiblePages.forEach(page => addPageToTree(taxonomyRoot, page))
  sortTree(taxonomyRoot)
  const selectedCount = selectedPageIds.size

  useEffect(() => {
    if (isCreatingWorkspace) newWorkspaceInputRef.current?.focus()
  }, [isCreatingWorkspace])

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renamingId])

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: globalThis.MouseEvent) => {
      if (!contextMenuRef.current?.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  useEffect(() => {
    setSelectedPageIds(current => {
      const workspacePageIds = new Set(workspacePages.map(page => page.id))
      const next = new Set([...current].filter(id => workspacePageIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [activeWorkspaceId, pages])

  const toggleExpanded = (path: string[]) => {
    const key = path.join('/')
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleCreateWorkspaceSubmit = () => {
    const name = newWorkspaceName.trim()
    if (name) {
      createWorkspace(name)
      navigate({ to: '/' })
    }
    setIsCreatingWorkspace(false)
    setNewWorkspaceName('')
  }

  const handleWorkspaceSelect = (id: string) => {
    setActiveWorkspace(id)
    setSearchQuery('')
    setIsSelectingPages(false)
    setSelectedPageIds(new Set())
    navigate({ to: '/' })
  }

  const handlePageContextMenu = (e: MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type: 'page', id, x: e.clientX, y: e.clientY })
  }

  const handleFolderContextMenu = (e: MouseEvent, path: string[]) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type: 'folder', path, x: e.clientX, y: e.clientY })
  }

  const handleRenameSubmit = (id: string) => {
    if (renameValue.trim()) {
      renamePage(id, renameValue.trim())
    }
    setRenamingId(null)
  }

  const startRename = (id: string, currentName: string) => {
    setContextMenu(null)
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const requestPageDelete = (page: PageMeta) => {
    setContextMenu(null)
    setPendingDelete({
      ids: [page.id],
      title: 'Delete page?',
      message: `"${page.name}" will be permanently removed.`,
      confirmLabel: 'Delete page',
    })
  }

  const requestFolderDelete = (path: string[]) => {
    const pagesInFolder = workspacePages.filter(page =>
      path.every((segment, index) => page.indexedPath[index] === segment),
    )
    setContextMenu(null)
    setPendingDelete({
      ids: pagesInFolder.map(page => page.id),
      title: 'Delete folder?',
      message: `"${path.join('/')}" contains ${pagesInFolder.length} ${pagesInFolder.length === 1 ? 'page' : 'pages'}. Deleting it will remove every page in that folder.`,
      confirmLabel: 'Delete folder',
    })
  }

  const requestBulkDelete = () => {
    if (selectedPageIds.size === 0) return
    setPendingDelete({
      ids: [...selectedPageIds],
      title: 'Delete selected pages?',
      message: `${selectedPageIds.size} ${selectedPageIds.size === 1 ? 'page' : 'pages'} will be permanently removed.`,
      confirmLabel: 'Delete selected',
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const ids = pendingDelete.ids
    const shouldNavigateHome = activeId ? ids.includes(activeId) : false
    ids.forEach(id => deletePage(id))
    setSelectedPageIds(current => new Set([...current].filter(id => !ids.includes(id))))
    setPendingDelete(null)
    setContextMenu(null)
    if (shouldNavigateHome) {
      navigate({ to: '/' })
    }
  }

  const togglePageSelection = (id: string) => {
    setSelectedPageIds(current => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const setFolderSelection = (node: TaxonomyNode, selected: boolean) => {
    const pageIds = collectFolderPages(node).map(page => page.id)
    setSelectedPageIds(current => {
      const next = new Set(current)
      pageIds.forEach(id => {
        if (selected) {
          next.add(id)
        } else {
          next.delete(id)
        }
      })
      return next
    })
  }

  const toggleSelectionMode = () => {
    setIsSelectingPages(current => {
      if (current) setSelectedPageIds(new Set())
      return !current
    })
  }

  const renderFolder = (node: TaxonomyNode, depth: number) => {
    const key = node.path.join('/')
    const isExpanded = normalizedSearch ? true : expandedIds.has(key)
    const itemCount = node.folders.length + node.pages.length
    const folderPageIds = collectFolderPages(node).map(page => page.id)
    const selectedFolderPages = folderPageIds.filter(id => selectedPageIds.has(id)).length
    const isFolderChecked = folderPageIds.length > 0 && selectedFolderPages === folderPageIds.length
    const isFolderMixed = selectedFolderPages > 0 && selectedFolderPages < folderPageIds.length

    return (
      <div key={key} className="page-tree-branch">
        <div
          role="button"
          tabIndex={0}
          className="page-tree-item folder"
          style={{ '--depth': depth } as CSSProperties}
          onClick={() => toggleExpanded(node.path)}
          onContextMenu={e => handleFolderContextMenu(e, node.path)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleExpanded(node.path)
            }
          }}
        >
          <span className={`page-disclosure ${isExpanded ? 'expanded' : ''}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          <span className="page-row-main">
            <svg className="page-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="page-name">{node.name}</span>
          </span>
          {isSelectingPages && (
            <input
              className="page-select-checkbox"
              type="checkbox"
              checked={isFolderChecked}
              ref={input => {
                if (input) input.indeterminate = isFolderMixed
              }}
              onClick={e => e.stopPropagation()}
              onChange={e => setFolderSelection(node, e.target.checked)}
              aria-label={`Select ${node.name}`}
            />
          )}
          <span className="folder-count">{itemCount}</span>
        </div>

        {isExpanded && (
          <>
            {node.folders.map(folder => renderFolder(folder, depth + 1))}
            {node.pages.map(page => renderPage(page, depth + 1))}
          </>
        )}
      </div>
    )
  }

  const renderPage = (page: PageMeta, depth: number) => (
    <div
      key={page.id}
      className={`page-tree-item ${activeId === page.id ? 'active' : ''}`}
      style={{ '--depth': depth } as CSSProperties}
      onContextMenu={e => handlePageContextMenu(e, page.id)}
    >
      <span className="page-disclosure empty" />
      <button
        className="page-row-main"
        onClick={() => {
          if (isSelectingPages) {
            togglePageSelection(page.id)
          } else {
            navigate({ to: '/document/$id', params: { id: page.id } })
          }
        }}
      >
        <svg className="page-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>

        {renamingId === page.id ? (
          <input
            ref={renameInputRef}
            className="inline-input"
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onClick={e => e.stopPropagation()}
            onBlur={() => handleRenameSubmit(page.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSubmit(page.id)
              if (e.key === 'Escape') setRenamingId(null)
            }}
          />
        ) : (
          <span className="page-name">{page.name}</span>
        )}
      </button>
      {isSelectingPages && (
        <input
          className="page-select-checkbox"
          type="checkbox"
          checked={selectedPageIds.has(page.id)}
          onClick={e => e.stopPropagation()}
          onChange={() => togglePageSelection(page.id)}
          aria-label={`Select ${page.name}`}
        />
      )}
    </div>
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-header compact">
        <button
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          title="Hide sidebar"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        <button className="sidebar-home-btn" onClick={() => navigate({ to: '/' })} title="Home">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 10 9-7 9 7" />
            <path d="M5 10v10h14V10" />
          </svg>
          <span>Home</span>
        </button>

        <div className="sidebar-header-spacer" />

        <button className="icon-btn" onClick={() => setIsCreatingWorkspace(true)} title="New workspace">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 10v6" />
            <path d="M9 13h6" />
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <button className="icon-btn" onClick={onNewPage} title="New page (⌘N)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="workspace-panel">
        <div className="sidebar-section-header">
          <span>Workspaces</span>
          <span className="sidebar-section-count">{workspaces.length}</span>
        </div>

        <div className="workspace-list">
          {workspaces.map(workspace => (
            <button
              key={workspace.id}
              className={`workspace-item ${workspace.id === activeWorkspaceId ? 'active' : ''}`}
              onClick={() => handleWorkspaceSelect(workspace.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4z" />
                <path d="M8 8h8" />
                <path d="M8 12h5" />
              </svg>
              <span>{workspace.name}</span>
            </button>
          ))}
        </div>

        {isCreatingWorkspace && (
          <div className="workspace-create-row">
            <input
              ref={newWorkspaceInputRef}
              className="inline-input"
              type="text"
              value={newWorkspaceName}
              placeholder="Workspace name"
              onChange={e => setNewWorkspaceName(e.target.value)}
              onBlur={handleCreateWorkspaceSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateWorkspaceSubmit()
                if (e.key === 'Escape') {
                  setIsCreatingWorkspace(false)
                  setNewWorkspaceName('')
                }
              }}
            />
          </div>
        )}
      </div>

      <div className="sidebar-search-wrap">
        <div className="sidebar-search">
          <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-list-wrap">
        <div className="sidebar-section-header">
          <span>File Tree</span>
          <div className="section-actions">
            {isSelectingPages && selectedCount > 0 && (
              <button className="section-text-btn danger" onClick={requestBulkDelete}>
                Delete {selectedCount}
              </button>
            )}
            <button
              className={`section-text-btn ${isSelectingPages ? 'active' : ''}`}
              onClick={toggleSelectionMode}
            >
              {isSelectingPages ? 'Done' : 'Select'}
            </button>
            <button className="section-action-btn" onClick={onNewPage} title="New page">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="page-tree">
          {taxonomyRoot.folders.length === 0 && (
            <div className="doc-empty">
              {searchQuery ? 'No matching pages' : 'No indexed pages'}
            </div>
          )}

          {taxonomyRoot.folders.map(folder => renderFolder(folder, 0))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          className="icon-btn settings-btn"
          onClick={() => navigate({ to: '/settings' })}
          title="Settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'page' && (
            <button
              className="context-menu-item"
              onClick={() => {
                const page = pages.find(item => item.id === contextMenu.id)
                if (page) startRename(page.id, page.name)
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Rename
            </button>
          )}
          {contextMenu.type === 'page' && <div className="context-menu-divider" />}
          <button
            className="context-menu-item danger"
            onClick={() => {
              if (contextMenu.type === 'page') {
                const page = pages.find(item => item.id === contextMenu.id)
                if (page) requestPageDelete(page)
              } else {
                requestFolderDelete(contextMenu.path ?? [])
              }
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            {contextMenu.type === 'page' ? 'Delete page' : 'Delete folder'}
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="confirm-overlay" role="presentation" onMouseDown={() => setPendingDelete(null)}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="confirm-title" id="delete-confirm-title">{pendingDelete.title}</div>
            <div className="confirm-message">{pendingDelete.message}</div>
            <div className="confirm-actions">
              <button className="dialog-btn" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button className="dialog-btn danger" onClick={confirmDelete}>
                {pendingDelete.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
