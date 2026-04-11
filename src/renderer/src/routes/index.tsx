import { useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'

export default function IndexPage() {
  const { activeWorkspaceId, createPage, pages, workspaces } = useDocumentStore()
  const navigate = useNavigate()
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)

  const handleNewPage = () => {
    const page = createPage('Untitled')
    navigate({ to: '/document/$id', params: { id: page.id } })
  }

  const recentPages = pages
    .filter(page => page.workspaceId === activeWorkspaceId)
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
    .slice(0, 3)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="welcome-page">
      <div className="welcome-inner">
        <div className="welcome-logo">
          <img src="/favicon.svg" alt="Complexte" draggable={false} />
        </div>

        <h1 className="welcome-greeting">{greeting()}</h1>
        <p className="welcome-sub">{activeWorkspace?.name ?? 'Workspace'}</p>

        <button className="welcome-new-btn" onClick={handleNewPage}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Page
        </button>

        {recentPages.length > 0 && (
          <div className="welcome-recent">
            <p className="welcome-recent-label">Recent</p>
            <div className="welcome-recent-list">
              {recentPages.map(page => (
                <button
                  key={page.id}
                  className="welcome-recent-item"
                  onClick={() => navigate({ to: '/document/$id', params: { id: page.id } })}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{page.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="welcome-shortcuts">
          <div className="shortcut-row">
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>⌘</kbd><kbd>N</kbd>
              </div>
              <span>New page</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>⌘</kbd><kbd>\</kbd>
              </div>
              <span>Toggle sidebar</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>⌘</kbd><kbd>S</kbd>
              </div>
              <span>Save document</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
