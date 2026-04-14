export type ShellType = 'zsh' | 'bash' | 'unknown'

export interface EnvVar {
  key: string
  value: string
  sourceFile: string
  order: number
}

export interface EnvFileInfo {
  path: string
  exists: boolean
  scope: 'user' | 'system'
}

export interface ScanResult {
  files: EnvFileInfo[]
  vars: EnvVar[]
}

export interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
