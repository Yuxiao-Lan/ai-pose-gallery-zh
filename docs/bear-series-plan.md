# 胖熊系列改造计划（系列 × 四库）

> 基线：`ec7a81e`
>
> 状态：P0 环境隔离已落地（`e92792f`）并验证：`--test` 用时 2.7 秒，`:8651` 返回 HTTP 200，生产 `dist/` 未变；仅 P1–P3 待验收。
>
> 目标：把「单套图库」升级为「系列 × 库」；胖熊系列独立数据，含姿势 / 服装 / 人像 / 身材四库；测试与生产环境分离。

## 0. 已定决策

| # | 决策 | 影响 |
|---|---|---|
| 1 | **四库全部独立数据** | 胖熊系列有自己的数据目录、分类词表、编号；通用系列原样保留 |
| 2 | **身材库本期只做浏览** | 不进合成台、不占第 4 槽；`RecipeState` 不动 |
| 3 | **敏感逐条标记**（`敏感: true/false`） | 一次性迁移 + Web/ComfyUI 双端同步改判定 |
| 4 | **只在本机运行** | 不处理 Cloudflare 体积上限、sitemap/canonical/SEO |
| 5 | **测试 / 生产分离** | 已落地 `:8651` 测试站；生产 `:8650` 只吃 `dist/` 快照 |
| 6 | 分类词表 | 本文附录 A 先出一版 v1，你在此基础上改名/增删 |
| 7 | 收图目录与命名 | 本文附录 B 由我定，导入脚本按此实现 |
| 8 | 18+ 标记 | 你在 `manifest.csv` 的 `敏感` 列逐条填 `1/0`，脚本拒绝空值 |
| 9 | **新决策：胖熊系列本期关闭合成** | 注册表设 `allowRecipe: false`；胖熊四库隐藏「加入配方」，配方栏不提供胖熊条目 |

本期**不做**：胖熊合成、合成台第 4 槽、`/bears/studio`、公网部署、R2、用户上传进库、ComfyUI 多系列支持及身材节点。URL 模式尚不能传本地专有资产：`src/services/aiGenerator.ts:352-383` 会把胖熊本地路径改写到公网姿势 CDN。以后启用胖熊合成必须另开传输工作项，逐提供商实现 data URL / multipart 回退，不在本期范围内。ComfyUI 插件本期仍只支持通用系列；P2 同步逐条敏感判定并修正目录查找错误。将来做多系列时，注册表、缓存、API 和查找都要带系列维度。

---

## 1. 现状盘点（决定工作量的 9 个事实）

| # | 事实 | 位置 | 影响 |
|---|---|---|---|
| 1 | 三个查询硬编码路径（服装为 4 个文件） | `src/api/gallery.ts:81,92,105` | 参数化 |
| 2 | `RecipeState` 含人像、服装、姿势 3 个参考槽，另有 `workflowImages` / `extraImages` 辅图 | `src/types/gallery.ts:79-86` | 本期不改结构 |
| 3 | 拼图宽度随图数线性增长 | `src/services/aiGenerator.ts:274` | 本期不动 |
| 4 | ComfyUI 固定通用 3 库 + 1 配方节点 | `comfyui_plugin/nodes.py:116/163/205/245`、`comfyui_plugin/routes.py:19-25` | 本期不加库、不加节点 |
| 5 | “三大图库”、数字及旧来源/许可写死 | `nav.ts:33-39`、`src/routes/index.tsx:53,83`（另见 `:54-75,84,125`）、`src/routes/portraits.tsx:189-192`（“51 款”）、`guide.tsx:19-35`、`extension.js:4-29,190`、`comfyui_plugin/nodes.py:117,164,206,246`（节点 docstring）、`README.md:3,82-93`；服装卡片/灯箱缺 `source` 时默认ギア，人像页写死 CC0、发长和 Top10 | Web 按系列和数据派生；插件仍按通用库，需核对硬编码计数文案 |
| 6 | NSFW 依赖硬编码体系/分类集合 | `src/api/gallery.ts:13-30`、`comfyui_plugin/web/extension.js:109-114` | 改为逐条 `敏感` |
| 7 | 页面是单体组件 | `poses.tsx` / `costumes.tsx` / `portraits.tsx` | 抽出按系列复用的页面组件 |
| 8 | 构建已区分测试和生产 | `scripts/build.sh` | P0 已落地；测试不复制资产，两种模式均暂存构建、类型检查通过后才换入 |
| 9 | 生产是 `dist/` 快照，不读源码 | Caddyfile `:8650` | P0 已与 `:8651` 隔离 |

---

## 2. 环境与发布

