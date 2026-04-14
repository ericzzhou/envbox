import { app, BrowserWindow, Tray, Menu, nativeImage, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })
}

function createTray() {
  const iconPath = path.join(__dirname, '../build/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  if (process.platform === 'darwin') icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('EnvBox - 环境变量管理')
  const menu = Menu.buildFromTemplate([
    { label: `EnvBox v${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: '打开 EnvBox', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '检查更新', click: () => checkForUpdatesManually() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; tray?.destroy(); tray = null; app.quit() } }
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', () => mainWindow?.show())
}

let isManualCheck = false

function checkForUpdatesManually() {
  if (process.env.VITE_DEV_SERVER_URL) {
    dialog.showMessageBox({ type: 'info', title: '检查更新', message: '开发模式下不支持检查更新。' })
    return
  }
  isManualCheck = true
  dialog.showMessageBox({ type: 'info', title: '检查更新', message: '正在检查更新...' })
  autoUpdater.checkForUpdates().catch((err) => {
    isManualCheck = false
    dialog.showMessageBox({ type: 'error', title: '检查更新', message: `检查更新失败：${err?.message || '请检查网络连接'}` })
  })
}

function setupAutoUpdater() {
  if (process.env.VITE_DEV_SERVER_URL) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-not-available', () => {
    if (isManualCheck) {
      isManualCheck = false
      dialog.showMessageBox({ type: 'info', title: '检查更新', message: '当前已是最新版本。' })
    }
  })

  autoUpdater.on('update-available', (info) => {
    if (isManualCheck) {
      dialog.showMessageBox({ type: 'info', title: '检查更新', message: `发现新版本 v${info.version}，正在后台下载...` })
    }
  })

  autoUpdater.on('error', (err) => {
    if (isManualCheck) {
      isManualCheck = false
      dialog.showMessageBox({ type: 'error', title: '检查更新', message: `检查更新失败：${err?.message || '未知错误'}` })
    }
  })

  autoUpdater.on('update-downloaded', () => {
    isManualCheck = false
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: '更新就绪',
      message: '新版本已下载完成，重启应用即可安装更新。',
      buttons: ['稍后重启', '立即重启'],
      defaultId: 1,
    }).then(({ response }) => {
      if (response === 1) autoUpdater.quitAndInstall()
    })
  })

  // 启动后静默检查更新
  autoUpdater.checkForUpdates().catch(() => { /* 忽略网络错误 */ })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  createTray()
  setupAutoUpdater()
})

app.on('before-quit', () => { isQuitting = true })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  mainWindow?.show()
})
