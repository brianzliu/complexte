import { useLocation, useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'

interface TabBarProps {
  onNewPage: () => void
}

function getDocumentIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/document\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export default function TabBar({ onNewPage }: TabBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeId, closeTab, openTabIds, pages } = useDocumentStore()

  const routeDocumentId = getDocumentIdFromPath(location.pathname)
  const activeTabId = routeDocumentId ?? activeId
  const openTabs = openTabIds
    .map(id => pages.find(page => page.id === id))
    .filter(Boolean)

  const handleCloseTab = (id: string) => {
    const isActiveTab = activeTabId === id
    const nextId = closeTab(id)

    if (!isActiveTab) return

    if (nextId) {
      navigate({ to: '/document/$id', params: { id: nextId } })
    } else {
      navigate({ to: '/' })
    }
  }

  return (
    <div className="app-tabbar">
      <div className="app-tabs" role="tablist" aria-label="Open documents">
        {openTabs.map(page => (
          <div
            key={page.id}
            className={`app-tab ${activeTabId === page.id ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTabId === page.id}
          >
            <button
              className="app-tab-main"
              title={page.name}
              onClick={() => navigate({ to: '/document/$id', params: { id: page.id } })}
            >
              <svg className="app-tab-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="app-tab-title">{page.name}</span>
            </button>
            <button
              className="app-tab-close"
              aria-label={`Close ${page.name}`}
              onClick={e => {
                e.stopPropagation()
                handleCloseTab(page.id)
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button className="app-tab-new" onClick={onNewPage} title="New page">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
