export type GenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

export type GenerateDocumentResponse = {
  content: string
}

export type ReviseSelectionRequest = {
  apiKey: string
  model: string
  instruction: string
  selection: string
  documentContext?: string
}

export type ReviseSelectionResponse = {
  content: string
}

export type GenerateDocumentStreamCallbacks = {
  onDelta?: (delta: string, content: string) => void | Promise<void>
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

type OpenRouterStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: OpenRouterChatResponse['error']
}

type NormalizedGenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

type NormalizedReviseSelectionRequest = {
  apiKey: string
  model: string
  instruction: string
  selection: string
  documentContext: string
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

function normalizeSelectionRequest(request: ReviseSelectionRequest): NormalizedReviseSelectionRequest {
  const apiKey = request.apiKey.trim()
  const model = request.model.trim()
  const instruction = request.instruction.trim()
  const selection = request.selection.trim()
  const documentContext = request.documentContext?.trim() ?? ''

  if (!apiKey) throw new Error('Add an OpenRouter API key in Settings before using inline AI.')
  if (!selection) throw new Error('Select some text before asking the AI to revise it.')
  if (!instruction) throw new Error('Tell the AI how you want the selected text revised.')

  return {
    apiKey,
    model,
    instruction,
    selection,
    documentContext,
  }
}

function readContentValue(content: string | Array<{ text?: string }> | undefined, trim = true): string {
  if (typeof content === 'string') return trim ? content.trim() : content
  if (Array.isArray(content)) {
    const text = content
      .map(part => part.text ?? '')
      .join('\n')
    return trim ? text.trim() : text
  }
  return ''
}

function readOpenRouterContent(payload: OpenRouterChatResponse): string {
  return readContentValue(payload.choices?.[0]?.message?.content)
}

function readOpenRouterDelta(payload: OpenRouterStreamChunk): string {
  return readContentValue(payload.choices?.[0]?.delta?.content, false)
    || readContentValue(payload.choices?.[0]?.message?.content, false)
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

function buildRequestBody(
  request: NormalizedGenerateDocumentRequest,
  tokenMode: TokenMode,
  stream = false,
): Record<string, unknown> {
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
    stream,
    [tokenMode]: MAX_OUTPUT_TOKENS,
  }
}

function buildSelectionRequestBody(
  request: NormalizedReviseSelectionRequest,
  tokenMode: TokenMode,
): Record<string, unknown> {
  const contextBlock = request.documentContext
    ? `Document context:\n${request.documentContext.slice(0, 6000)}`
    : 'Document context:\n(Not provided)'

  return {
    model: request.model || undefined,
    messages: [
      {
        role: 'system',
        content: [
          'You are revising a user-selected passage inside a document editor.',
          'Return only the revised replacement text for the selected passage.',
          'Do not add titles, markdown fences, explanations, or commentary.',
          'Preserve the document voice unless the instruction explicitly asks for a change.',
          'You may expand, compress, or rewrite the selection, but stay scoped to the user instruction.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          contextBlock,
          `Selected text:\n${request.selection}`,
          `Instruction:\n${request.instruction}`,
        ].join('\n\n'),
      },
    ],
    temperature: 0.45,
    stream: false,
    [tokenMode]: 900,
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

async function requestOpenRouterSelectionRevision(
  request: NormalizedReviseSelectionRequest,
  tokenMode: TokenMode,
): Promise<ReviseSelectionResponse> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://complexte.local',
      'X-OpenRouter-Title': 'Complexte',
    },
    body: JSON.stringify(buildSelectionRequestBody(request, tokenMode)),
  })

  const payload = await response.json().catch(() => ({})) as OpenRouterChatResponse
  const content = readOpenRouterContent(payload)

  if (!response.ok) {
    throw new OpenRouterRequestError(describeOpenRouterError(response.status, payload), response.status, payload)
  }
  if (!content) throw new Error('OpenRouter returned an empty revision.')

  return { content }
}

function parseStreamErrorPayload(data: string): OpenRouterChatResponse | null {
  try {
    const payload = JSON.parse(data) as OpenRouterStreamChunk
    return payload.error ? { error: payload.error } : null
  } catch {
    return null
  }
}

