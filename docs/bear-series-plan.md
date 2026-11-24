# 胖熊系列改造计划（系列 × 四库）

> 基线：`ec7a81e`
> 状态：决策已定，待开工
> 目标：把「单套图库」升级为「系列 × 库」；胖熊系列独立数据，含姿势 / 服装 / 人像 / 身材四库；测试与生产环境分离

## 0. 已定决策

| # | 决策 | 影响 |
|---|---|---|
| 1 | **四库全部独立数据** | 胖熊系列有自己的数据目录、分类词表、编号；通用系列原样保留 |
| 2 | **身材库本期只做浏览** | 不进合成台、不占第 4 槽；`RecipeState` 不动 |
| 3 | **敏感逐条标记**（`敏感: true/false`） | 一次性迁移 + Web/ComfyUI 双端同步改判定 |
| 4 | **只在本机运行** | 不处理 Cloudflare 体积上限、sitemap/canonical/SEO |
| 5 | **测试 / 生产分离** | 新增 `:8651` 测试站；生产 `:8650` 只吃 `dist/` 快照 |
| 6 | 分类词表 | 本文附录 A 先出一版 v1，你在此基础上改名/增删 |
| 7 | 收图目录与命名 | 本文附录 B 由我定，导入脚本按此实现 |
| 8 | 18+ 标记 | 你在 `manifest.csv` 的 `敏感` 列逐条填 `1/0`，脚本拒绝空值 |

本期**不做**：合成台第 4 槽、`/bears/studio`、公网部署、R2、用户上传进库。

---

## 1. 现状盘点（决定工作量的 9 个事实）

| # | 事实 | 位置 | 影响 |
|---|---|---|---|
| 1 | 三个查询硬编码路径 | `src/api/gallery.ts:81/93/105` | 参数化 |
| 2 | 配方固定 3 槽 | `src/types/gallery.ts:79` | 本期不动 |
| 3 | 拼图宽度随图数线性增长 | `src/services/aiGenerator.ts:274` | 本期不动 |
| 4 | ComfyUI 固定 3 库 + 1 配方节点 | `comfyui_plugin/nodes.py:116/163/205/245`、`routes.py:18` | 新增身材只读节点 |
| 5 | "三大图库"与数字写死 | `nav.ts:33-37`、`index.tsx:61-83`、`guide.tsx:35`、`extension.js:190`、README | 改为按系列派生 |
| 6 | NSFW 依赖硬编码体系/分类集合 | `src/api/gallery.ts:13-30`、`extension.js:108-114` | 改为逐条 `敏感` |
| 7 | 页面是单体组件 | `poses.tsx` 615 / `costumes.tsx` 401 / `portraits.tsx` 382 行 | 必须抽组件 |
| 8 | `build.sh` 每次复制 1.2 GB | `scripts/build.sh:20` | 测试环境不能这么干 |
| 9 | 生产是 `dist/` 快照，不读源码 | Caddyfile `:8650` | 天然可做隔离，只需新增测试站 |

---

## 2. 环境与发布

| 环境 | 端口 | 前端 | 静态资产 | 用途 |
|---|---:|---|---|---|
| **生产** | 8650 | `dist/`（发布快照，来自 `main`） | `dist/data,thumbs,img`（发布时复制） | 日常浏览，开发期间不受影响 |
| **测试** | 8651 | `dist-test/`（来自 `feat/bear-series`） | 仓库根 `data/ thumbs/ img/` 实时读取 | 验收新功能、新系列数据 |
| 开发 | 5173 | Vite dev（HMR） | 仓库根（`vite.config.ts` 已挂载） | 编码时 |

- **分支**：`main` 只用于发布；所有改造在 `feat/bear-series` 上做，验收通过后合并回 `main` 并重建 `dist/`。
- **数据隔离**：生产只读 `dist/` 副本，新增的 `data/bears/`、`img/bears/` 在发布前不会出现在 8650；测试站直读仓库，导入即生效。
- **浏览器存储隔离**：端口不同 → origin 不同 → localStorage / IndexedDB 完全独立。测试站的 API Key 需要重新填一次（可接受）。
- **ComfyUI**：插件读仓库根 `data/`，等同"实时测试"；发布前确认数据已就绪。

Caddy 变更（仓外 `/etc/caddy/Caddyfile`，新增站点，不改动 `:8650`）：