| 环境 | 端口 | 前端 | 静态资产 | 用途 |
|---|---:|---|---|---|
| **生产** | 8650 | `dist/`（发布快照，来自 `main`） | `dist/data,thumbs,img`（发布时复制） | 日常浏览，开发期间不受影响 |
| **测试** | 8651 | `dist-test/`（来自 `feat/bear-series`） | 仓库根 `data/ thumbs/ img/` 实时读取 | 验收新功能、新系列数据 |
| 开发 | 5173 | Vite dev（HMR） | 仓库根（`vite.config.ts` 已挂载） | 编码时 |

- **分支**：`main` 只用于发布；所有改造在 `feat/bear-series` 上做，验收通过后合并回 `main` 并发布生产快照。
- **数据隔离**：生产只读 `dist/` 副本，新增的 `data/bears/`、`img/bears/` 在发布前不会出现在 8650；测试站直读当前检出分支的仓库资产，变更后硬刷新。前端改动要重建 `dist-test/` 并刷新已开的测试标签页。
- **浏览器存储隔离**：端口不同 → origin 不同 → localStorage / IndexedDB 完全独立。测试站的 API Key 需要重新填一次（可接受）。
- **ComfyUI**：插件只读取仓库根 `data/` 的通用库，不读取生产快照；进程内有缓存。

Caddy 的 `:8651` 站点已落地（仓外 `/etc/caddy/Caddyfile`）；`/data/`、`/thumbs/`、`/img/` 指向仓库根，缓存 5 分钟，其余由 `dist-test/` 提供 SPA fallback。生产 `:8650` 已增设独立 `handle /data/*`（同样处理 `/thumbs/*`、`/img/*`、`/assets/*`），从 `dist/` 提供静态文件，不走 SPA fallback：缺失目录 JSON 返回 HTTP 404 而不是 HTML（已验证）。客户端只把胖熊目录的 404 当空库；JSON 解析失败或其他加载错误须显示错误。两站不改监听；WSL NAT 下 8651 没有 Windows portproxy，Windows 本机用 `localhost:8651`，局域网不能访问。

```bash
bash scripts/build.sh                 # 生产：构建并复制资产到 dist.next/，成功后换入 dist/
bash scripts/build.sh --test          # 测试：暂存构建，通过后换入 dist-test/，不复制资产
```

两种模式均先 `npx vite build` 生成路由树，再运行 `npx tsc -b`；`dist-test/`、`dist-test.next/`、`dist.next/`、`dist.prev/` 不提交。启动时若 `dist/` 缺失而 `dist.prev/` 存在，先恢复旧快照。生产默认要求 `main` 且拒绝未跟踪资产（显式覆盖选项见本地运行文档）。

**发布流程**（详见 [本地运行](local-run.md)）：
1. `feat/bear-series` 在 `:8651` 验收通过，代码与配套目录 JSON 一起合并到 `main`；
2. P3 前必跑手动检查 `python3 scripts/verify.py`（当前只检查旧的未翻译目录，不覆盖 `*-zh.json`），通过后才运行生产构建。P3 先扩展校验以覆盖实际 `*-zh.json` 图库目录，再由 `scripts/build.sh` 在生产快照换入前自动执行；只有显式传入 `--skip-verify` 才跳过（P3 新增）。`dist.prev/` 保留上次发布；
3. 目录数据变更必须同时提升 `/data/` 请求版本（例如 `?v=<发布版本>`，前端请求统一携带），仅缩短缓存或强刷不足以让已缓存 7 天的客户端拿到新 JSON；硬刷新只是辅助。若变更 Caddy 的 `/data/*` 处理或缓存配置，先校验再重载。通用目录或插件有变更时，同一切换中重启 ComfyUI 并硬刷新其浏览器前端。

---

## 3. 信息架构

```
/                     系列入口（通用系列 / 胖熊系列）
/general/             通用系列总览（原首页仪表盘）
  /general/poses  /general/costumes  /general/portraits
/bears/               胖熊系列总览（初期空状态）
  /bears/poses  /bears/costumes  /bears/portraits  /bears/body
/studio               全局合成台（不按系列拆分配方或历史，本期仅通用图库参与）
/settings  /guide
```

- 动态段：`src/routes/$series.{index,poses,costumes,portraits,body}.tsx`；索引路由为 `/$series/`，未知系列 `notFound()`。
- 旧路径 `/poses`、`/costumes`、`/portraits`：Caddy 先返回 SPA 的 `index.html`，由 TanStack Router 的 `redirect({ ..., replace: true })` 在浏览器替换导航到对应 `/general/*`。
- 库页面以 URL 中的系列为准（查询键含 `series`、页面组件用 `key={series}` 重挂载），不是从存储推断。侧栏切换写入 `pose_atlas_series_v1` 并跳到同名库；目标系列无该库时回到其姿势页（`/bears/body` → `/general/poses`）。`/studio` 等无系列段页面的图库链接读取上次选择，未选时用 `general`；随机池还须受当前系列的 `allowRecipe` 约束，胖熊系列不提供候选、不自动回退到通用。不因切换清空配方、辅图或历史。

