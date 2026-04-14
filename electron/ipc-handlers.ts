import { ipcMain } from 'electron'
import { detectShell, scanEnvVars, readFileContent, getEnvFiles } from './env-scanner'
import { readHosts, serializeHosts, getHostsPath, type HostEntry } from './hosts-parser'
import { createBackup, getBackupRecords, rollbackBackup, readBackupContent } from './backup-manager'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

function sudoWrite(tmpPath: string, targetPath: string) {
  const script = `do shell script "cp '${tmpPath}' '${targetPath}'" with administrator privileges`
  execSync(`osascript`, {
    input: script,
    timeout: 30000,
  })
}

function handleError(err: unknown): { success: false; error: string } {
  const msg = err instanceof Error ? err.message : '未知错误'
  if (msg.includes('User canceled') || msg.includes('(-128)') || msg.includes('The operation was canceled')) {
    return { success: false, error: '用户取消了权限授权' }
  }
  if (msg.includes('EPERM') || msg.includes('access is denied')) {
    return { success: false, error: '权限不足，请以管理员身份运行' }
  }
  return { success: false, error: msg }
}

export function registerIpcHandlers() {
  ipcMain.handle('detect-shell', () => detectShell())

  ipcMain.handle('get-env-files', (_e, scope: 'user' | 'system') => {
    const shell = detectShell()
    return getEnvFiles(scope, shell)
  })

  ipcMain.handle('scan-env-vars', (_e, scope: 'user' | 'system') => {
    const shell = detectShell()
    return scanEnvVars(scope, shell)
  })

  ipcMain.handle('read-file', (_e, filePath: string) => readFileContent(filePath))

  ipcMain.handle('save-file', async (_e, filePath: string, content: string, needSudo: boolean) => {
    try {
      // 保存前备份
      createBackup(filePath, 'env-save')

      if (needSudo) {
        const tmpPath = path.join(os.tmpdir(), `envbox-save-${Date.now()}.tmp`)
        fs.writeFileSync(tmpPath, content, 'utf-8')
        try { sudoWrite(tmpPath, filePath) } finally {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
        }
      } else {
        fs.writeFileSync(filePath, content, 'utf-8')
      }

      // source 验证（仅 macOS/Linux）
      if (process.platform !== 'win32') {
        const shell = detectShell()
        const shellBin = shell === 'bash' ? 'bash' : 'zsh'
        try {
          execSync(`${shellBin} -n "${filePath}"`, { timeout: 5000, stdio: 'pipe' })
        } catch (err: unknown) {
          const msg = err instanceof Error ? (err as Error & { stderr?: Buffer }).stderr?.toString() || err.message : '未知错误'
          return { success: false, error: `语法检查失败：${msg}` }
        }
      }
      return { success: true }
    } catch (err: unknown) {
      return handleError(err)
    }
  })

  ipcMain.handle('read-hosts', () => readHosts())

  ipcMain.handle('save-hosts', async (_e, entries: HostEntry[]) => {
    try {
      const hostsPath = getHostsPath()
      createBackup(hostsPath, 'hosts-save')

      const content = serializeHosts(entries)
      const tmpPath = path.join(os.tmpdir(), `envbox-hosts-${Date.now()}.tmp`)
      fs.writeFileSync(tmpPath, content, 'utf-8')
      try {
        if (process.platform === 'win32') {
          // Windows: 使用 PowerShell UAC 提权复制
          execSync(`powershell -Command "Start-Process powershell -ArgumentList '-Command','Copy-Item -Path \\\"${tmpPath.replace(/\\/g, '\\\\')}\\\" -Destination \\\"${hostsPath.replace(/\\/g, '\\\\')}\\\" -Force' -Verb RunAs -Wait"`, { timeout: 30000 })
        } else {
          sudoWrite(tmpPath, hostsPath)
        }
        return { success: true }
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
      }
    } catch (err: unknown) {
      return handleError(err)
    }
  })

  // 备份相关
  ipcMain.handle('get-backup-records', () => getBackupRecords())

  ipcMain.handle('read-backup-content', (_e, id: string) => readBackupContent(id))

  ipcMain.handle('rollback-backup', async (_e, id: string) => {
    try {
      const result = rollbackBackup(id) as { success: boolean; error?: string; backupFile?: string; targetFile?: string }
      if (!result.success) return result

      const targetFile = result.targetFile!
      const backupContent = fs.readFileSync(result.backupFile!, 'utf-8')

      // 回滚前先备份当前文件
      createBackup(targetFile, 'rollback-pre')

      // 判断是否需要 sudo
      const needSudo = targetFile.startsWith('/etc/')
      if (needSudo) {
        const tmpPath = path.join(os.tmpdir(), `envbox-rollback-${Date.now()}.tmp`)
        fs.writeFileSync(tmpPath, backupContent, 'utf-8')
        try { sudoWrite(tmpPath, targetFile) } finally {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
        }
      } else {
        fs.writeFileSync(targetFile, backupContent, 'utf-8')
      }
      return { success: true }
    } catch (err: unknown) {
      return handleError(err)
    }
  })
}