```caddy
:8651 {
	encode gzip zstd
	handle /data/*   { root * /home/lanyx/Code/ai-pose-gallery-zh      file_server }
	handle /thumbs/* { root * /home/lanyx/Code/ai-pose-gallery-zh      file_server }
	handle /img/*    { root * /home/lanyx/Code/ai-pose-gallery-zh      file_server }
	handle {
		root * /home/lanyx/Code/ai-pose-gallery-zh/dist-test
		try_files {path} /index.html
		file_server
	}
}
```

构建脚本新增能力（默认行为不变，生产流程照旧）：

```bash
bash scripts/build.sh                 # 生产：构建 dist/ + 复制 1.2 GB 资产（发布时用）
bash scripts/build.sh --test          # 测试：构建 dist-test/，不复制资产（秒级）
```

`--test` 内部：`npx tsc -b && npx vite build --outDir dist-test --emptyOutDir false`。`.gitignore` 增加 `dist-test/`。

**发布流程**（三步，明确写进文档）：
1. `feat/bear-series` 在 `:8651` 验收通过；
2. 合并到 `main`，`bash scripts/build.sh` 重建 `dist/`；
3. `sudo systemctl reload caddy`，`:8650` 生效，`:8651` 继续跑测试分支。

---

## 3. 信息架构

```
/                     系列入口（通用系列 / 胖熊系列）
/general              通用系列总览（原首页仪表盘）
  /general/poses  /general/costumes  /general/portraits
/bears                胖熊系列总览（初期空状态）
  /bears/poses  /bears/costumes  /bears/portraits  /bears/body
/studio               全局合成台（本期不改）
/settings  /guide
```

- 动态段：`src/routes/$series.{index,poses,costumes,portraits,body}.tsx`；未知系列 `notFound()`。
- 旧路径 `/poses|/costumes|/portraits` → 301 `/general/*`。
- 侧栏顶部系列切换器，切系列跳到同名库（`/bears/costumes` → `/general/costumes`）；当前系列存 `pose_atlas_series_v1`。

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
  视角: string            // 正面 / 斜侧 / 侧面 / 背面 / 俯视 / 仰视
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