数据布局（现有 12,000 张图一张不动）：

```
data/pose-zh.json ...                  通用系列
data/bears/{pose,costume,portrait,body}-zh.json   胖熊系列
data/bears/meta-zh.json                胖熊系列分类词表（附录 A 落地处）
thumbs/bears/{pose,costume,portrait,body}/...
img/bears/{pose,costume,portrait,body}/...
```

ID 前缀 `bear-`，全局唯一；导入脚本强制校验，构建期脚本复查。

---

## 4. 数据结构

### 4.1 系列注册表（新增 `src/lib/series.ts`）

```ts
export interface SeriesDef {
  id: 'general' | 'bears'
  title: string
  subtitle: string
  cover?: string
  dataDir: string          // 'data' | 'data/bears'
  imageDir: string         // '' | 'bears'
  allowRecipe: boolean     // general: true；bears: false
  angles?: readonly string[]  // 默认保持通用现有顺序：正面、俯视、仰视、侧面、斜侧
  libraries: {
    poses: string | null
    costumes: string[] | null      // 通用 4 个文件；胖熊 1 个
    portraits: string | null
    body: string | null            // 通用为 null
  }
  filters: {
    costumeSources: boolean        // 通用 true；胖熊 false
    portraitHair: boolean          // 通用 true；胖熊按数据派生
  }
}
```

### 4.2 类型

```ts
export interface BodyItem {
  id: string
  体型分类: string        // 见附录 A
  体型名称: string
  视角: string            // 按本系列角度列表校验
  标签?: string[]
  身高?: number
  体重?: number
  体脂?: number
  缩略图: string
  原图: string
  检索: string
  敏感?: boolean
  source?: 'upload'
}

// 三库条目统一加逐条标记；姿势另有 hasDepth?: boolean（资产也可用来确定能力）
PoseItem / PortraitItem / CostumeItem  { 敏感?: boolean }
```

`hasDepth` 是条目能力，`useDepth` 是选用状态。统一规则：只有深度资产实际存在的条目才有深度能力；有效深度 = 条目有能力且请求使用深度。持久化旧值、全局深度模式、选择姿势及单槽/整套随机都不能给无能力条目写入有效的 `useDepth: true`；读取旧状态时也须按同一规则处理。通用旧条目即使未声明 `hasDepth`，仍按现有深度资产约定保持原行为。附录 B 只生成 WebP 原图和缩略图，不生成深度资产；无能力条目禁用深度控件，预览、下载、传图与对比参考均用普通图，不推导 `thumbs/depth/bears/...` 或 `img/depth/bears/...`。下载文件名和提示按实际资产格式（WebP 条目不写 `.png`）。

### 4.3 判定（新增 `src/lib/nsfw.ts`，Web 与插件采用同一语义）

```ts
export const isSensitive = (x: { 敏感?: boolean }) => x.敏感 === true
```

严格判定：仅布尔值 `true` 为敏感；缺字段视为 `false`，不能以分类、体系或 truthy 值兜底。迁移保留旧行为后，删除 `NSFW_POSE_SYSTEMS` / `NSFW_COSTUME_CATEGORIES`（`src/api/gallery.ts:13-14` 与 `comfyui_plugin/web/extension.js:109-114` 的运行时副本）。

---

## 5. 分阶段改动

按 P0 环境隔离 → P1 系列骨架 → P2 逐条敏感标记 → P3 身材库 + 导入工具交付。P1 只提供空目录；逐条过滤必须先通过验收，P3 才能展示导入的胖熊数据。

### P0 · 环境隔离（0.25 天，已落地）

| 文件 | 改动 |
|---|---|
| Caddyfile（仓外） | `:8651` 测试站（见 §2） |
| `scripts/build.sh` | `--test` 通过类型检查后替换 `dist-test/`；生产检查分支和未跟踪资产、暂存构建并保留回滚快照；启动时恢复中断的快照 |
| `.gitignore` | 忽略 `dist-test/`、`dist-test.next/`、`dist.next/`、`dist.prev/` |
| `docs/local-run.md` | 三环境说明、构建/发布/回滚命令 |
| git | 分支 `feat/bear-series` |

**已验证**：`--test` 2.7 秒（目标 < 30 秒）；`:8651` 返回 HTTP 200，生产 `dist/` 未变。两站由不同端口隔离浏览器存储。
**生产内容回滚**：把 `dist.prev/` 换回 `dist/`（见 [本地运行](local-run.md)），不是恢复 Caddyfile。

### P1 · 系列骨架（0.5–1 天）

