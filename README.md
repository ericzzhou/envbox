# EnvBox

跨平台环境变量 & Hosts 管理工具。

## 功能

- **用户环境变量**：聚合视图 + Monaco Editor 编辑 shell 配置文件
- **系统环境变量**：sudo 提权编辑系统级配置文件
- **Hosts 管理**：结构化表格编辑，支持启用/禁用、搜索过滤
- **Shell 检测**：macOS 自动检测 zsh / bash，展示对应配置文件
- **版本历史**：保存前自动备份，全局 10 条历史，支持回滚
- **系统托盘**：关闭最小化到托盘，托盘常驻
- **自动更新**：静默下载，提示重启安装

## 安装

从 [GitHub Releases](https://github.com/ericzzhou/envbox/releases) 下载对应平台的安装包。

**macOS 首次打开：** 由于未进行 Apple 签名，首次打开可能被 Gatekeeper 拦截，执行以下命令后重新打开：
```bash
xattr -cr /Applications/EnvBox.app
```

## 开发

```bash
npm install
npm run electron:dev
```

## 构建

```bash
npm run electron:build
```

## 技术栈

Electron + React + Ant Design + Monaco Editor + electron-builder + electron-updater
