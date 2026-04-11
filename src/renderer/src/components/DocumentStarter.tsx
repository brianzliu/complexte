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
  const { aiSettings, initializePage, setPageContent } = useDocumentStore()
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const hasOpenRouterKey = aiSettings.openRouterApiKey.trim().length > 0

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
          <h2 className="document-starter-title">What are you thinking of?</h2>
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
              placeholder="What are you thinking of?"
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

        {error && <p className="prompt-error">{error}</p>}
      </div>
    </div>
  )
}
