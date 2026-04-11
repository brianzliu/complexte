import { useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { useDocumentStore } from '../store/useDocumentStore'

interface SidebarProps {
  onNewDocument: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Sidebar({ onNewDocument }: SidebarProps) {
  const navigate = useNavigate()
  const { documents, activeId, deleteDocument, renameDocument } = useDocumentStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newDocName, setNewDocName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  const newDocInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const filteredDocs = documents.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    if (isCreating) newDocInputRef.current?.focus()
  }, [isCreating])

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renamingId])

  useEffect(() => {
    if (!contextMenuId) return
    const handleClick = (e: MouseEvent) => {
      if (!contextMenuRef.current?.contains(e.target as Node)) {
        setContextMenuId(null)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [contextMenuId])

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenuId(id)
    setContextMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleCreateSubmit = () => {
    if (newDocName.trim()) {
      onNewDocument()
    }
    setIsCreating(false)
    setNewDocName('')
  }

  const handleRenameSubmit = (id: string) => {
    if (renameValue.trim()) {
      renameDocument(id, renameValue.trim())
    }
    setRenamingId(null)
  }

  const startCreate = () => {
    setIsCreating(true)
    setNewDocName('')
  }

  const startRename = (id: string, currentName: string) => {
    setContextMenuId(null)
    setRenamingId(id)
    setRenameValue(currentName)
  }

  const handleDelete = (id: string) => {
    setContextMenuId(null)
    deleteDocument(id)
    if (activeId === id) {
      navigate({ to: '/' })
    }
  }

  return (
    <aside className="sidebar">
      {/* ── Header ── */}
      <div className="sidebar-header">
        <div className="app-brand">
          <img className="app-brand-logo" src="/favicon.svg" alt="" draggable={false} />
          <span className="app-brand-name">Complexte</span>
        </div>

        <button className="icon-btn" onClick={startCreate} title="New document (⌘N)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* ── Search ── */}
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

      {/* ── Document List ── */}
      <div className="sidebar-list-wrap">
        <div className="sidebar-section-header">
          <span>Documents</span>
          <span className="sidebar-section-count">{filteredDocs.length}</span>
        </div>

        <div className="doc-list">
          {/* Inline create input */}
          {isCreating && (
            <div className="doc-item creating">
              <svg className="doc-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <input
                ref={newDocInputRef}
                className="inline-input"
                type="text"
                value={newDocName}
                placeholder="Document name…"
                onChange={e => setNewDocName(e.target.value)}
                onBlur={handleCreateSubmit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateSubmit()
                  if (e.key === 'Escape') { setIsCreating(false); setNewDocName('') }
                }}
              />
            </div>
          )}

          {filteredDocs.length === 0 && !isCreating && (
            <div className="doc-empty">
              {searchQuery ? 'No results' : 'No documents yet'}
            </div>
          )}

          {filteredDocs.map(doc => (
            <div
              key={doc.id}
              className={`doc-item ${activeId === doc.id ? 'active' : ''}`}
              onClick={() => navigate({ to: '/document/$id', params: { id: doc.id } })}
              onContextMenu={e => handleContextMenu(e, doc.id)}
            >
              <svg className="doc-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>

              {renamingId === doc.id ? (
                <input
                  ref={renameInputRef}
                  className="inline-input"
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onBlur={() => handleRenameSubmit(doc.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameSubmit(doc.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <div className="doc-info">
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-date">{formatDate(doc.modified)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="vault-indicator">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>My Vault</span>
        </div>
        <div className="vault-doc-count">{documents.length} docs</div>
      </div>

      {/* ── Context Menu ── */}
      {contextMenuId && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              const doc = documents.find(d => d.id === contextMenuId)
              if (doc) startRename(doc.id, doc.name)
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item danger"
            onClick={() => handleDelete(contextMenuId)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}
