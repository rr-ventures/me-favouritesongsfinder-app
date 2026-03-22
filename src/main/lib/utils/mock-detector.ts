// Checks electron-store to determine if a given API key is empty or a placeholder,
// meaning mock mode should be used for that integration.
// This module is imported lazily to avoid ESM import issues with electron-store.

import type ElectronStore from 'electron-store'

type Settings = Record<string, unknown>

let store: InstanceType<typeof ElectronStore<Settings>> | null = null

async function getStore(): Promise<InstanceType<typeof ElectronStore<Settings>>> {
  if (!store) {
    const StoreModule = await import('electron-store')
    const Store = StoreModule.default as typeof ElectronStore
    store = new Store<Settings>({ name: 'mixingsongfinder-settings' }) as InstanceType<typeof ElectronStore<Settings>>
  }
  return store
}

export async function isMockMode(keyName: string): Promise<boolean> {
  try {
    const s = await getStore()
    const value = (s as unknown as { get(k: string, d: unknown): unknown }).get(`apiKeys.${keyName}`, '') as string
    return !value || value.trim() === '' || value.trim().toUpperCase() === 'PLACEHOLDER'
  } catch {
    return true
  }
}

export async function getApiKey(keyName: string): Promise<string> {
  try {
    const s = await getStore()
    return ((s as unknown as { get(k: string, d: unknown): unknown }).get(`apiKeys.${keyName}`, '') as string) ?? ''
  } catch {
    return ''
  }
}
