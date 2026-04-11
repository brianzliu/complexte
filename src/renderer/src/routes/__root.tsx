import { Outlet } from '@tanstack/react-router'
import { useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'
import Sidebar from '../components/Sidebar'

export default function Root() {
  const { isSidebarCollapsed, toggleSidebar, createPage, theme } = useDocumentStore()
  const navigate = useNavigate()

  useEffect(() => {
    const applyTheme = (t: typeof theme) => {
      if (t === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light'
      } else {
        document.documentElement.dataset.theme = t
      }
    }

    applyTheme(theme)

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('auto')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const handleNewPage = useCallback(() => {
    const page = createPage('Untitled')
    navigate({ to: '/document/$id', params: { id: page.id } })
  }, [createPage, navigate])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleNewPage()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewPage, toggleSidebar])

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar onNewPage={handleNewPage} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
