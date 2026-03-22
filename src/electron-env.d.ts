/// <reference types="vite/client" />

interface Window {
  electron: {
    ipc: {
      send(channel: string, ...args: unknown[]): void
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      on(channel: string, listener: (...args: unknown[]) => void): () => void
      off(channel: string, listener: (...args: unknown[]) => void): void
    }
  }
}
