import { Outlet } from '@tanstack/react-router'
import { useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'
import Sidebar from '../components/Sidebar'
import TabBar from '../components/TabBar'

export default function Root() {
  const { activeId, activeWorkspaceId, closeTab, isSidebarCollapsed, toggleSidebar, createPage, pages, theme } = useDocumentStore()
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

  const handleNewPageInCurrentFolder = useCallback(() => {
    const activePage = activeId
      ? pages.find(page => page.id === activeId && page.workspaceId === activeWorkspaceId)
      : null
    const currentFolder = activePage?.indexedPath.length ? activePage.indexedPath : ['Inbox']
    const page = createPage('Untitled', currentFolder)
    navigate({ to: '/document/$id', params: { id: page.id } })
  }, [activeId, activeWorkspaceId, createPage, navigate, pages])

  const handleCloseActiveTab = useCallback(() => {
    if (!activeId) return

    const nextId = closeTab(activeId)
    if (nextId) {
      navigate({ to: '/document/$id', params: { id: nextId } })
    } else {
      navigate({ to: '/' })
    }
  }, [activeId, closeTab, navigate])

  useEffect(() => {
    const appShortcuts = (window as Window & {
      appShortcuts?: {
        onCloseActiveTab: (callback: () => void) => () => void
      }
    }).appShortcuts

    return appShortcuts?.onCloseActiveTab(handleCloseActiveTab)
  }, [handleCloseActiveTab])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleNewPage()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        handleCloseActiveTab()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        handleNewPageInCurrentFolder()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleCloseActiveTab, handleNewPage, handleNewPageInCurrentFolder, toggleSidebar])

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar onNewPage={handleNewPage} />
      <main className="main-content">
        <TabBar onNewPage={handleNewPage} />
        <Outlet />
      </main>
    </div>
  )
}
