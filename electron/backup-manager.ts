import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

const MAX_HISTORY = 10

export interface BackupRecord {
  id: string
  timestamp: number
  operationType: string   // 'env-save' | 'hosts-save'
  targetFile: string
  backupFile: string
}

interface BackupIndex {
  records: BackupRecord[]
}

function getBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getIndexPath(): string {
  return path.join(getBackupDir(), 'index.json')
}

function readIndex(): BackupIndex {
  const p = getIndexPath()
  if (!fs.existsSync(p)) return { records: [] }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function writeIndex(index: BackupIndex) {
  fs.writeFileSync(getIndexPath(), JSON.stringify(index, null, 2), 'utf-8')
}

/** 创建备份，返回备份记录 */
export function createBackup(targetFile: string, operationType: string): BackupRecord | null {
  if (!fs.existsSync(targetFile)) return null

  const dir = getBackupDir()
  const ts = Date.now()
  const safeName = targetFile.replace(/[/\\:]/g, '_')
  const backupFile = path.join(dir, `${ts}_${safeName}`)

  fs.copyFileSync(targetFile, backupFile)

  const record: BackupRecord = {
    id: `${ts}`,
    timestamp: ts,
    operationType,
    targetFile,
    backupFile,
  }

  const index = readIndex()
  index.records.push(record)

  // 超出上限，删除最旧的
  while (index.records.length > MAX_HISTORY) {
    const oldest = index.records.shift()!
    if (fs.existsSync(oldest.backupFile)) fs.unlinkSync(oldest.backupFile)
  }

  writeIndex(index)
  return record
}

/** 获取所有备份记录 */
export function getBackupRecords(): BackupRecord[] {
  return readIndex().records.sort((a, b) => b.timestamp - a.timestamp)
}

/** 回滚：将备份文件恢复到原路径 */
export function rollbackBackup(id: string): { success: boolean; error?: string } {
  const index = readIndex()
  const record = index.records.find(r => r.id === id)
  if (!record) return { success: false, error: '备份记录不存在' }
  if (!fs.existsSync(record.backupFile)) return { success: false, error: '备份文件已丢失' }
  return { success: true, backupFile: record.backupFile, targetFile: record.targetFile } as { success: boolean; error?: string; backupFile?: string; targetFile?: string }
}

/** 读取备份文件内容 */
export function readBackupContent(id: string): string | null {
  const index = readIndex()
  const record = index.records.find(r => r.id === id)
  if (!record || !fs.existsSync(record.backupFile)) return null
  return fs.readFileSync(record.backupFile, 'utf-8')
}