| 文件 | 改动 |
|---|---|
| 新增 `src/lib/series.ts` | 注册表、`getSeries()`、`allowRecipe`、导航/文案派生；角度列表按系列，通用仍用现有五个角度 |
| `src/api/gallery.ts` | 三个浏览库的查询工厂（如 `posesQueryFor(series)`），`queryKey: ['gallery', series, 'poses']`；旧导出名指向 `general`；姿势分组按注册表角度排序 |
| 新增 `src/components/gallery/{Pose,Costume,Portrait}Page.tsx` | 从 `src/routes/*.tsx` 抽出；用 URL 的 `series` 作 props 和组件 `key`，控件读系列角度列表；胖熊页隐藏「加入配方」；服装卡片/灯箱和人像页按系列显示来源/许可，未知不冒用ギア或 CC0；无 `发长` 或无 `热门` 条目时分别隐藏发长筛选和 Top10，条目空发长不显示徽标 |
| 新增 `src/routes/$series.{index,poses,costumes,portraits,body}.tsx` | 路由壳 + `staticData.title`；未知系列或未配置的库走 `notFound()`；胖熊身材页先显示空状态 |
| `data/bears/{pose,costume,portrait,body}-zh.json` | P1 提交有效空数组 `[]`，不导真实数据；已配置但尚无文件的胖熊目录（HTTP 404）按空数组处理，UI 不报错；解析失败或其他加载失败不伪装成空数据 |
| `src/routes/{poses,costumes,portraits}.tsx` | 浏览器端 replace 导航到对应 `/general/*` |
| `src/routes/index.tsx` | 系列入口；原仪表盘抽成 `SeriesDashboard` 给 `/$series/` |
| `src/components/layout/{nav.ts,AppSidebar.tsx,AppHeader.tsx,RecipeDock.tsx}` | 系列切换写存储、徽标数字派生、链接和 prefetch 按系列；随机处理用当前系列并遵守 `allowRecipe`，配方栏不提供胖熊条目 |
| `src/routes/studio.tsx` | 三库链接、整套和单槽随机处理用当前系列并遵守 `allowRecipe`，不拆分合成台状态 |
| `src/types/gallery.ts`、`src/lib/recipeImages.ts`、`src/lib/comparisonReferences.ts`、姿势页及配方控件 | 用同一有效深度规则生成预览、下载、传图和对比参考（§4.2） |
| `src/lib/randomRecipe.ts`、`src/store/studioStore.tsx` | 单槽随机、全局深度 setter `setPoseDepthMode`、整套随机 `randomizeRecipe`、选入和恢复持久化状态的写入都按有效深度规则约束 `useDepth` |

随机只从当前系列、当前安全模式且允许入配方的池取。整套随机只替换有候选的槽；单槽无候选时保留原内容（空槽仍空）并提示；全空不改配方并提示。不从别的系列自动补位。

**验收**：直接打开和刷新按 URL 取系列，切换有组件和查询隔离；三个旧 URL 在浏览器 replace 到 `/general/*`；胖熊四库空数组和目录 404 显示空状态，通用目录 404 不当空库；坏 JSON 的错误态在 P3 用真实目录夹具验收。从 `/bears/body` 切通用去 `/general/poses`。胖熊图库和配方栏均无胖熊入槽入口，空池随机不清槽。在 `:8651` 放一条临时夹具（不进仓库或发布包：无深度能力的胖熊姿势 + WebP），全局深度开启时浏览并随机，确认仍用普通图、未写入无效深度、胖熊随机不改已有配方。另用状态层夹具直接验证选入、持久化恢复、全局开关及单槽/整套随机不会给无深度条目写入 `useDepth: true`。切系列不清配方、辅图或历史；历史支持复用已保存的**对比参考**，不恢复当时的配方。不在 P1 暴露真实导入数据。
**回滚**：一并撤销本阶段路由、组件、导航和空夹具。

### P2 · 逐条敏感标记（迁移 + 全库判定 + UI + 插件，1 天）

| 文件 | 改动 |
|---|---|
| 新增 `scripts/mark_sensitive.py` | 迁移姿势旧谓词 `体系 ∈ {全身单人・性感系, 双人缠绵}`；服装旧谓词为已有敏感值或 `分类 ∈ {内衣・睡衣, 性感穿搭}`；按文件迁移，保留动漫服装已标的敏感项，其他项写 `false`。`--dry-run` 输出逐文件计数和 ID 差异 |
| `data/pose-zh.json` / `data/costume*-zh.json` | 同步提交逐条布尔标记，不改 ID 或图片；人像旧模式无隐藏条目 |
| `src/lib/nsfw.ts` + `src/api/gallery.ts` | 各库统一用严格谓词（§4.3），预留给 P3 身材页使用 |
| `src/components/gallery/{Pose,Costume,Portrait}Page.tsx` | 各库安全模式逐条过滤，姿势先过滤再分组；徽标、筛选修正、灯箱见下文 |
| `src/store/studioStore.tsx`、`guide.tsx`、`index.tsx` | 随机池也用同一谓词；安全模式与免责声明改为逐条表述；首页预览先逐条过滤再取前 N，Top10/快捷入槽遵守安全模式与 `allowRecipe` |
| `comfyui_plugin/web/extension.js` | 通用三库删除集合副本，严格读取 `敏感`；同步 `confirm` 文案 |
| `comfyui_plugin/routes.py` | `find_item` 对未知 ID 明确报错，不返回 `items[0]`；空目录报清楚的错误，旧通用 ID 保持可用 |
| `scripts/{apply_translation,import_gia_anime,import_shisei_costumes}.py` | 重产数据时按 ID 保留标记或复用迁移规则补回，不能静默丢掉已迁移的标记 |

