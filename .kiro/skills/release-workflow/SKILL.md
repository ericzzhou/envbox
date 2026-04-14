---
name: release-workflow
description: EnvBox 发布打包流程。当需要发布新版本、打包应用、创建 GitHub Release、或涉及版本号变更时使用此 skill。
---

# EnvBox 发布流程

## 发布前检查

1. 确认所有代码已合并到 `main` 分支
2. 确认 `package.json` 中 `build.publish` 包含完整配置：
   ```json
   "publish": {
     "provider": "github",
     "owner": "ericzzhou",
     "repo": "envbox",
     "releaseType": "release"
   }
   ```
3. 确认该版本号的 GitHub Release 不存在（若存在需先执行「清理残留 Release」）
4. 本地验证构建通过：
   ```bash
   npx vite build
   npx electron-builder --mac --publish never
   ```

## 发布步骤

```bash
# 1. 更新版本号
# 修改 package.json 中的 version 字段

# 2. 提交并推送
git add package.json
git commit -m "发布 vx.y.z"
git push

# 3. 打 tag 触发自动构建
git tag vx.y.z
git push origin vx.y.z

# 4. 查看构建状态
gh run list --repo ericzzhou/envbox --limit 1
```

## 发布后验证

1. 访问 https://github.com/ericzzhou/envbox/actions 确认三个平台构建成功
2. 访问 https://github.com/ericzzhou/envbox/releases 确认产物齐全：
   - `.dmg` + `latest-mac.yml`（macOS）
   - `.exe` + `latest.yml`（Windows）
   - `.AppImage` + `latest-linux.yml`（Linux）

## 清理残留 Release

当需要重新发布同一版本时，必须按顺序执行：

```bash
gh release delete vx.y.z --repo ericzzhou/envbox --yes
git push origin :refs/tags/vx.y.z
git tag -d vx.y.z
git tag vx.y.z
git push origin vx.y.z
```

## CI 配置要点

workflow 文件：`.github/workflows/release.yml`

- 必须在 `electron-builder` 之前执行 `npx vite build`（生成 dist 和 dist-electron）
- Node.js 版本使用 22+（20 已废弃）
- `strategy.fail-fast: false`（单平台失败不影响其他平台）
- 使用 `${{ secrets.GITHUB_TOKEN }}` 作为 `GH_TOKEN` 发布到 Releases

## 关键文件

| 文件 | 作用 |
|------|------|
| `package.json` → `version` | 版本号，必须与 tag 一致 |
| `package.json` → `build.publish` | GitHub 发布目标配置 |
| `.github/workflows/release.yml` | 全平台自动打包 workflow |
| `electron/main.ts` → `setupAutoUpdater()` | 客户端自动更新逻辑 |
