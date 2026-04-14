import { useState, useEffect, useCallback } from 'react'
import { Table, Switch, Input, Button, Space, message, Popconfirm, Tag, Typography, Spin } from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, LockOutlined } from '@ant-design/icons'

const { Text } = Typography
const api = window.electronAPI

interface HostEntry {
  id: number
  enabled: boolean
  ip: string
  domain: string
  comment: string
  isComment: boolean
  raw: string
}

export default function HostsTab() {
  const [entries, setEntries] = useState<HostEntry[]>([])
  const [hostsPath, setHostsPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await api.invoke('read-hosts') as { path: string; entries: HostEntry[] }
    setEntries(result.entries)
    setHostsPath(result.path)
    setDirty(false)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const updateEntry = (id: number, field: keyof HostEntry, value: unknown) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
    setDirty(true)
  }

  const addEntry = () => {
    const newId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 0
    setEntries(prev => [...prev, { id: newId, enabled: true, ip: '127.0.0.1', domain: 'example.local', comment: '', isComment: false, raw: '' }])
    setDirty(true)
  }

  const deleteEntry = (id: number) => {
    setEntries(prev => prev.filter(e => e.id !== id))
    setDirty(true)
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const result = await api.invoke('save-hosts', entries) as { success: boolean; error?: string }
      if (result.success) {
        message.success('Hosts 文件已保存')
        setDirty(false)
      } else {
        message.error(result.error || '保存失败')
      }
    } catch (err) {
      message.error(`保存异常：${err}`)
    } finally {
      setSaving(false)
    }
  }

  // 过滤：只过滤非注释的 host 条目，纯注释行始终显示
  const filtered = entries.filter(e => {
    if (!search) return true
    if (e.isComment) return true
    const s = search.toLowerCase()
    return e.ip.toLowerCase().includes(s) || e.domain.toLowerCase().includes(s) || e.comment.toLowerCase().includes(s)
  })

  const columns = [
    {
      title: '启用', width: 60, align: 'center' as const,
      render: (_: unknown, record: HostEntry) => {
        if (record.isComment) return null
        return <Switch size="small" checked={record.enabled} onChange={v => updateEntry(record.id, 'enabled', v)} />
      }
    },
    {
      title: 'IP 地址', width: 180,
      render: (_: unknown, record: HostEntry) => {
        if (record.isComment) return <Text type="secondary" italic>#{record.comment}</Text>
        return (
          <Input
            size="small" value={record.ip} style={{ opacity: record.enabled ? 1 : 0.5 }}
            onChange={e => updateEntry(record.id, 'ip', e.target.value)}
          />
        )
      }
    },
    {
      title: '域名', width: 280,
      render: (_: unknown, record: HostEntry) => {
        if (record.isComment) return null
        return (
          <Input
            size="small" value={record.domain} style={{ opacity: record.enabled ? 1 : 0.5 }}
            onChange={e => updateEntry(record.id, 'domain', e.target.value)}
          />
        )
      }
    },
    {
      title: '注释',
      render: (_: unknown, record: HostEntry) => {
        if (record.isComment) return null
        return (
          <Input
            size="small" value={record.comment} placeholder="可选注释"
            onChange={e => updateEntry(record.id, 'comment', e.target.value)}
          />
        )
      }
    },
    {
      title: '操作', width: 60, align: 'center' as const,
      render: (_: unknown, record: HostEntry) => (
        <Popconfirm title="确定删除？" onConfirm={() => deleteEntry(record.id)} okText="删除" cancelText="取消">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    },
  ]

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text type="secondary"><LockOutlined /> {hostsPath}</Text>
          {dirty && <Tag color="orange">未保存</Tag>}
        </Space>
        <Space>
          <Input
            prefix={<SearchOutlined />} placeholder="搜索 IP / 域名 / 注释" allowClear
            value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }}
          />
          <Button icon={<PlusOutlined />} onClick={addEntry}>新增</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving} disabled={!dirty}>
            保存（需授权）
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 'calc(100vh - 180px)' }}
        />
      </div>
    </div>
  )
}
