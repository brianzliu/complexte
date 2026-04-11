import { contextBridge, ipcRenderer } from 'electron'

type GenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

type GenerateDocumentResponse = {
  content: string
}

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

function readOpenRouterContent(payload: OpenRouterChatResponse): string {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map(part => part.text ?? '')
      .join('\n')
      .trim()
  }
  return ''
}

function isMissingOpenRouterHandler(error: unknown): boolean {
  return error instanceof Error && /No handler registered for 'openrouter:generate-document'/.test(error.message)
}

async function generateDocumentWithFetch(request: GenerateDocumentRequest): Promise<GenerateDocumentResponse> {
  const apiKey = request.apiKey.trim()
  const model = request.model.trim()
  const prompt = request.prompt.trim()

  if (!apiKey) throw new Error('Add an OpenRouter API key in Settings before generating a document.')
  if (!prompt) throw new Error('Enter what you want this document to cover.')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://complexte.local',
      'X-OpenRouter-Title': 'Complexte',
    },
    body: JSON.stringify({
      model: model || undefined,
      messages: [
        {
          role: 'system',
          content: [
            'You write polished Markdown documents for a desktop writing app.',
            'Return only the document body in Markdown.',
            'Start with a clear H1 title.',
            'Use concise sections, bullets, tables, or checklists only when they fit the user request.',
            'Do not include prefaces, code fences around the full answer, or notes about being an AI.',
          ].join(' '),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 1800,
    }),
  })

  const payload = await response.json().catch(() => ({})) as OpenRouterChatResponse
  const content = readOpenRouterContent(payload)

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenRouter request failed with status ${response.status}.`)
  }
  if (!content) throw new Error('OpenRouter returned an empty document.')

  return { content }
}

async function generateDocument(request: GenerateDocumentRequest): Promise<GenerateDocumentResponse> {
  try {
    return await ipcRenderer.invoke('openrouter:generate-document', request)
  } catch (error) {
    if (!isMissingOpenRouterHandler(error)) throw error
    return generateDocumentWithFetch(request)
  }
}

contextBridge.exposeInMainWorld('platform', process.platform)

contextBridge.exposeInMainWorld('openRouter', {
  generateDocument,
})
