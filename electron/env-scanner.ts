import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

const HOME = os.homedir()

const USER_FILES: Record<string, string[]> = {
  zsh: [
    path.join(HOME, '.zshenv'),
    path.join(HOME, '.profile'),
    path.join(HOME, '.zshrc'),
  ],
  bash: [
    path.join(HOME, '.profile'),
    path.join(HOME, '.bash_profile'),
    path.join(HOME, '.bashrc'),
  ],
}

const SYSTEM_FILES = ['/etc/environment', '/etc/profile']

function getProfileDFiles(): string[] {
  const dir = '/etc/profile.d'
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sh'))
    .sort()
    .map(f => path.join(dir, f))
}

export function detectShell(): ShellType {
  try {
    const shell = process.env.SHELL || ''
    if (shell.includes('zsh')) return 'zsh'
    if (shell.includes('bash')) return 'bash'
    // macOS fallback: dscl
    if (process.platform === 'darwin') {
      const user = os.userInfo().username
      const out = execSync(`dscl . -read /Users/${user} UserShell`).toString()
      if (out.includes('zsh')) return 'zsh'
      if (out.includes('bash')) return 'bash'
    }
  } catch { /* ignore */ }
  return 'unknown'
}

export function getEnvFiles(scope: 'user' | 'system', shell: ShellType): EnvFileInfo[] {
  if (scope === 'user') {
    const files = USER_FILES[shell] || USER_FILES['zsh']
    return files.map(p => ({ path: p, exists: fs.existsSync(p), scope }))
  }
  const systemFiles = [...SYSTEM_FILES, ...getProfileDFiles()]
  return systemFiles.map(p => ({ path: p, exists: fs.existsSync(p), scope }))
}

export function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}

/** 解析简单的 export KEY=VALUE 语句 */
export function parseExports(content: string, sourceFile: string, startOrder: number): EnvVar[] {
  const vars: EnvVar[] = []
  let order = startOrder
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // 匹配: export KEY=VALUE 或 export KEY="VALUE" 或 export KEY='VALUE'
    const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars.push({ key, value, sourceFile, order: order++ })
  }
  return vars
}

/** 扫描所有文件并聚合环境变量 */
export function scanEnvVars(scope: 'user' | 'system', shell: ShellType): { files: EnvFileInfo[], vars: EnvVar[] } {
  const files = getEnvFiles(scope, shell)
  const vars: EnvVar[] = []
  let order = 0
  for (const f of files) {
    if (!f.exists) continue
    const content = readFileContent(f.path)
    const parsed = parseExports(content, f.path, order)
    order += parsed.length
    vars.push(...parsed)
  }
  return { files, vars }
}
