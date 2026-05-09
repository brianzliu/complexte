import { FormEvent, useMemo, useState } from 'react'
import { streamDocument } from '../lib/openRouter'
import { findRelevantChunks } from '../lib/documentIntelligence'
import { markdownToPlateDocument } from '../lib/plateDocument'
import { useDocumentStore } from '../store/useDocumentStore'

function deriveTitle(markdown: string, fallback: string): string {
  const heading = markdown
    .split('\n')
    .map(line => line.trim())
    .find(line => /^#\s+/.test(line))

  if (heading) return heading.replace(/^#\s+/, '').trim().slice(0, 80)

  const promptTitle = fallback
    .replace(/[^\w\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')

  return promptTitle || 'Untitled'
}

function buildGenerationPrompt(
  prompt: string,
  relatedChunks: Array<{ documentName: string; indexedPath: string[]; excerpt: string }>,
): string {
  if (relatedChunks.length === 0) return prompt

  return [
    'User request:',
    prompt,
    '',
    'Relevant workspace passages:',
    ...relatedChunks.map((chunk, index) => [
      `Passage ${index + 1}: ${chunk.documentName}${chunk.indexedPath.length > 0 ? ` (${chunk.indexedPath.join(' / ')})` : ''}`,
      chunk.excerpt,
    ].join('\n')),
    '',
    'Write the new document using the request as the main goal.',
    'Use the related context when it is relevant, but do not mention these instructions.',
  ].join('\n')
}

export default function DocumentStarter({ pageId }: { pageId: string }) {
  const { addDocumentRevision, addPromptSession, aiSettings, getPageContent, initializePage, pages, setPageContent } = useDocumentStore()
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const hasOpenRouterKey = aiSettings.openRouterApiKey.trim().length > 0
  const page = pages.find(item => item.id === pageId)
  const relatedChunks = useMemo(
    () => (page && prompt.trim())
      ? findRelevantChunks(
          prompt,
          pages
            .filter(candidate => candidate.workspaceId === page.workspaceId && candidate.id !== pageId)
            .map(candidate => ({
              id: candidate.id,
              name: candidate.name,
              indexedPath: candidate.indexedPath,
              semanticVector: candidate.semanticVector,
              content: getPageContent(candidate.id),
            })),
          5,
        )
      : [],
    [getPageContent, page, pageId, pages, prompt],
  )
  const relatedDocumentIds = useMemo(
    () => Array.from(new Set(relatedChunks.map(chunk => chunk.documentId))),
    [relatedChunks],
  )

  const canGenerate = useMemo(
    () => prompt.trim().length > 0 && hasOpenRouterKey && !isGenerating,
    [hasOpenRouterKey, isGenerating, prompt],
  )

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!prompt.trim()) return

    if (!aiSettings.openRouterApiKey.trim()) {
      setError('Add your OpenRouter API key in Settings to generate a document.')
      return
    }

    setError(null)
    setIsGenerating(true)

    const writeContent = (content: string) => {
      setPageContent(pageId, content, {
        initialize: true,
        name: deriveTitle(content, prompt),
      })
    }

    let streamedContent = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const flushContent = () => {
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      writeContent(streamedContent)
    }

    const scheduleFlush = () => {
      if (flushTimer) return
      flushTimer = setTimeout(flushContent, 120)
    }

    writeContent('')

    try {
      streamedContent = await streamDocument(
        {
          apiKey: aiSettings.openRouterApiKey,
          model: aiSettings.openRouterModel,
          prompt: buildGenerationPrompt(
            prompt,
            relatedChunks.map(({ documentName, indexedPath, excerpt }) => ({ documentName, indexedPath, excerpt })),
          ),
        },
        {
          onDelta: (_delta, content) => {
            streamedContent = content
            scheduleFlush()
          },
        },
      )
      if (page) {
        addPromptSession({
          workspaceId: page.workspaceId,
          pageId,
          prompt,
          relatedDocumentIds,
        })
        addDocumentRevision({
          workspaceId: page.workspaceId,
          pageId,
          title: deriveTitle(streamedContent, prompt),
          source: 'prompt',
          content: markdownToPlateDocument(streamedContent),
        })
      }
      flushContent()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate the document.'
      streamedContent = [
        streamedContent.trim(),
        `> Generation stopped: ${message}`,
      ].filter(Boolean).join('\n\n')
      flushContent()
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="document-starter">
      <div className="document-starter-inner">
        <div className="document-starter-copy">
          <h2 className="document-starter-title">What are you thinking of?</h2>
          <p className="document-starter-subtitle">Prompt first. The agent drafts against relevant workspace context, then you edit from there.</p>
        </div>

        <form className="prompt-composer" onSubmit={handleGenerate}>
          <div className="prompt-composer-box">
            <textarea
              className="prompt-composer-input"
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="Draft a project brief, meeting notes, or study plan..."
              rows={3}
              disabled={isGenerating}
            />
          </div>
          <div className="prompt-composer-footer">
            <button
              type="button"
              className="prompt-secondary-btn"
              onClick={() => initializePage(pageId)}
              disabled={isGenerating}
            >
              Start with a blank document
            </button>
            <span className="prompt-submit-wrap">
              <button type="submit" className="prompt-primary-btn" disabled={!canGenerate}>
                {isGenerating ? 'Generating...' : 'Generate draft'}
              </button>
              {!hasOpenRouterKey && (
                <span className="prompt-key-tooltip" role="dialog">
                  Go to Settings to configure your OpenRouter key.
                </span>
              )}
            </span>
          </div>
        </form>

        {relatedChunks.length > 0 ? (
          <div className="prompt-context-panel">
            <div className="prompt-context-header">
              <span className="prompt-context-label">Will use related context</span>
              <span className="prompt-context-count">{relatedChunks.length} passages from {relatedDocumentIds.length} docs</span>
            </div>
            <div className="prompt-context-list">
              {relatedChunks.map(chunk => (
                <div key={chunk.id} className="prompt-context-item">
                  <div className="prompt-context-title">
                    {chunk.documentName}
                    {chunk.indexedPath.length > 0 && <span className="prompt-context-path">{chunk.indexedPath.join(' / ')}</span>}
                  </div>
                  <div className="prompt-context-excerpt">{chunk.excerpt}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="prompt-error" style={{ visibility: error ? 'hidden' : 'visible' }}>
            New drafts pull in the most relevant documents from this workspace before generation.
          </p>
        )}
        {error && <p className="prompt-error">{error}</p>}
      </div>
    </div>
  )
}
