type GenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

type GenerateDocumentResponse = {
  content: string
}

type OpenRouterBridge = {
  generateDocument: (request: GenerateDocumentRequest) => Promise<GenerateDocumentResponse>
}

export async function generateDocument(request: GenerateDocumentRequest): Promise<string> {
  const bridge = (window as Window & { openRouter?: OpenRouterBridge }).openRouter
  if (!bridge) throw new Error('OpenRouter is not available in this window.')

  try {
    const response = await bridge.generateDocument(request)
    return response.content
  } catch (error) {
    if (!(error instanceof Error)) throw error

    throw new Error(
      error.message.replace(/^Error invoking remote method 'openrouter:generate-document': Error:\s*/, ''),
    )
  }
}
