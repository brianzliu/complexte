import { contextBridge, ipcRenderer } from 'electron'
import {
  generateOpenRouterDocument,
  type GenerateDocumentRequest,
  type GenerateDocumentResponse,
} from '../shared/openRouterDocument'

function isMissingOpenRouterHandler(error: unknown): boolean {
  return error instanceof Error && /No handler registered for 'openrouter:generate-document'/.test(error.message)
}

async function generateDocument(request: GenerateDocumentRequest): Promise<GenerateDocumentResponse> {
  try {
    return await ipcRenderer.invoke('openrouter:generate-document', request)
  } catch (error) {
    if (!isMissingOpenRouterHandler(error)) throw error
    return generateOpenRouterDocument(request)
  }
}

contextBridge.exposeInMainWorld('platform', process.platform)

contextBridge.exposeInMainWorld('openRouter', {
  generateDocument,
})
