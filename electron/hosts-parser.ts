import * as fs from 'fs'

export interface HostEntry {
  id: number
  enabled: boolean
  ip: string
  domain: string
  comment: string
  isComment: boolean   // 纯注释行
  raw: string          // 原始行内容
}

const HOSTS_PATH = process.platform === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts'

export function getHostsPath(): string {
  return HOSTS_PATH
}

export function parseHosts(content: string): HostEntry[] {
  return content.split('\n').map((line, i) => {
    const raw = line
    const trimmed = line.trim()

    // 空行
    if (!trimmed) return { id: i, enabled: true, ip: '', domain: '', comment: '', isComment: false, raw }

    // 纯注释行（不是被禁用的 host 条目）
    if (trimmed.startsWith('#')) {
      // 尝试判断是否是被注释掉的 host 条目: # ip domain
      const uncommented = trimmed.replace(/^#+\s*/, '')
      const match = uncommented.match(/^(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]+)\s+(\S+)(.*)$/)
      if (match) {
        const inlineComment = match[3].replace(/^\s*#\s*/, '').trim()
        return { id: i, enabled: false, ip: match[1], domain: match[2], comment: inlineComment, isComment: false, raw }
      }
      return { id: i, enabled: true, ip: '', domain: '', comment: trimmed.replace(/^#+\s*/, ''), isComment: true, raw }
    }

    // 正常条目: ip domain [# comment]
    const match = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]+)\s+(\S+)(.*)$/)
    if (match) {
      const inlineComment = match[3].replace(/^\s*#\s*/, '').trim()
      return { id: i, enabled: true, ip: match[1], domain: match[2], comment: inlineComment, isComment: false, raw }
    }

    // 无法解析的行，当作注释
    return { id: i, enabled: true, ip: '', domain: '', comment: trimmed, isComment: true, raw }
  })
}

export function serializeHosts(entries: HostEntry[]): string {
  return entries.map(e => {
    if (e.isComment) {
      if (!e.comment && !e.ip && !e.domain) return ''  // 空行
      return `# ${e.comment}`
    }
    const commentPart = e.comment ? ` # ${e.comment}` : ''
    const line = `${e.ip}\t${e.domain}${commentPart}`
    return e.enabled ? line : `# ${line}`
  }).join('\n')
}

export function readHosts(): { path: string; content: string; entries: HostEntry[] } {
  const content = fs.existsSync(HOSTS_PATH) ? fs.readFileSync(HOSTS_PATH, 'utf-8') : ''
  return { path: HOSTS_PATH, content, entries: parseHosts(content) }
}
