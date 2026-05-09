import { contextBridge, ipcRenderer } from 'electron'
import {
  generateOpenRouterDocument,
  generateOpenRouterDocumentStream,
  type GenerateDocumentRequest,
  type GenerateDocumentResponse,
  type GenerateDocumentStreamCallbacks,
} from '../shared/openRouterDocument'
import type { PersistedDocumentSnapshot } from '../shared/documentSnapshot'

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
  streamDocument: (request: GenerateDocumentRequest, callbacks?: GenerateDocumentStreamCallbacks) =>
    generateOpenRouterDocumentStream(request, callbacks),
})

contextBridge.exposeInMainWorld('documentPersistence', {
  loadSnapshot: () => ipcRenderer.invoke('documents:load-snapshot') as Promise<PersistedDocumentSnapshot | null>,
  saveSnapshot: (snapshot: PersistedDocumentSnapshot) => ipcRenderer.invoke('documents:save-snapshot', snapshot),
})

contextBridge.exposeInMainWorld('appShortcuts', {
  onCloseActiveTab: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('tabs:close-active', listener)
    return () => ipcRenderer.removeListener('tabs:close-active', listener)
  },
})