姿势先按行过滤，再从过滤结果构建展示分组；同组有普通和敏感角度时，安全模式下网格、角度控件、灯箱和键盘切换只能接触普通条目。`18+` 徽标依据安全过滤前的条目集合；体系 tab 计数及可选角度来自过滤后条目，排序用系列角度列表。活动体系/分类须仍在可见选项里，否则回到「全部」；不可用角度也重置。解锁按钮成功后回到「全部」，不跳某个写死的体系。服装的活动分类也须按当前可见条目校验，分类徽标依据安全过滤前同一范围的条目。可见性变化时按组键/条目 ID 在过滤后结果中重新解析已开的灯箱，条目不可见就关闭，不复用旧下标或缓存条目。

迁移前安全模式基线（按条目，不按组）：

| 文件 | 总数 | 隐藏 | 可见 |
|---|---:|---:|---:|
| `pose-zh.json` | 1,439 | 674 | 765 |
| `costume-zh.json` | 1,407 | 339 | 1,068 |
| `costume-anime-zh.json` | 440 | 44 | 396 |
| `costume-gia-anime-zh.json` | 1,320 | 336 | 984 |
| `costume-shisei-zh.json` | 57 | 0 | 57 |

**验收**：在同一基线分别保存旧谓词和新谓词的逐文件隐藏 **ID 集合**，逐文件对称差必须为空（姿势隐藏 674、服装共隐藏 719，计数仅作快速核对）。验证混合角度组和活动筛选/灯箱随安全模式变化；关闭安全模式并清除其他筛选后所有条目可见；插件重启并刷新前端后判定一致；回归检查旧通用 ID 命中原条目、未知 ID 报错、空目录得到明确错误；Web 与插件运行时代码无旧集合；缺字段等于 `false`。三个生成器各重产一次后仍保留敏感标记，重跑隐藏 ID 集合对比。代码、目录和缓存按 §2 同步切换。
**回滚**：一并撤销本阶段代码和 JSON；已发布则换回 `dist.prev/` 并刷新，插件恢复相应代码与数据后重启、重载前端。

### P3 · 身材库 + 导入工具（1.5 天）

| 文件 | 改动 |
|---|---|
| `src/types/gallery.ts` | `BodyItem` |
| `src/api/gallery.ts` | `bodyQueryFor(series)`，沿用 P1 胖熊目录 404 才当空库的约定 |
| 新增 `src/components/gallery/BodyPage.tsx` | 分类 pill + 视角 + 搜索 + 网格 + 灯箱 + 下载；沿用 P2 逐条过滤；无「加入配方」 |
| `src/routes/$series.body.tsx` | 将 P1 的空状态壳接到 `BodyPage`；通用系列仍 `notFound()` |
| 新增 `scripts/import_series.py` | 清单驱动导入（附录 B）：校验词表与姿势专用分组 → 生成 `thumbs`/`img` → 写 JSON；支持 `--dry-run` / `--prune` / `--require-sensitive` |
| `src/components/gallery/{Pose,Costume,Portrait}Page.tsx` | 姿势搜索纳入 `检索`（附录 B）；用导入样例验收 P1 的系列来源/许可及隐藏空发长徽标、发长筛选和 Top10 |
| `data/bears/*.json` | P2 验收后才用 5–10 条样例跑通 |
| `scripts/verify.py` | 校验实际使用的通用与胖熊 `*-zh.json` 图库目录（含 `body`）：必填字段、跨系列跨库 ID 全局唯一、引用的本地资产存在、附录 B 的姿势分组约束（不得与隐式 ID 冲突，每组一个体系/分类、不重复视角；非姿势不分组） |
| `scripts/build.sh` | 在 `verify.py` 扩展后接入：生产快照换入前必须通过校验；仅显式 `--skip-verify` 可跳过，测试模式不受影响 |

**验收**：浏览器中 `/bears/body` 可用、`/general/body` 显示未找到页；胖熊四库只浏览不入配方，来源/许可和筛选符合实际数据；敏感条目在安全模式下不展示，缺深度的 WebP 不启用深度控件。重复导入幂等，prune 后不复用 ID，拒绝空敏感列、越界文件和非法分组；实际 `*-zh.json` 校验失败时生产不换快照。
**回滚**：撤销本阶段，保留 P1 空状态和 P2 逐条判定。

