# 本地运行：生产 / 测试 / 开发三环境

本项目在本机由 Caddy 静态托管，测试与生产完全分离。

| 环境 | 地址 | 前端来源 | 静态资产 | 浏览器存储 |
|---|---|---|---|---|
| 生产 | <http://localhost:8650> | `dist/`（发布快照） | `dist/data`、`dist/thumbs`、`dist/img` | 独立 |
| 测试 | <http://localhost:8651> | `dist-test/` | 仓库根 `data/`、`thumbs/`、`img/`（实时） | 独立 |
| 开发 | <http://localhost:5173> | Vite dev（HMR） | 仓库根（`vite.config.ts` 内置挂载） | 独立 |

三个端口是不同 origin，`localStorage` / `IndexedDB` 互不影响：测试时的配方、生图历史、API Key 不会污染生产（测试站需单独填一次 Key）。

## 常用命令

```bash
# 测试环境：只构建前端，2~3 秒，不复制图片
bash scripts/build.sh --test

# 生产环境：构建 + 复制全部资产（约 1.2 GB，发布时才跑）
bash scripts/build.sh

# 开发服务器
npm run dev
```

`--test` 产物在 `dist-test/`（已 gitignore），由 Caddy 的 `:8651` 站点托管；`/data /thumbs /img` 请求直接映射到仓库根，所以**新增图片或 JSON 不需要重新构建**，刷新即可（缓存 5 分钟）。

## 发布流程

```bash
# 1. 测试站验收通过后，合并回 main
git checkout main && git merge --ff-only feat/bear-series

# 2. 重建生产快照
bash scripts/build.sh

# 3. 重载 Caddy（dist/ 是静态目录，通常不重载也能生效；保险起见执行）
sudo systemctl reload caddy
```

> 生产站只读 `dist/` 快照，**新增的 `data/bears/`、`img/bears/` 在发布前不会出现在 8650**。这是测试/生产隔离的关键，不要改成直读仓库。

## Caddy 配置

站点定义在 `/etc/caddy/Caddyfile`：

- `:8650` 生产：`root` 指向 `dist/`，`/data|/img|/thumbs` 缓存 7 天，SPA fallback。
- `:8651` 测试：`handle /data/*`、`/thumbs/*`、`/img/*` 指向仓库根；其余指向 `dist-test/`；缓存 5 分钟。

修改后先校验再重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

回滚：本仓库不管理 Caddyfile。改动前的备份在 `/tmp/Caddyfile.bak.*`；也可直接删除 `:8651` 站点块。

## 从 Windows 访问

- `localhost:8650`、`localhost:8651` 由 WSL2 端口转发，通常可直接访问。
- 局域网/其他设备：`http://<WSL IP>:8650`。Windows 侧只为 **8650** 配了 portproxy（任务 `AI-Pose-Gallery-WSL`）；若要外部访问测试站，需另加 8651 的 portproxy 与防火墙规则。

## 缓存与排查

| 现象 | 原因 |
|---|---|
| 改了 `data/*.json` 但页面没变 | 测试站缓存 300 秒；硬刷新（Ctrl+F5） |
| 改了源码但页面没变 | `dist-test/` 是构建产物，需重跑 `build.sh --test` |
| 生产站看到测试数据 | 直接跑了 `build.sh` 重建 `dist/`；回滚见上 |
| ComfyUI 选图器看不到新数据 | 插件有进程内 JSON 缓存，重启 ComfyUI |
