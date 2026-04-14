import { useState, useEffect, useCallback } from 'react'
import { Table, Input, Button, Space, message, Popconfirm, Tag, Spin, Modal, Form, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, LockOutlined } from '@ant-design/icons'
import type { EnvVar, ScanResult } from '../types/electron'

const api = window.electronAPI

interface Props {
  scope: 'user' | 'system'
}

export default function WinEnvTab({ scope }: Props) {
  const [vars, setVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVar, setEditingVar] = useState<EnvVar | null>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await api.invoke('scan-env-vars', scope) as ScanResult
    setVars(result.vars)
    setLoading(false)
  }, [scope])

  useEffect(() => { loadData() }, [loadData])

  const openAdd = () => {
    setEditingVar(null)
    form.setFieldsValue({ key: '', value: '' })
    setModalOpen(true)
  }

  const openEdit = (record: EnvVar) => {
    setEditingVar(record)
    form.setFieldsValue({ key: record.key, value: record.value })
    setModalOpen(true)
  }

  const onSave = async () => {
    const { key, value } = form.getFieldsValue()
    if (!key?.trim()) { message.error('变量名不能为空'); return }
    setSaving(true)
    const result = await api.invoke('win-reg-set', scope, key.trim(), value ?? '') as { success: boolean; error?: string }
    setSaving(false)
    if (result.success) {
      message.success('已保存')
      setModalOpen(false)
      loadData()
    } else {
      message.error(result.error || '保存失败')
    }
  }

  const onDelete = async (key: string) => {
    const result = await api.invoke('win-reg-delete', scope, key) as { success: boolean; error?: string }
    if (result.success) {
      message.success('已删除')
      loadData()
    } else {
      message.error(result.error || '删除失败')
    }
  }

  const columns = [
    { title: '变量名', dataIndex: 'key', width: 220, ellipsis: true },
    {
      title: '值', dataIndex: 'value', ellipsis: true,
      render: (val: string, record: EnvVar) => {
        if (record.key.toUpperCase() === 'PATH') {
          const parts = val.split(';').filter(Boolean)
          return (
            <div style={{ maxHeight: 120, overflow: 'auto' }}>
              {parts.map((p, i) => <div key={i}><code style={{ fontSize: 12 }}>{p}</code></div>)}
            </div>
          )
        }
        return <code style={{ fontSize: 12 }}>{val}</code>
      }
    },
    {
      title: '操作', width: 100, align: 'center' as const,
      render: (_: unknown, record: EnvVar) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title={`确定删除 ${record.key}？`} onConfirm={() => onDelete(record.key)} okText="删除" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ]

  if (loading) return <Spin style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Tag color="blue">Windows 注册表</Tag>
          {scope === 'system' && <Alert message="系统变量编辑需要管理员权限" type="warning" showIcon banner style={{ padding: '2px 12px' }} />}
        </Space>
        <Button icon={<PlusOutlined />} onClick={openAdd}>新增变量</Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={vars}
          rowKey={(r) => r.key}
          size="small"
          pagination={false}
        />
      </div>

      <Modal
        title={editingVar ? '编辑环境变量' : '新增环境变量'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onSave}
        confirmLoading={saving}
        okText={scope === 'system' ? '保存（需授权）' : '保存'}
        okButtonProps={{ icon: scope === 'system' ? <LockOutlined /> : <SaveOutlined /> }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="变量名" name="key" rules={[{ required: true, message: '请输入变量名' }]}>
            <Input disabled={!!editingVar} placeholder="例如：JAVA_HOME" />
          </Form.Item>
          <Form.Item label="值" name="value">
            <Input.TextArea rows={4} placeholder="例如：C:\Program Files\Java\jdk-17" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