---

## 6. 兼容与迁移

- **URL**：旧三库路径用客户端 replace 导航（§3），不是 HTTP 重定向；`/` 变系列入口，原仪表盘移到 `/general/`。
- **localStorage / IndexedDB**：`RECIPE_KEY` 不变（v3），IndexedDB 结构不变；新增 `pose_atlas_series_v1`。同一站点不按系列分区存储配方、辅图和历史；切换系列不清空它们。历史用于复用对比参考，不恢复配方；不同端口仍互相隔离。
- **ComfyUI**：`comfyui_plugin/routes.py:25` 的 `_CACHE` 是进程内缓存；更换通用目录与插件时同时重启 ComfyUI、重载其浏览器前端。
- **计数**：Web 的 `nav.ts` / `index.tsx` / `portraits.tsx` / `guide.tsx` 改为按系列和数据派生；README 和通用限定的插件文案一并核对（位置见 §1）。

---

## 7. 风险

| 风险 | 触发条件 | 处置 |
|---|---|---|
| 测试或构建失败影响生产（P0） | 直接在 `dist/` 构建，或发布换入时中断 | 测试用 `--test`；生产通过守卫后暂存构建，保留 `dist.prev/` 供回滚及启动恢复 |
| 数据串系列或把坏目录当空库（P1） | 未按系列隔离，或生产 `/data/*` 落到 SPA fallback | URL、查询键和组件 key 按系列，ID 全局唯一；独立 `/data/*`，仅胖熊目录 404 当空库 |
| 本地图不可传或误用深度（P1） | 胖熊本地路径被改写到公网 CDN，或全局/持久化深度套到无能力条目 | 本期关闭胖熊合成；状态写入、展示和对比参考统一使用有效深度 |
| 敏感标记漏标或被重产覆盖（P2） | 迁移规则与旧谓词不一致，或生成器丢标记 | 迁移与重产后逐文件比较隐藏 ID 集合；验证混合分组、筛选与灯箱 |
| 插件误选参考图（P2） | 传入未知 ID 或目录为空 | 明确报错；回归验证旧通用 ID 仍命中原条目 |
| 客户端仍用旧数据（P2/P3） | 代码与目录不同步、浏览器或插件缓存未刷新 | 成对发布、切换 `/data/` 缓存，重启 ComfyUI 并刷新其前端（§2） |
| 新图未验收就入库，或冒用来源与许可（P3） | 提前导入、跳过校验或沿用通用库文案 | P2 验收前只保留空夹具；P3 校验实际目录及分组再接入发布，样例核对来源/许可和筛选 |
| 上游冲突（P1/P2） | 触碰 `studioStore` | 只改随机、深度选用及安全提示，不改配方结构或 `aiGenerator`；小步提交、每日 rebase |
| 图片体积（P3） | 本地磁盘 / 导入耗时 | 导入脚本强制单张 ≤ 2 MB，长边 ≤ 1600，缩略图 ≤ 300 KB |

---

## 8. 验证

- **P0**：`bash scripts/build.sh --test` 先生成路由树，类型检查通过后才更新测试产物；`:8651` 能服务前端，正常测试构建不改 `dist/`。核对生产分支和未跟踪资产守卫，以及发布中断后的快照恢复。
- **P1**：通过 `bash scripts/build.sh --test` 和 `npm run lint`。在浏览器验证三个旧 URL replace 后不能后退到旧路径，核对总览、直接加载、切换回退和随机空池。对 `:8650` 验证缺失目录返回 404 而不是 HTML；页面只对胖熊目录 404 显示空库，坏 JSON 显示错误。胖熊不提供入配方入口；全局深度开启时选胖熊姿势再随机，按 P1 夹具检查深度写入，无效深度不会渲染或保存。切换保留配方、辅图和历史；从历史复用对比参考，不恢复配方。`curl` 不能证明客户端重定向或未找到路由。
- **P2**：运行 `python3 scripts/mark_sensitive.py --dry-run`，迁移、重产后逐文件对照隐藏 ID 集合；在浏览器验证 375px 布局、混合敏感组、活动筛选和已打开灯箱、解锁回「全部」。重启 ComfyUI 并重载其浏览器前端，核对通用目录过滤；检查旧 ID、未知 ID 及空目录的查找结果。发布切换时硬刷新并核对实际 JSON 版本。
- **P3**：扩展 `python3 scripts/verify.py` 后，用真实 `*-zh.json` 和坏数据夹具检查必填字段、重复 ID、缺本地资产及非法分组；确认默认生产构建在校验不通过时不换快照。验证词表驱动导入、prune、拒绝非法 ID/路径和空敏感列。浏览器核对 `/bears/body` 浏览、`/general/body` 未找到、`背面` 角度、WebP 下载、无深度条目、正确来源/许可及隐藏空发长徽标与无数据的筛选。