// 三库条目统一加逐条标记
PoseItem / PortraitItem / CostumeItem  { 敏感?: boolean }
```

### 4.3 判定（新增 `src/lib/nsfw.ts`，Web 与插件共用同一语义）

```ts
export const isSensitive = (x: { 敏感?: boolean }) => x.敏感 === true
export const groupHasSensitive = (items) => items.some(isSensitive)
export const groupAllSensitive = (items) => items.length > 0 && items.every(isSensitive)
```

删除 `NSFW_POSE_SYSTEMS` / `NSFW_COSTUME_CATEGORIES`（`src/api/gallery.ts:13-14` 与 `comfyui_plugin/web/extension.js:108-114` 两份副本）。

---

## 5. 分阶段改动

### P0 · 测试环境隔离（0.25 天，先做）

| 文件 | 改动 |
|---|---|
| Caddyfile（仓外） | 新增 `:8651` 站点（见 §2） |
| `scripts/build.sh` | 加 `--test`：构建 `dist-test/`，不复制资产；默认行为不变 |
| `.gitignore` | 加 `dist-test/` |
| `docs/local-run.md`（新增） | 三环境说明、构建/发布/回滚命令 |
| git | 新建分支 `feat/bear-series` |

**验收**：`:8651` 打开与 `:8650` 一致；`build.sh --test` < 30 秒；改一行源码后测试站可见、生产站不变；两站 localStorage 互不影响。
**回滚**：删 Caddyfile 站点、`rm -rf dist-test`、删分支。

### P1 · 系列骨架（0.5–1 天）

| 文件 | 改动 |
|---|---|
| 新增 `src/lib/series.ts` | 注册表、`getSeries()`、导航/文案派生 |
| `src/api/gallery.ts` | `posesQueryFor(series)` 等 4 个工厂；`queryKey: ['gallery', series, 'poses']`；旧导出名指向 `general` |
| 新增 `src/components/gallery/{Pose,Costume,Portrait}Page.tsx` | 从 `src/routes/*.tsx` 平移，props 收 `series` |
| 新增 `src/routes/$series.{index,poses,costumes,portraits}.tsx` | 路由壳 + `staticData.title` + `notFound()` |
| `src/routes/{poses,costumes,portraits}.tsx` | `redirect` 到 `/general/*` |
| `src/routes/index.tsx` | 系列入口；原仪表盘抽成 `SeriesDashboard` 给 `/general/index` |
| `nav.ts` / `AppSidebar.tsx` / `AppHeader.tsx` | 系列切换器；徽标数字派生；prefetch 按系列（合成台固定 `general`） |

**验收**：双系列数据不串；旧 URL 301；刷新保持系列；空系列显示空状态。
**回滚**：删 `$series.*` 与 `components/gallery/`，还原上述文件。

### P2 · 身材库 + 导入工具（1.5 天）

| 文件 | 改动 |
|---|---|
| `src/types/gallery.ts` | `BodyItem` |
| `src/api/gallery.ts` | `bodyQueryFor(series)` |
| 新增 `src/components/gallery/BodyPage.tsx` | 分类 pill + 视角 + 搜索 + 网格 + 灯箱 + 下载；无"加入配方" |
| 新增 `src/routes/$series.body.tsx` | `libraries.body === null` 时 `notFound()` |
| `nav.ts` | 按 `libraries.body` 显隐 |
| 新增 `scripts/import_series.py` | 清单驱动导入（附录 B）：校验 → 生成 `thumbs`/`img` → 写 JSON → `--dry-run` / `--prune` / `--require-sensitive` |
| `data/bears/*.json` | 5–10 条样例跑通 |
| `scripts/verify.py` | 支持 `body` 与新目录 |

**验收**：`/bears/body` 可用；`/general/body` 404；重复导入幂等；敏感列为空的行被拒绝。
**回滚**：删新增文件，还原 `gallery.ts`/`nav.ts`/`verify.py`。

### P3 · 逐条敏感标记（1 天）

| 文件 | 改动 |
|---|---|
| 新增 `scripts/mark_sensitive.py` | 姿势 `体系 ∈ {全身单人・性感系, 双人缠绵}` → `敏感: true`；服装 `分类 ∈ {内衣・睡衣, 性感穿搭}` → `敏感: true`（`costume-anime-zh.json` 已全带字段，另外 3 个文件没有，按文件分别处理）；其余显式 `false`；`--dry-run` 输出计数与 diff |
| `src/lib/nsfw.ts` + `src/api/gallery.ts` | 判定改逐条，删集合 |
| `src/routes/poses.tsx` → `PosePage` | 体系 tab：全部敏感才隐藏；任意敏感挂 `18+`；解锁按钮去分类化 |
| `src/routes/costumes.tsx` → `CostumePage` | 分类 pill 的 18+ 徽标按条目派生 |
| `src/store/studioStore.tsx` | 安全模式文案去具体分类名 |
| `guide.tsx` / `index.tsx` | 免责声明改为逐条表述 |
| `comfyui_plugin/web/extension.js` | 删集合副本，读 `敏感`；`confirm` 文案同步 |
| `data/pose-zh.json` / `data/costume-zh.json` / `data/costume-gia-anime-zh.json` | 迁移产物（只加字段） |

**验收**：安全模式可见条目数与迁移前逐文件相等 —— 姿势 **674**；服装合计 **719**（现实 339 + 动漫 44 + ギア动漫 336 + Shisei 0）；关闭安全模式全可见；插件行为一致；`grep NSFW_POSE_SYSTEMS` 无残留。
**回滚**：`git checkout -- data src comfyui_plugin`。

---

## 6. 兼容与迁移

- **URL**：旧三库路径 301；`/` 变系列入口，原仪表盘移到 `/general`。
- **localStorage**：`RECIPE_KEY` 不变（v3）；新增 `pose_atlas_series_v1`。
- **IndexedDB**：结构不变。
- **ComfyUI**：`routes.py` 的 `_CACHE` 是进程内缓存，新增系列后需重启。
- **计数**：README / `nav.ts` / `index.tsx` / `guide.tsx` / `extension.js` 里写死的数字全部改派生。

---

## 7. 风险

| 风险 | 触发条件 | 处置 |
|---|---|---|
| 敏感标记漏标 | 迁移规则与旧集合不一致 | 迁移前后逐文件比对"安全模式可见数"，必须完全相等 |
| 数据串味儿 | queryKey 或 id 未隔离 | queryKey 带 series；id 前缀 + 构建期唯一性校验 |
| 测试污染生产 | 生产被改成直读仓库 | 生产保持 `dist/` 快照；测试站才直读仓库 |
| 上传误发布 | 新数据未验收就 rebuild `dist/` | 发布流程固定三步，重建前 `verify.py` 通过 |
| 上游冲突 | 触碰 `studioStore`/`aiGenerator` | 本期只改文案与随机池参数；小步提交、每日 rebase |
| 图片体积 | 本地磁盘 / 导入耗时 | 导入脚本强制单张 ≤ 2 MB，长边 ≤ 1600，缩略图 ≤ 300 KB |

---

## 8. 验证

```bash
npx tsc -b
npm run lint
bash scripts/build.sh --test
curl -s localhost:8651/bears/body -o /dev/null -w '%{http_code}\n'
python3 scripts/verify.py
python3 scripts/mark_sensitive.py --dry-run
```

人工：375px、灯箱下载、深度图开关、切系列后筛选重置、硬刷新缓存、ComfyUI 重启选图。

---

## 9. 排期

| 阶段 | 估时 | 累计 |
|---|---:|---:|
| P0 环境隔离 | 0.25 d | 0.25 d |
| P1 系列骨架 | 1 d | 1.25 d |
| P2 身材库 + 导入工具 | 1.5 d | 2.75 d |
| P3 逐条敏感标记 | 1 d | 3.75 d |

交付节奏：**P0+P1** 先给你看双系列跑通，**P2** 你开始导第一批图，**P3** 收尾。

---

## 附录 A · 分类候选词 v1（可改）

> 落地为 `data/bears/meta-zh.json`，页面筛选器从这份文件读，代码不再硬编码。

**姿势 · 体系**（4）
`全身・单人` / `半身・单人` / `局部・特写` / `双人・互动`

**姿势 · 分类**（12）
`站姿` `坐姿` `卧姿` `跪姿` `蹲姿` `倚靠` `躺卧` `抬举` `背对` `动态` `互动` `特写`

**视角**（6，沿用现有代码里的顺序，避免改 `ANGLES`）
`正面` `俯视` `仰视` `侧面` `斜侧` `背面`

**服装 · 分类**（9）
`日常休闲` `正装商务` `运动健身` `居家睡衣` `内衣情趣` `泳装沙滩` `制服工装` `古风民族` `配饰单品`

**人像 · 分区**（2）/ 发长（5）
分区：`正脸参考` / `造型氛围`
发长：`光头` `短发` `中发` `中长发` `长发`

**身材 · 体型分类**（7）
`壮熊` `肉熊` `胖熊` `毛熊` `熊叔` `小熊` `其他`

> 这组词是社区常用说法，但我没把握你的分类习惯。建议直接改成你自己的叫法——词表只影响筛选器显示，改词不涉及代码。

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
| `id` | 否 | 留空则按 `bear-<库>-<四位序号>` 自动生成；有值必须是 `bear-` 前缀且全局唯一 |
| `库` | 是 | `pose` / `costume` / `portrait` / `body` |
| `体系` | pose | 附录 A 的体系词 |
| `分类` | 是 | 对应库的分类词 |
| `名称` | 是 | 展示名（中文），会拼进 `检索` |
| `视角` | 是 | 附录 A 的视角词；同一组多视角 = 多行、同 `组` 列 |
| `组` | 否 | 多视角归组用，留空则每行独立成组 |
| `标签` | 否 | 逗号分隔 |
| `敏感` | **是** | `1` / `0`，**不允许空**（`--require-sensitive` 默认开启） |
| `文件` | 是 | 相对 `~/incoming/bears/` 的路径 |

脚本行为：
- 校验：id 前缀/唯一、枚举词合法、文件存在、单张 ≤ 2 MB、`敏感` 非空；
- 生成 `thumbs/bears/<库>/<id>.webp`（宽 300）与 `img/bears/<库>/<id>.webp`（长边 ≤ 1600，q82）；
- 写 `data/bears/<库>-zh.json`，字段顺序稳定，`检索 = id + 分类 + 名称 + 视角 + 标签`；
- 幂等 upsert；`--prune` 才删除清单外条目；`--dry-run` 只报告。
