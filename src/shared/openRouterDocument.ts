export type GenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

export type GenerateDocumentResponse = {
  content: string
}

type OpenRouterErrorMetadata = {
  provider_name?: string
  raw?: unknown
  [key: string]: unknown
}

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: {
    code?: number | string
    message?: string
    metadata?: OpenRouterErrorMetadata
  }
}

type NormalizedGenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

type TokenMode = 'max_completion_tokens' | 'max_tokens'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_OUTPUT_TOKENS = 1800
const GENERIC_PROVIDER_ERROR = 'Provider returned error'

class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: OpenRouterChatResponse,
  ) {
    super(message)
    this.name = 'OpenRouterRequestError'
  }

  shouldRetryWithCompatibilityRequest(): boolean {
    const message = this.payload.error?.message ?? ''
    return this.status >= 500 || message === GENERIC_PROVIDER_ERROR
  }
}

function normalizeRequest(request: GenerateDocumentRequest): NormalizedGenerateDocumentRequest {
  const apiKey = request.apiKey.trim()
  const model = request.model.trim()
  const prompt = request.prompt.trim()

  if (!apiKey) throw new Error('Add an OpenRouter API key in Settings before generating a document.')
  if (!prompt) throw new Error('Enter what you want this document to cover.')

  return { apiKey, model, prompt }
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

function truncateDetail(value: string): string {
  return value.length > 700 ? `${value.slice(0, 697)}...` : value
}

function stringifyDetail(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function describeOpenRouterError(status: number, payload: OpenRouterChatResponse): string {
  const error = payload.error
  const metadata = error?.metadata
  const message = error?.message || `Request failed with status ${status}.`
  const details = new Set<string>()

  if (error?.code) details.add(`Code: ${error.code}`)
  if (metadata?.provider_name) details.add(`Provider: ${metadata.provider_name}`)

  const rawDetail = stringifyDetail(metadata?.raw)
  if (rawDetail) details.add(`Detail: ${truncateDetail(rawDetail)}`)

  for (const key of ['message', 'error', 'detail', 'reason', 'cause']) {
    const detail = stringifyDetail(metadata?.[key])
    if (detail && detail !== rawDetail && detail !== message) {
      details.add(`${key}: ${truncateDetail(detail)}`)
    }
  }

  if (message === GENERIC_PROVIDER_ERROR && details.size === 0) {
    details.add('The selected provider rejected the request without details. Try a different OpenRouter model in Settings.')
  }

  const suffix = details.size > 0 ? ` ${Array.from(details).join(' ')}` : ''
  return `OpenRouter request failed (HTTP ${status}): ${message}.${suffix}`
}

function buildRequestBody(request: NormalizedGenerateDocumentRequest, tokenMode: TokenMode): Record<string, unknown> {
  return {
    model: request.model || undefined,
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
        content: request.prompt,
      },
    ],
    temperature: 0.7,
    [tokenMode]: MAX_OUTPUT_TOKENS,
  }
}

async function requestOpenRouterDocument(
  request: NormalizedGenerateDocumentRequest,
  tokenMode: TokenMode,
): Promise<GenerateDocumentResponse> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://complexte.local',
      'X-OpenRouter-Title': 'Complexte',
    },
    body: JSON.stringify(buildRequestBody(request, tokenMode)),
  })

  const payload = await response.json().catch(() => ({})) as OpenRouterChatResponse
  const content = readOpenRouterContent(payload)

  if (!response.ok) {
    throw new OpenRouterRequestError(describeOpenRouterError(response.status, payload), response.status, payload)
  }
  if (!content) throw new Error('OpenRouter returned an empty document.')

  return { content }
}

export async function generateOpenRouterDocument(request: GenerateDocumentRequest): Promise<GenerateDocumentResponse> {
  const normalizedRequest = normalizeRequest(request)

  try {
    return await requestOpenRouterDocument(normalizedRequest, 'max_completion_tokens')
  } catch (error) {
    if (!(error instanceof OpenRouterRequestError) || !error.shouldRetryWithCompatibilityRequest()) {
      throw error
    }

    try {
      return await requestOpenRouterDocument(normalizedRequest, 'max_tokens')
    } catch (retryError) {
      if (retryError instanceof Error) {
        retryError.message = `${retryError.message} Retried with OpenRouter compatibility token parameter.`
      }
      throw retryError
    }
  }
}
