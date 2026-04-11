import { Outlet } from '@tanstack/react-router'
import { useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'
import Sidebar from '../components/Sidebar'

export default function Root() {
  const { isSidebarCollapsed, toggleSidebar, createDocument } = useDocumentStore()
  const navigate = useNavigate()

  const handleNewDocument = useCallback(() => {
    const doc = createDocument('Untitled')
    navigate({ to: '/document/$id', params: { id: doc.id } })
  }, [createDocument, navigate])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleNewDocument()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewDocument, toggleSidebar])

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar onNewDocument={handleNewDocument} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
