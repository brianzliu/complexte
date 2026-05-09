import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron'
import { join } from 'path'
import {
  generateOpenRouterDocument,
  generateOpenRouterSelectionRevision,
  type GenerateDocumentRequest,
  type ReviseSelectionRequest,
} from '../shared/openRouterDocument'
import type { PersistedDocumentSnapshot } from '../shared/documentSnapshot'
import { loadDocumentSnapshot, saveDocumentSnapshot } from './documentDatabase'

ipcMain.handle('openrouter:generate-document', async (_event, request: GenerateDocumentRequest) =>
  generateOpenRouterDocument(request),
)
ipcMain.handle('openrouter:revise-selection', async (_event, request: ReviseSelectionRequest) =>
  generateOpenRouterSelectionRevision(request),
)
ipcMain.handle('documents:load-snapshot', async () => loadDocumentSnapshot())
ipcMain.handle('documents:save-snapshot', async (_event, snapshot: PersistedDocumentSnapshot) =>
  saveDocumentSnapshot(snapshot),
)

const appIconPath = process.env['ELECTRON_RENDERER_URL']
  ? join(__dirname, '../../src/renderer/public/favicon.png')
  : join(__dirname, '../renderer/favicon.png')

function loadAppIcon(): Electron.NativeImage | undefined {
  const icon = nativeImage.createFromPath(appIconPath)
  return icon.isEmpty() ? undefined : icon
}

function applyAppIcon(icon: Electron.NativeImage | undefined): void {
  if (process.platform === 'darwin' && icon) {
    app.dock.setIcon(icon)
  }
}

function createWindow(): void {
  const appIcon = loadAppIcon()
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    icon: appIcon,
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

  win.webContents.on('before-input-event', (event, input) => {
    if ((input.meta || input.control) && input.key.toLowerCase() === 'w') {
      event.preventDefault()
      win.webContents.send('tabs:close-active')
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  applyAppIcon(loadAppIcon())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
