import { useState, useEffect, useCallback } from 'react'
import { Table, List, Typography, Splitter, Tag, Empty, Spin, Badge, Tooltip, Button, message } from 'antd'
import { FileTextOutlined, FolderOpenOutlined, SaveOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import type { EnvVar, EnvFileInfo, ScanResult, ShellType } from '../types/electron'

const { Text } = Typography
const api = window.electronAPI

export default function UserEnvTab() {
  const [shell, setShell] = useState<ShellType>('unknown')
  const [files, setFiles] = useState<EnvFileInfo[]>([])
  const [vars, setVars] = useState<EnvVar[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [fileContent, setFileContent] = useState<string>('')
  const [editorContent, setEditorContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const detectedShell = await api.invoke('detect-shell') as ShellType
    setShell(detectedShell)
    const result = await api.invoke('scan-env-vars', 'user') as ScanResult
    setFiles(result.files)
    setVars(result.vars)
    if (result.files.length > 0) {
      const first = result.files.find(f => f.exists) || result.files[0]
      setSelectedFile(first.path)
      const content = await api.invoke('read-file', first.path) as string
      setFileContent(content)
      setEditorContent(content)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const onSelectFile = async (filePath: string) => {
    setSelectedFile(filePath)
    const content = await api.invoke('read-file', filePath) as string
    setFileContent(content)
    setEditorContent(content)
    setDirty(false)
  }

  const onEditorChange = (value: string | undefined) => {
    const v = value ?? ''
    setEditorContent(v)
    setDirty(v !== fileContent)
  }

  const onSave = async () => {
    if (!selectedFile || !dirty) return
    setSaving(true)
    const result = await api.invoke('save-file', selectedFile, editorContent, false) as { success: boolean; error?: string }
    setSaving(false)
    if (result.success) {
      message.success('已保存，请重新打开终端以使变量生效')
      setFileContent(editorContent)
      setDirty(false)
      // 刷新聚合视图
      const scanResult = await api.invoke('scan-env-vars', 'user') as ScanResult
      setVars(scanResult.vars)
    } else {
      message.error(result.error || '保存失败')
    }
  }

  const envColumns = [
    { title: '变量名', dataIndex: 'key', width: 200, ellipsis: true },
    {
      title: '值', dataIndex: 'value', ellipsis: true,
      render: (val: string, record: EnvVar) => {
        if (['PATH', 'MANPATH', 'FPATH'].includes(record.key)) {
          const parts = val.split(':').filter(Boolean)
          return (
            <div style={{ maxHeight: 120, overflow: 'auto' }}>
              {parts.map((p, i) => <div key={i}><Text code style={{ fontSize: 12 }}>{p}</Text></div>)}
            </div>
          )
        }
        return <Text code style={{ fontSize: 12 }}>{val}</Text>
      }
    },
    {
      title: '来源文件', dataIndex: 'sourceFile', width: 200,
      render: (v: string) => <Tooltip title={v}><Tag>{v.split('/').pop()}</Tag></Tooltip>
    },
    { title: '顺序', dataIndex: 'order', width: 60, align: 'center' as const },
  ]

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ marginBottom: 8 }}>
        <Tag color="blue">当前 Shell: {shell}</Tag>
      </div>

      <div style={{ flex: '0 0 auto', maxHeight: '40%', overflow: 'auto', marginBottom: 8 }}>
        <Table
          columns={envColumns}
          dataSource={vars}
          rowKey={(r) => `${r.sourceFile}-${r.key}-${r.order}`}
          size="small"
          pagination={false}
          scroll={{ y: 200 }}
          locale={{ emptyText: <Empty description="未检测到环境变量" /> }}
        />
      </div>

      <Splitter style={{ flex: 1, minHeight: 0 }}>
        <Splitter.Panel defaultSize="25%" min="15%" max="40%">
          <div style={{ height: '100%', overflow: 'auto', borderRight: '1px solid #f0f0f0' }}>
            <div style={{ padding: '4px 8px', fontWeight: 500, borderBottom: '1px solid #f0f0f0' }}>
              <FolderOpenOutlined /> 配置文件
            </div>
            <List
              size="small"
              dataSource={files}
              renderItem={(f) => (
                <List.Item
                  onClick={() => f.exists && onSelectFile(f.path)}
                  style={{
                    cursor: f.exists ? 'pointer' : 'not-allowed',
                    padding: '6px 12px',
                    background: selectedFile === f.path ? '#e6f4ff' : undefined,
                    opacity: f.exists ? 1 : 0.4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <FileTextOutlined />
                    <Text ellipsis style={{ flex: 1, fontSize: 13 }}>{f.path.replace(/^\/Users\/[^/]+/, '~')}</Text>
                    {!f.exists && <Badge count="不存在" style={{ fontSize: 10 }} />}
                  </div>
                </List.Item>
              )}
            />
          </div>
        </Splitter.Panel>
        <Splitter.Panel>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '4px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{selectedFile} {dirty && <Tag color="orange">未保存</Tag>}</Text>
              <Button type="primary" size="small" icon={<SaveOutlined />} onClick={onSave} loading={saving} disabled={!dirty}>
                保存
              </Button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Editor
                value={editorContent}
                onChange={onEditorChange}
                language="shell"
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    </div>
  )
}
