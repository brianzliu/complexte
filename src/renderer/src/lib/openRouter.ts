type GenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

type GenerateDocumentResponse = {
  content: string
}

type StreamDocumentCallbacks = {
  onDelta?: (delta: string, content: string) => void
}

type OpenRouterBridge = {
  generateDocument: (request: GenerateDocumentRequest) => Promise<GenerateDocumentResponse>
  streamDocument?: (
    request: GenerateDocumentRequest,
    callbacks?: StreamDocumentCallbacks,
  ) => Promise<GenerateDocumentResponse>
}

function normalizeOpenRouterError(error: unknown): Error {
  if (!(error instanceof Error)) throw error

  return new Error(
    error.message.replace(/^Error invoking remote method 'openrouter:generate-document': Error:\s*/, ''),
  )
}

export async function generateDocument(request: GenerateDocumentRequest): Promise<string> {
  const bridge = (window as Window & { openRouter?: OpenRouterBridge }).openRouter
  if (!bridge) throw new Error('OpenRouter is not available in this window.')

  try {
    const response = await bridge.generateDocument(request)
    return response.content
  } catch (error) {
    throw normalizeOpenRouterError(error)
  }
}

export async function streamDocument(
  request: GenerateDocumentRequest,
  callbacks: StreamDocumentCallbacks = {},
): Promise<string> {
  const bridge = (window as Window & { openRouter?: OpenRouterBridge }).openRouter
  if (!bridge) throw new Error('OpenRouter is not available in this window.')

  try {
    const response = bridge.streamDocument
      ? await bridge.streamDocument(request, callbacks)
      : await bridge.generateDocument(request)
    return response.content
  } catch (error) {
    throw normalizeOpenRouterError(error)
  }
}
