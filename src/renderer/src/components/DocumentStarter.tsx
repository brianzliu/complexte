import { useNavigate } from '@tanstack/react-router'
import { FormEvent, useMemo, useState } from 'react'
import { generateDocument } from '../lib/openRouter'
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

export default function DocumentStarter({ pageId }: { pageId: string }) {
  const navigate = useNavigate()
  const { aiSettings, initializePage, setPageContent } = useDocumentStore()
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const canGenerate = useMemo(
    () => prompt.trim().length > 0 && aiSettings.openRouterApiKey.trim().length > 0 && !isGenerating,
    [aiSettings.openRouterApiKey, isGenerating, prompt],
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

    try {
      const content = await generateDocument({
        apiKey: aiSettings.openRouterApiKey,
        model: aiSettings.openRouterModel,
        prompt,
      })
      setPageContent(pageId, content, {
        initialize: true,
        name: deriveTitle(content, prompt),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the document.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="document-starter">
      <div className="document-starter-inner">
        <div className="document-starter-copy">
          <p className="document-starter-eyebrow">New document</p>
          <h2 className="document-starter-title">What are you thinking of?</h2>
          <p className="document-starter-subtitle">
            Describe the document you want, then start from a generated draft.
          </p>
        </div>

        <form className="prompt-composer" onSubmit={handleGenerate}>
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
            placeholder="What are you thinking of?"
            rows={3}
            disabled={isGenerating}
          />
          <div className="prompt-composer-footer">
            <button
              type="button"
              className="prompt-secondary-btn"
              onClick={() => initializePage(pageId)}
              disabled={isGenerating}
            >
              Start with a blank document
            </button>
            {!aiSettings.openRouterApiKey.trim() && (
              <button
                type="button"
                className="prompt-secondary-btn"
                onClick={() => navigate({ to: '/settings' })}
                disabled={isGenerating}
              >
                Add OpenRouter key
              </button>
            )}
            <button type="submit" className="prompt-primary-btn" disabled={!canGenerate}>
              {isGenerating ? 'Generating...' : 'Generate draft'}
            </button>
          </div>
        </form>

        {error && <p className="prompt-error">{error}</p>}
      </div>
    </div>
  )
}
