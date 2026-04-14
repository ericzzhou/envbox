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
  if (process.platform === 'win32') return scanEnvVarsWindows(scope)
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

/** Windows: 从注册表读取环境变量 */
function scanEnvVarsWindows(scope: 'user' | 'system'): { files: EnvFileInfo[], vars: EnvVar[] } {
  const regPath = scope === 'user'
    ? 'HKCU\\Environment'
    : 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
  const source = scope === 'user' ? '用户注册表' : '系统注册表'
  const files: EnvFileInfo[] = [{ path: regPath, exists: true, scope }]
  const vars: EnvVar[] = []
  try {
    const output = execSync(`reg query "${regPath}"`, { encoding: 'utf-8', timeout: 5000 })
    let order = 0
    for (const line of output.split('\n')) {
      const match = line.trim().match(/^(\S+)\s+REG_(?:SZ|EXPAND_SZ)\s+(.*)$/)
      if (!match) continue
      vars.push({ key: match[1], value: match[2], sourceFile: source, order: order++ })
    }
  } catch { /* 注册表读取失败 */ }
  return { files, vars }
}

/** Windows: 读取单个注册表环境变量值 */
export function readRegEnvValue(scope: 'user' | 'system', key: string): string {
  const regPath = scope === 'user'
    ? 'HKCU\\Environment'
    : 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
  try {
    const output = execSync(`reg query "${regPath}" /v "${key}"`, { encoding: 'utf-8', timeout: 5000 })
    const match = output.match(/REG_(?:SZ|EXPAND_SZ)\s+(.*)/)
    return match ? match[1].trim() : ''
  } catch { return '' }
}

/** Windows: 写入注册表环境变量并广播变更 */
export function writeRegEnvValue(scope: 'user' | 'system', key: string, value: string): void {
  const regPath = scope === 'user'
    ? 'HKCU\\Environment'
    : 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
  const type = value.includes('%') ? 'REG_EXPAND_SZ' : 'REG_SZ'
  if (scope === 'system') {
    // 系统级需要 UAC 提权
    const cmd = `reg add "${regPath}" /v "${key}" /t ${type} /d "${value}" /f`
    execSync(`powershell -Command "Start-Process cmd -ArgumentList '/c','${cmd.replace(/'/g, "''")}' -Verb RunAs -Wait"`, { timeout: 30000 })
  } else {
    execSync(`reg add "${regPath}" /v "${key}" /t ${type} /d "${value}" /f`, { encoding: 'utf-8', timeout: 5000 })
  }
  // 广播 WM_SETTINGCHANGE
  execSync(`powershell -Command "[System.Environment]::SetEnvironmentVariable('__envbox_refresh','','User')"`, { timeout: 5000 }).toString()
}
