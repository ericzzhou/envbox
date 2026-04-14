import { useState, useCallback } from 'react'
import { ConfigProvider, Tabs, Button, Space, theme } from 'antd'
import { LaptopOutlined, GlobalOutlined, CloudServerOutlined, HistoryOutlined, GithubOutlined } from '@ant-design/icons'
import UserEnvTab from './components/UserEnvTab'
import SystemEnvTab from './components/SystemEnvTab'
import HostsTab from './components/HostsTab'
import BackupDrawer from './components/BackupDrawer'

export default function App() {
  const [backupOpen, setBackupOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRollbackDone = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const tabItems = [
    { key: 'user-env', label: '用户环境变量', icon: <LaptopOutlined />, children: <UserEnvTab key={`user-${refreshKey}`} /> },
    { key: 'system-env', label: '系统环境变量', icon: <CloudServerOutlined />, children: <SystemEnvTab key={`sys-${refreshKey}`} /> },
    { key: 'hosts', label: 'Hosts', icon: <GlobalOutlined />, children: <HostsTab key={`hosts-${refreshKey}`} /> },
  ]

  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Tabs
          items={tabItems}
          style={{ flex: 1, padding: '8px 16px 0' }}
          tabBarStyle={{ marginBottom: 0 }}
          tabBarExtraContent={
            <Space>
              <Button icon={<GithubOutlined />} type="text" href="https://github.com/ericzzhou/envbox" target="_blank" />
              <Button icon={<HistoryOutlined />} onClick={() => setBackupOpen(true)}>
                版本历史
              </Button>
            </Space>
          }
        />
        <BackupDrawer open={backupOpen} onClose={() => setBackupOpen(false)} onRollbackDone={handleRollbackDone} />
      </div>
    </ConfigProvider>
  )
}
