import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useDocumentStore } from '../store/useDocumentStore'
import { organizeDocument } from '../lib/documentIntelligence'
import Editor from '../components/Editor'
import DocumentStarter from '../components/DocumentStarter'
import RelationshipMap from '../components/RelationshipMap'

export default function DocumentPage() {
  const navigate = useNavigate()
  const { id } = useParams({ strict: false }) as { id: string }
  const {
    activeId,
    applyPageOrganization,
    documentRevisions,
    getPageContent,
    openPage,
    pages,
    renamePage,
    restoreDocumentRevision,
    selectionAiActions,
    workspaces,
  } = useDocumentStore()
  const [titleDraft, setTitleDraft] = useState('')

  useEffect(() => {
    openPage(id)
  }, [id, openPage])

  const page = pages.find(item => item.id === id)
  const workspace = page ? workspaces.find(item => item.id === page.workspaceId) : null
  const workspacePages = page
    ? pages.filter(item => item.workspaceId === page.workspaceId)
    : []
  const relatedPages = page
    ? page.relatedIds
        .map(relatedId => pages.find(item => item.id === relatedId && item.workspaceId === page.workspaceId))
        .filter((relatedPage): relatedPage is NonNullable<typeof relatedPage> => Boolean(relatedPage))
    : []
  const recentAiActions = page
    ? selectionAiActions
        .filter(action => action.pageId === page.id)
        .slice(0, 3)
    : []
  const recentRevisions = page
    ? documentRevisions
        .filter(revision => revision.pageId === page.id)
        .slice(0, 3)
    : []
  const organizationSuggestions = page
    ? organizeDocument(
        {
          id: page.id,
          name: page.name,
          indexedPath: page.indexedPath,
          content: getPageContent(page.id),
        },
        workspacePages
          .filter(candidate => candidate.id !== page.id)
          .map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            indexedPath: candidate.indexedPath,
            semanticVector: candidate.semanticVector,
            content: getPageContent(candidate.id),
          })),
      ).suggestions
        .filter(suggestion => suggestion.indexedPath.join('/') !== page.indexedPath.join('/'))
        .slice(0, 3)
    : []
  const pathSegments = page
    ? [workspace?.name, ...page.indexedPath, page.name].filter(Boolean)
    : ['Untitled']

  useEffect(() => {
    setTitleDraft(page?.name ?? '')
  }, [page?.name])

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
      {page && (
        <>
          {page.isInitialized && (
            <div className="document-title-shell">
              <input
                className="document-title-input"
                type="text"
                value={titleDraft}
                onChange={event => setTitleDraft(event.target.value)}
                onBlur={() => {
                  const nextValue = titleDraft.trim()
                  if (nextValue && nextValue !== page.name) {
                    renamePage(page.id, nextValue)
                  } else {
                    setTitleDraft(page.name)
                  }
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                  if (event.key === 'Escape') {
                    setTitleDraft(page.name)
                    event.currentTarget.blur()
                  }
                }}
                placeholder="Untitled"
                spellCheck={false}
              />
              <div className="document-title-meta">
                <span>{workspace?.name ?? 'Workspace'}</span>
                <span className="document-title-dot" />
                <span>{page.collections[0] || 'Unsorted'}</span>
                <span className="document-title-dot" />
                <span>{new Date(page.modified).toLocaleString()}</span>
                <span className="document-title-dot" />
                <span
                  className={`document-confidence-pill ${
                    page.organizationConfidence >= 0.75
                      ? 'high'
                      : page.organizationConfidence >= 0.45
                        ? 'medium'
                        : 'low'
                  }`}
                >
                  {page.organizationConfidence >= 0.75
                    ? 'High confidence'
                    : page.organizationConfidence >= 0.45
                      ? 'Review placement'
                      : 'Low confidence'}
                </span>
              </div>
            </div>
          )}

          <div className="document-context-strip">
            <div className="document-collections">
              {page.collections.map(collection => (
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

          {organizationSuggestions.length > 0 && page.organizationConfidence < 0.75 && (
            <div className="document-organization-panel">
              <div className="document-organization-copy">
                <span className="document-related-label">Placement Options</span>
                <p>
                  The agent is not fully confident about where this document belongs.
                  Apply one of the stronger paths to keep the workspace organized.
                </p>
              </div>
              <div className="document-organization-actions">
                {organizationSuggestions.map(suggestion => (
                  <button
                    key={suggestion.indexedPath.join('/')}
                    className="document-organization-option"
                    onClick={() => applyPageOrganization(page.id, suggestion.indexedPath)}
                  >
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.indexedPath.join(' / ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentAiActions.length > 0 && (
            <div className="document-ai-history">
              <span className="document-related-label">Recent AI Actions</span>
              <div className="document-ai-history-list">
                {recentAiActions.map(action => (
                  <div key={action.id} className="document-ai-history-item">
                    <strong>{action.applyMode === 'replace' ? 'Replace' : 'Insert below'}</strong>
                    <span>{action.instruction}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentRevisions.length > 0 && (
            <div className="document-ai-history">
              <span className="document-related-label">Recent Revisions</span>
              <div className="document-ai-history-list">
                {recentRevisions.map(revision => (
                  <button
                    key={revision.id}
                    className="document-revision-item"
                    onClick={() => restoreDocumentRevision(revision.id)}
                  >
                    <strong>{revision.source}</strong>
                    <span>{revision.preview || revision.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <RelationshipMap
            page={page}
            workspacePages={workspacePages}
            onOpenPage={pageId => navigate({ to: '/document/$id', params: { id: pageId } })}
          />
        </>
      )}
      {activeId === id && (
        page?.isInitialized ? <Editor key={id} /> : <DocumentStarter pageId={id} />
      )}
    </div>
  )
}
