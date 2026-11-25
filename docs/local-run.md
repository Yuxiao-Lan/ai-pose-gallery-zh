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
# 测试环境：暂存构建前端，类型检查通过后更新测试站，不复制图片
bash scripts/build.sh --test

# 生产环境：构建并复制全部发布资产到 dist.next/，成功后切换快照（仅发布时运行）
bash scripts/build.sh

# 开发服务器
npm run dev
```

`--test` 先构建到 `dist-test.next/`，只有 `npx tsc -b` 通过才会替换 `dist-test/`，类型检查失败会保留上次的测试产物。测试站不支持 HMR；每次重建后，已打开的测试标签页都要刷新。`:8651` 的 `/data/`、`/thumbs/`、`/img/` 直接读仓库根；只改图片或 JSON 不必重建，硬刷新即可绕过 5 分钟缓存。

> **不要用 `npm run build` / `pnpm build` 做本地预览。** 它们仍按 Vite 默认设置写入 `dist/`，可能覆盖生产快照；预览请用 `bash scripts/build.sh --test`。

## 发布流程

从仓库根运行。测试站验收通过后，把前端代码和配套目录数据一起发布：

```bash
git checkout main &&
  git merge --ff-only feat/bear-series &&
  python3 scripts/verify.py &&
  bash scripts/build.sh
```

当前 `verify.py` 是发布前必跑的手动检查，但只覆盖旧的未翻译目录，不校验实际使用的 `*-zh.json`。[改造计划](bear-series-plan.md) P3 先补齐校验，再接入生产快照切换前的自动检查。

生产模式默认只允许从 `main` 发布；分支不匹配时会打印当前和要求的分支并退出。`--allow-branch <name>` 把本次要求改为指定分支，当前分支仍必须匹配。发现 `data/`、`thumbs/`、`img/` 下有 Git 未跟踪**或被忽略**的文件时也会中止（例如 `.gitignore` 里的 `img/costume/*.png`），列出总数及最多前 20 个路径；只有明确要打包这些资产时才传 `--allow-untracked`。构建期间持有 `.build.lock`，同一检出内的并发构建会直接退出。两个生产选项可合用，但都不能和 `--test` 合用。

构建启动时（生产和测试均适用），若 `dist/` 缺失而 `dist.prev/` 存在，脚本会打印提示、先恢复 `dist.prev/` 到 `dist/`，再继续执行。生产先在 `dist.next/` 构建，生成路由树后做类型检查，再复制资产；全部成功、准备换入时才清理旧 `dist.prev/`、把当前 `dist/` 移到 `dist.prev/`，再把暂存目录移到 `dist/`。两次改名之间可能短暂无站点内容；第二次改名失败会尝试恢复旧快照，若进程在两次改名之间中断，下次启动会恢复。只换快照不必重载 Caddy；若也修改了 Caddy 配置（包括 `/data/*` 处理或缓存），按下节校验并重载。

> 生产站只读 `dist/` 快照，**新增的 `data/bears/`、`img/bears/` 在发布前不会出现在 8650**。这是测试/生产隔离的关键，不要改成直读仓库。

目录数据变更时，`:8650` 的 `/data/` 有 7 天 HTTP 缓存，客户端可能拿到旧 JSON。**必须**随代码和数据一起切换 `/data/` 请求版本（例如 `?v=<发布版本>`）——只缩短缓存或强刷无法清掉已经缓存的 7 天响应。发布后对已打开的生产标签页执行硬刷新（Ctrl+F5），并在开发者工具中确认请求拿到新版 JSON。ComfyUI 读取仓库根目录的数据；如果插件代码或其读取的数据有变更，在同一次切换中重启 ComfyUI，再硬刷新其浏览器前端。

## Caddy 配置

站点定义在 `/etc/caddy/Caddyfile`：

- `:8650` 生产：`root` 指向 `dist/`；`/data/*`、`/thumbs/*`、`/img/*`、`/assets/*` 各有独立 `handle`（缓存 7 天、缺失返回 HTTP 404，不落到 SPA fallback），其余路径仍走 SPA fallback。已验证：缺失的 `/data/*.json` 返回 404，页面路由返回 200。
- `:8651` 测试：`handle /data/*`、`/thumbs/*`、`/img/*` 指向仓库根；其余指向 `dist-test/`；缓存 5 分钟。

修改后先校验再重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile &&
  sudo systemctl reload caddy
```

## 生产内容回滚

恢复 Caddyfile 只会改站点配置，**不会恢复生产内容**。从仓库根执行以下命令，把上次的发布快照换回去，再按上文缓存步骤硬刷新生产标签页、核对 JSON：

```bash
test -d dist.prev && rm -rf dist && mv dist.prev dist
```

仅需回滚 Caddy 配置时，配置备份在 `/tmp/Caddyfile.bak.*`，恢复后另行校验、重载。

## 从 Windows 访问

- Windows 本机通过 WSL2 的 localhost 转发访问 `http://localhost:8650` 和 `http://localhost:8651`。
- 局域网访问生产站用 Windows 主机的局域网 IP 和 **8650** 端口（任务 `AI-Pose-Gallery-WSL` 配置 portproxy）。**8651 未配置 Windows portproxy**，WSL NAT 下局域网无法访问测试站；从 Windows 只用 `localhost:8651`，无需改 Caddy 监听地址。

## 缓存与排查

| 现象 | 处理 |
|---|---|
| 改了测试目录 JSON 但页面没变 | 测试站缓存 300 秒；硬刷新（Ctrl+F5） |
| 改了源码但测试页面没变 | 重跑 `bash scripts/build.sh --test` 后刷新已打开的标签页 |
| 生产站仍看到旧目录 JSON | 检查发布版本、硬刷新并确认 `/data/` 请求不再命中旧缓存 |
| 误发布数据到生产站 | 按上文用 `dist.prev/` 回滚生产快照 |
| ComfyUI 选图器看不到新数据 | 重启 ComfyUI 清除进程内缓存，再硬刷新 ComfyUI 前端 |
