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
  // 用 nativeImage 绘制一个 16x16 的 "E" 图标
  const size = 16
  const canvas = Buffer.alloc(size * size * 4, 0) // RGBA
  // 画一个简单的 "E" 字形（黑色像素）
  const setPixel = (x: number, y: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const i = (y * size + x) * 4
      canvas[i] = 0       // R
      canvas[i + 1] = 0   // G
      canvas[i + 2] = 0   // B
      canvas[i + 3] = 255 // A
    }
  }
  // 横线（上中下）
  for (let x = 3; x <= 12; x++) { setPixel(x, 3); setPixel(x, 4) }
  for (let x = 3; x <= 11; x++) { setPixel(x, 7); setPixel(x, 8) }
  for (let x = 3; x <= 12; x++) { setPixel(x, 11); setPixel(x, 12) }
  // 竖线（左）
  for (let y = 3; y <= 12; y++) { setPixel(3, y); setPixel(4, y) }

  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size })
  if (process.platform === 'darwin') icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('EnvBox - 环境变量管理')
  const menu = Menu.buildFromTemplate([
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
