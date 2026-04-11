import { useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useDocumentStore } from '../store/useDocumentStore'
import Editor from '../components/Editor'

export default function DocumentPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { openPage, pages, activeId, toggleSidebar, isSidebarCollapsed } = useDocumentStore()

  useEffect(() => {
    openPage(id)
  }, [id])

  const page = pages.find(item => item.id === id)

  return (
    <div className="document-page">
      <div className="document-topbar">
        <button
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
        <h1 className="document-title">{page?.name ?? 'Untitled'}</h1>
      </div>
      {activeId === id && <Editor key={id} />}
    </div>
  )
}
