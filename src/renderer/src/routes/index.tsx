import { useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'

export default function IndexPage() {
  const { activeWorkspaceId, createPage, initializePage, pages, promptSessions, setDraftPromptSeed, workspaces } = useDocumentStore()
  const navigate = useNavigate()
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)

  const handleNewAIDraft = () => {
    const page = createPage('Untitled')
    navigate({ to: '/document/$id', params: { id: page.id } })
  }

  const handleNewBlankPage = () => {
    const page = createPage('Untitled')
    initializePage(page.id)
    navigate({ to: '/document/$id', params: { id: page.id } })
  }

  const handleRetryPrompt = (prompt: string) => {
    const page = createPage('Untitled')
    setDraftPromptSeed(page.id, prompt)
    navigate({ to: '/document/$id', params: { id: page.id } })
  }

  const recentPages = pages
    .filter(page => page.workspaceId === activeWorkspaceId)
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
    .slice(0, 3)
  const recentPrompts = promptSessions
    .filter(session => session.workspaceId === activeWorkspaceId)
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
        <h1 className="welcome-greeting">{greeting()}</h1>
        <p className="welcome-sub">{activeWorkspace?.name ?? 'Workspace'}</p>
        <p className="welcome-helper">
          Start with a prompt and let Complexte draft against the most relevant documents in this workspace.
        </p>

        <div className="welcome-actions">
          <button className="welcome-new-btn" onClick={handleNewAIDraft}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New with AI
          </button>
          <button className="welcome-secondary-btn" onClick={handleNewBlankPage}>
            Blank document
          </button>
        </div>

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

        {recentPrompts.length > 0 && (
          <div className="welcome-recent">
            <p className="welcome-recent-label">Recent Prompts</p>
            <div className="welcome-recent-list">
              {recentPrompts.map(session => (
                <button
                  key={session.id}
                  className="welcome-recent-item"
                  onClick={() => handleRetryPrompt(session.prompt)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <path d="M7 8h8a4 4 0 1 1 0 8H9" />
                  </svg>
                  <span>Retry: {session.prompt}</span>
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
              <span>New AI draft</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>⌘</kbd><kbd>T</kbd>
              </div>
              <span>New draft here</span>
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
