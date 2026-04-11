import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'

type GenerateDocumentRequest = {
  apiKey: string
  model: string
  prompt: string
}

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
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

ipcMain.handle('openrouter:generate-document', async (_event, request: GenerateDocumentRequest) => {
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
})

const appIconPath = process.env['ELECTRON_RENDERER_URL']
  ? join(__dirname, '../../src/renderer/public/favicon.svg')
  : join(__dirname, '../renderer/favicon.svg')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    icon: appIconPath,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0d0d0d',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
