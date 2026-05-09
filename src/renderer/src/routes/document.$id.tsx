import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { organizeDocument } from '../lib/documentIntelligence'
import { useDocumentStore } from '../store/useDocumentStore'
import Editor from '../components/Editor'
import DocumentStarter from '../components/DocumentStarter'

export default function DocumentPage() {
  const navigate = useNavigate()
  const { id } = useParams({ strict: false }) as { id: string }
  const { activeId, getPageContent, openPage, pages, workspaces } = useDocumentStore()

  useEffect(() => {
    openPage(id)
  }, [id, openPage])

  const page = pages.find(item => item.id === id)
  const workspace = page ? workspaces.find(item => item.id === page.workspaceId) : null
  const workspaceDocuments = page
    ? pages
        .filter(item => item.workspaceId === page.workspaceId)
        .map(item => ({
          id: item.id,
          name: item.name,
          indexedPath: item.indexedPath,
          content: getPageContent(item.id),
        }))
    : []
  const organization = page
    ? organizeDocument(
        {
          id: page.id,
          name: page.name,
          indexedPath: page.indexedPath,
          content: getPageContent(page.id),
        },
        workspaceDocuments,
      )
    : null
  const relatedPages = organization
    ? organization.relatedIds
        .map(relatedId => pages.find(item => item.id === relatedId))
        .filter((relatedPage): relatedPage is NonNullable<typeof relatedPage> => Boolean(relatedPage))
    : []
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
      {page && organization && (
        <div className="document-context-strip">
          <div className="document-collections">
            {organization.collections.map(collection => (
              <span key={collection} className="document-collection-chip">
                {collection}
              </span>
            ))}
          </div>

          {relatedPages.length > 0 && (
            <div className="document-related-wrap">
              <span className="document-related-label">Related</span>
              <div className="document-related-list">
                {relatedPages.map(relatedPage => (
                  <button
                    key={relatedPage.id}
                    className="document-related-pill"
                    onClick={() => navigate({ to: '/document/$id', params: { id: relatedPage.id } })}
                  >
                    {relatedPage.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {activeId === id && (
        page?.isInitialized ? <Editor key={id} /> : <DocumentStarter pageId={id} />
      )}
    </div>
  )
}