---

## 9. 排期

| 阶段 | 估时 | 累计 |
|---|---:|---:|
| P0 环境隔离（已落地） | 0.25 d | 0.25 d |
| P1 系列骨架、只浏览策略、`/data/*` 契约 | 1 d | 1.25 d |
| P2 逐条敏感标记、ComfyUI 查找回归 | 1 d | 2.25 d |
| P3 身材库、导入工具、发布校验 | 1.5 d | 3.75 d |

交付节奏：**P0** 完成环境隔离；**P1** 验收双系列路由、空库、胖熊不入配方及有效深度；**P2** 验收逐条过滤、迁移和通用插件；通过后才在 **P3** 导第一批图，验收身材、来源/许可和筛选。P3 先扩展 `verify.py` 覆盖实际目录，再接入发布脚本；此前保留手动校验。

---

## 附录 A · 分类候选词 v1（可改）

> 分类词表落地为 `data/bears/meta-zh.json`，既供页面筛选，也约束导入清单；角度列表由系列注册表提供。改词须同步更新词表、清单和目录 JSON（或用更新后的清单重产目录），不是只改界面文案。

**姿势 · 体系**（4）
`全身・单人` / `半身・单人` / `局部・特写` / `双人・互动`

**姿势 · 分类**（12）
`站姿` `坐姿` `卧姿` `跪姿` `蹲姿` `倚靠` `躺卧` `抬举` `背对` `动态` `互动` `特写`

**胖熊视角**（由注册表提供给分组、角度筛选和灯箱；最后一项仅胖熊使用）

`正面` `俯视` `仰视` `侧面` `斜侧` `背面`

注册表未单设角度的系列默认使用现有五角度，通用系列的列表与顺序不变。

**服装 · 分类**（9）
`日常休闲` `正装商务` `运动健身` `居家睡衣` `内衣情趣` `泳装沙滩` `制服工装` `古风民族` `配饰单品`

**人像 · 分区**（2）/ 发长（5）
分区：`正脸参考` / `造型氛围`
发长：`光头` `短发` `中发` `中长发` `长发`

**身材 · 体型分类**（7）
`壮熊` `肉熊` `胖熊` `毛熊` `熊叔` `小熊` `其他`

> 这组词是社区常用说法，但可改成你自己的叫法；改词按本附录开头的同步规则处理。

**通用标签**（可按需扩）
`体毛` `胸毛` `肚腩` `胡须` `眼镜` `纹身` `项圈` `疤痕` `熟年` `青年` `户外` `室内`

---

## 附录 B · 收图目录与清单约定（我定）

```
~/incoming/bears/                     收图暂存区（仓库外，不入 git）
  pose/      <体系>/<分类>/<文件名>
  costume/   <分类>/<文件名>
  portrait/  <分区>/<文件名>
  body/      <体型分类>/<文件名>
  manifest.csv                        唯一权威元数据
```

`manifest.csv` 列：

| 列 | 必填 | 说明 |
|---|---|---|
| `id` | 否 | 留空则按 `bear-<库>-<四位序号>` 分配并持久化；手填 ID 必须符合下文语法、全局唯一 |
| `库` | 是 | `pose` / `costume` / `portrait` / `body` |
| `体系` | pose | 附录 A 的体系词 |
| `分类` | 是 | 对应库的分类词 |
| `名称` | 是 | 展示名（中文），会拼进 `检索` |
| `视角` | 是 | 附录 A 的视角词；仅姿势可用多行表示同组的不同视角 |
| `组` | 否，仅限 pose | 显式多视角分组键，必须匹配 `^g-[a-z0-9-]+$`；留空则该行以 `id` 独立成组。其他库必须留空，服装永不分组 |
| `标签` | 否 | 逗号分隔 |
| `敏感` | **是** | `1` / `0`，**不允许空**（`--require-sensitive` 默认开启） |
| `文件` | 是 | 相对 `~/incoming/bears/` 的路径 |

