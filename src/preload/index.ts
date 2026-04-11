import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('platform', process.platform)
