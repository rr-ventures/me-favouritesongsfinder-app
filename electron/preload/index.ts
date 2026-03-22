import { ipcRenderer, contextBridge } from 'electron'

// Expose a typed electron IPC API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  ipc: {
    send(channel: string, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args)
    },
    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
      return ipcRenderer.invoke(channel, ...args)
    },
    on(channel: string, listener: (...args: unknown[]) => void) {
      const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        listener(...args)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.off(channel, handler)
    },
    off(channel: string, listener: (...args: unknown[]) => void) {
      ipcRenderer.removeAllListeners(channel)
    },
  },
})