脚本行为：
- 校验 ID 符合 `^bear-[a-z0-9]+(-[a-z0-9]+)*$`（仅小写 ASCII、数字、连字符），跨系列、跨库唯一；按系列词表校验枚举词，校验输入文件存在、单张 ≤ 2 MB，`敏感` 只能为 `1` 或 `0`。
- 姿势显式 `组` 必须匹配 `^g-[a-z0-9-]+$`，序列化后写入 `姿势编号`，因此可与单行隐式组（`姿势编号 = id`，不带 `g-` 前缀）区分；同组各行必须使用同一 `体系` 和 `分类`，`视角` 不得重复。导入时检查上述约束；P3 的发布校验对胖熊目录套用同一约束，通用目录只按现有 `体系 + 姿势编号` 复合键校验重复，不套用单体系限制（通用库中同一编号可出现在多个体系）。
- `文件` 必须是相对导入根且符合本库目录约定的路径；拒绝绝对路径或 `..`，解析含符号链接的真实路径后，必须仍在导入根及对应库目录内且为普通文件。原始路径只供导入，不写进目录 JSON。
- 每库按单调递增的四位序号分配自动 ID（跳过已占用或退役的 ID，耗尽时报错）。随清单持久化记录规范化输入路径到 ID 的分配、序号进度及退役 ID，不改变 CSV 列约定。重跑沿用已有分配，改名时通过显式 ID 指定保留哪条记录；`--prune` 移除条目时保留退役 ID，不再分配或接受复用。`--dry-run` 只报告，不写分配记录或资产。
- 生成 `thumbs/bears/<库>/<id>.webp`（宽 300，≤ 300 KB）与 `img/bears/<库>/<id>.webp`（长边 ≤ 1600，q82），**不生成深度资产**。按 ID 幂等 upsert `data/bears/<库>-zh.json`；字段顺序稳定，只在 `--prune` 时移除清单外条目。
- 四库 `检索` 必填，拼接 ID、分类、名称、视角和标签，以空格分隔；姿势补体系和编号，人像可补非空发长。服装、人像的现有搜索匹配 `检索`，身材页也读 `检索`。姿势页当前另拼名称、ID、分类、姿势编号、体系，不读 `检索`；P3 必须把 `检索` 纳入分组及单张搜索，清单标签才可搜索。

下面是各库的一条序列化 JSON 记录。清单 `库` 决定目标文件、`文件` 决定输入资产，`id` 决定输出路径，`敏感: 0/1` 序列化为布尔 `false/true`。

**姿势**：`体系`、`分类` 原样；`名称` → `姿势名称`，`视角` → `角度`，`组` → `姿势编号`（留空用 ID）。标签进 `检索`；导入条目无深度。

```json
{
  "id": "bear-pose-0001", "体系": "全身・单人", "分类": "站姿",
  "姿势名称": "自然站立", "姿势编号": "B001", "角度": "背面",
  "缩略图": "thumbs/bears/pose/bear-pose-0001.webp", "原图": "img/bears/pose/bear-pose-0001.webp",
  "hasDepth": false, "敏感": false, "检索": "bear-pose-0001 全身・单人 B001 站姿 自然站立 背面 户外"
}
```

**服装**：`名称` → `服装名称`，`分类` 原样，`标签` 按逗号拆分（缺省 `[]`），`关键词` 默认空字符串；`一级分类` 默认 `现实`，`预览图` 默认同 `原图`。`视角` 纳入 `检索`，不合并逐条记录、不生成 `views`；图片字段都是本地路径，不设置 `source: charadb/gia-anime` 或远程来源字段。

```json
{
  "id": "bear-costume-0001", "一级分类": "现实", "分类": "日常休闲", "服装名称": "蓝色衬衫",
  "标签": ["户外"], "关键词": "",
  "缩略图": "thumbs/bears/costume/bear-costume-0001.webp",
  "预览图": "img/bears/costume/bear-costume-0001.webp", "原图": "img/bears/costume/bear-costume-0001.webp",
  "敏感": false, "检索": "bear-costume-0001 日常休闲 蓝色衬衫 正面 户外"
}
```

**人像**：`分类` → `分区`，`名称` 默认同时写入 `发型名称` 和 `标题`；清单无发长列，`发长` 默认 `""`（不标成某个发长），`精选`、`热门` 默认 `false`。`宽`、`高`、`字节数` 取生成后的原图；`视角`、`标签` 进 `检索`。

```json
{
  "id": "bear-portrait-0001", "分区": "正脸参考", "发长": "", "发型名称": "胡须人像", "标题": "胡须人像",
  "宽": 1200, "高": 1600, "字节数": 184320, "精选": false, "热门": false,
  "缩略图": "thumbs/bears/portrait/bear-portrait-0001.webp", "原图": "img/bears/portrait/bear-portrait-0001.webp",
  "敏感": false, "检索": "bear-portrait-0001 正脸参考 胡须人像 正面 胡须"
}
```

**身材**：`分类` → `体型分类`，`名称` → `体型名称`，`视角`、`标签` 写对应字段；无测量资料时不填身高、体重、体脂。

```json
{
  "id": "bear-body-0001", "体型分类": "壮熊", "体型名称": "宽肩体型", "视角": "侧面", "标签": ["室内"],
  "缩略图": "thumbs/bears/body/bear-body-0001.webp", "原图": "img/bears/body/bear-body-0001.webp",
  "敏感": false, "检索": "bear-body-0001 壮熊 宽肩体型 侧面 室内"
}
```
