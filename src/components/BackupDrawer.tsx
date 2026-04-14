import { useState, useEffect } from 'react'
import { Drawer, Button, Tag, Typography, Popconfirm, message, Empty, Space, Card } from 'antd'
import { HistoryOutlined, RollbackOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'

const { Text } = Typography
const api = window.electronAPI

interface BackupRecord {
  id: string
  timestamp: number
  operationType: string
  targetFile: string
  backupFile: string
}

interface Props {
  open: boolean
  onClose: () => void
  onRollbackDone?: () => void
}

export default function BackupDrawer({ open, onClose, onRollbackDone }: Props) {
  const [records, setRecords] = useState<BackupRecord[]>([])
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string>('')

  useEffect(() => {
    if (open) { loadRecords(); setPreviewId(''); setPreviewContent(null) }
  }, [open])

  const loadRecords = async () => {
    const data = await api.invoke('get-backup-records') as BackupRecord[]
    setRecords(data)
  }

  const onPreview = async (id: string) => {
    if (previewId === id) { setPreviewContent(null); setPreviewId(''); return }
    const content = await api.invoke('read-backup-content', id) as string | null
    setPreviewContent(content)
    setPreviewId(id)
  }

  const handleRollback = async (id: string) => {
    const result = await api.invoke('rollback-backup', id) as { success: boolean; error?: string }
    if (result.success) {
      message.success('回滚成功，请重新打开终端以使变更生效')
      loadRecords()
      onRollbackDone?.()
    } else {
      message.error(result.error || '回滚失败')
    }
  }

  const typeLabel = (t: string) => {
    if (t === 'env-save') return <Tag color="blue">环境变量</Tag>
    if (t === 'hosts-save') return <Tag color="green">Hosts</Tag>
    if (t === 'rollback-pre') return <Tag color="orange">回滚前备份</Tag>
    return <Tag>{t}</Tag>
  }

  return (
    <Drawer title={<><HistoryOutlined /> 版本历史（最近 10 条）</>} open={open} onClose={onClose} width={560}>
      {records.length === 0 ? (
        <Empty description="暂无备份记录" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map(r => (
            <Card key={r.id} size="small" styles={{ body: { padding: '8px 12px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Space>
                  {typeLabel(r.operationType)}
                  <Text style={{ fontSize: 12 }}>{new Date(r.timestamp).toLocaleString('zh-CN')}</Text>
                </Space>
                <Space size={4}>
                  <Button
                    size="small"
                    icon={previewId === r.id ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => onPreview(r.id)}
                  >
                    {previewId === r.id ? '收起' : '预览'}
                  </Button>
                  <Popconfirm title="确定回滚到此版本？当前文件将被覆盖。" onConfirm={() => handleRollback(r.id)} okText="回滚" cancelText="取消">
                    <Button size="small" danger icon={<RollbackOutlined />}>回滚</Button>
                  </Popconfirm>
                </Space>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>{r.targetFile}</Text>
              {previewId === r.id && previewContent !== null && (
                <pre style={{
                  marginTop: 8, padding: 8, background: '#fafafa',
                  border: '1px solid #f0f0f0', borderRadius: 4, fontSize: 11,
                  maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
                }}>
                  {previewContent}
                </pre>
              )}
            </Card>
          ))}
        </div>
      )}
    </Drawer>
  )
}
