import { useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useDocumentStore } from '../store/useDocumentStore'
import Editor from '../components/Editor'
import DocumentStarter from '../components/DocumentStarter'

export default function DocumentPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { openPage, pages, activeId, workspaces } = useDocumentStore()

  useEffect(() => {
    openPage(id)
  }, [id, openPage])

  const page = pages.find(item => item.id === id)
  const workspace = page ? workspaces.find(item => item.id === page.workspaceId) : null
  const pathSegments = page
    ? [workspace?.name, ...page.indexedPath, page.name].filter(Boolean)
    : ['Untitled']

  return (
    <div className="document-page">
      <div className="document-topbar">
        <nav className="document-breadcrumb" aria-label="Document path">
          {pathSegments.map((segment, index) => {
            const isCurrent = index === pathSegments.length - 1
            return (
              <span key={`${segment}-${index}`} className="breadcrumb-segment-wrap">
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                {isCurrent ? (
                  <h1 className="breadcrumb-segment current">{segment}</h1>
                ) : (
                  <span className="breadcrumb-segment">{segment}</span>
                )}
              </span>
            )
          })}
        </nav>
      </div>
      {activeId === id && (
        page?.isInitialized ? <Editor key={id} /> : <DocumentStarter pageId={id} />
      )}
    </div>
  )
}
