import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('platform', process.platform)

contextBridge.exposeInMainWorld('openRouter', {
  generateDocument: (request: { apiKey: string; model: string; prompt: string }) =>
    ipcRenderer.invoke('openrouter:generate-document', request),
})