async function parseOpenRouterStream(
  response: Response,
  callbacks: GenerateDocumentStreamCallbacks,
): Promise<string> {
  if (!response.body) throw new Error('OpenRouter did not return a readable stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let streamError: Error | null = null

  const handleEvent = async (eventText: string) => {
    const data = eventText
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
      .trim()

    if (!data || data === '[DONE]') return

    let payload: OpenRouterStreamChunk
    try {
      payload = JSON.parse(data) as OpenRouterStreamChunk
    } catch {
      return
    }

    if (payload.error) {
      streamError = new OpenRouterRequestError(
        describeOpenRouterError(response.status, { error: payload.error }),
        response.status,
        { error: payload.error },
      )
      return
    }

    const delta = readOpenRouterDelta(payload)
    if (!delta) return

    content += delta
    await callbacks.onDelta?.(delta, content)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const boundary = buffer.search(/\r?\n\r?\n/)
      if (boundary === -1) break

      const eventText = buffer.slice(0, boundary)
      buffer = buffer.slice(buffer[boundary] === '\r' ? boundary + 4 : boundary + 2)
      await handleEvent(eventText)
      if (streamError) throw streamError
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) await handleEvent(buffer)
  if (streamError) throw streamError

  return content.trim()
}

async function requestOpenRouterDocumentStream(
  request: NormalizedGenerateDocumentRequest,
  tokenMode: TokenMode,
  callbacks: GenerateDocumentStreamCallbacks,
): Promise<GenerateDocumentResponse> {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://complexte.local',
      'X-OpenRouter-Title': 'Complexte',
    },
    body: JSON.stringify(buildRequestBody(request, tokenMode, true)),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let payload: OpenRouterChatResponse = {}

    if (text) {
      const streamPayload = parseStreamErrorPayload(text)
      if (streamPayload) {
        payload = streamPayload
      } else {
        try {
          payload = JSON.parse(text) as OpenRouterChatResponse
        } catch {
          payload = {}
        }
      }
    }

    throw new OpenRouterRequestError(describeOpenRouterError(response.status, payload), response.status, payload)
  }

  const content = await parseOpenRouterStream(response, callbacks)
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

export async function generateOpenRouterDocumentStream(
  request: GenerateDocumentRequest,
  callbacks: GenerateDocumentStreamCallbacks = {},
): Promise<GenerateDocumentResponse> {
  const normalizedRequest = normalizeRequest(request)
  let receivedContent = false
  const trackingCallbacks: GenerateDocumentStreamCallbacks = {
    onDelta: async (delta, content) => {
      receivedContent = true
      await callbacks.onDelta?.(delta, content)
    },
  }

  try {
    return await requestOpenRouterDocumentStream(normalizedRequest, 'max_completion_tokens', trackingCallbacks)
  } catch (error) {
    if (
      receivedContent ||
      !(error instanceof OpenRouterRequestError) ||
      !error.shouldRetryWithCompatibilityRequest()
    ) {
      throw error
    }

    try {
      return await requestOpenRouterDocumentStream(normalizedRequest, 'max_tokens', trackingCallbacks)
    } catch (retryError) {
      if (retryError instanceof Error) {
        retryError.message = `${retryError.message} Retried with OpenRouter compatibility token parameter.`
      }
      throw retryError
    }
  }
}

export async function generateOpenRouterSelectionRevision(
  request: ReviseSelectionRequest,
): Promise<ReviseSelectionResponse> {
  const normalizedRequest = normalizeSelectionRequest(request)

  try {
    return await requestOpenRouterSelectionRevision(normalizedRequest, 'max_completion_tokens')
  } catch (error) {
    if (!(error instanceof OpenRouterRequestError) || !error.shouldRetryWithCompatibilityRequest()) {
      throw error
    }

    try {
      return await requestOpenRouterSelectionRevision(normalizedRequest, 'max_tokens')
    } catch (retryError) {
      if (retryError instanceof Error) {
        retryError.message = `${retryError.message} Retried with OpenRouter compatibility token parameter.`
      }
      throw retryError
    }
  }
}
