---
name: release-workflow
description: EnvBox 发布打包流程。当需要发布新版本、打包应用、创建 GitHub Release、或涉及版本号变更时使用此 skill。
---

# EnvBox 发布打包流程

## 前置条件
- GitHub 仓库：`git@github.com-personal:ericzzhou/envbox.git`
- 已配置 GitHub Actions workflow（`.github/workflows/release.yml`）
- 使用 `electron-builder` + `electron-updater` + GitHub Releases

## 发布步骤

### 1. 更新版本号
修改 `package.json` 中的 `version` 字段：
```json
"version": "x.y.z"
```

### 2. 提交版本变更
```bash
git add package.json
git commit -m "发布 vx.y.z"
git push
```

### 3. 打 tag 并推送
```bash
git tag vx.y.z
git push origin vx.y.z
```

### 4. 自动触发
推送 tag 后，GitHub Actions 自动执行：
- `macos-latest` → 打包 `.dmg`
- `windows-latest` → 打包 `.exe`（NSIS）
- `ubuntu-latest` → 打包 `.AppImage`

三个平台并行打包，完成后自动上传到 GitHub Releases 同一个 tag 下。

### 5. 验证
- 访问 https://github.com/ericzzhou/envbox/releases 确认产物已上传
- 确认 `latest-mac.yml`、`latest.yml`、`latest-linux.yml` 存在（electron-updater 依赖这些文件检测更新）

## 本地手动打包（可选）
```bash
# 仅前端构建
npx vite build

# 打包当前平台（分步执行避免卡死）
npx electron-builder --mac --publish never
npx electron-builder --win --publish never

# 产物在 release/ 目录下
```

## 自动更新机制
- `electron-updater` 启动时静默检查 GitHub Releases
- 发现新版本后自动下载
- 下载完成弹窗提示用户重启安装
- 托盘菜单也可手动触发"检查更新"

## 关键配置文件
| 文件 | 作用 |
|------|------|
| `package.json` → `build.publish` | electron-builder 发布目标（GitHub） |
| `.github/workflows/release.yml` | CI/CD 全平台打包 workflow |
| `electron/main.ts` → `setupAutoUpdater()` | 应用内自动更新逻辑 |
