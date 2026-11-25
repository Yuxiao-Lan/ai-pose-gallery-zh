# 胖熊系列：收图与导入

导入脚本：`scripts/import_series.py`；词表：`data/bears/meta-zh.json`；ID 账本：`data/bears/ids.json`（首次导入自动生成）。

## 1. 准备目录

```text
~/incoming/bears/
  pose/       <体系>/<分类>/<文件>
  costume/    <分类>/<文件>
  portrait/   <分区>/<文件>
  body/       <体型分类>/<文件>
  manifest.csv
```

`文件` 列写相对 `~/incoming/bears/` 的路径；目录层级只是方便你自己找图，脚本以清单为准。

## 2. 清单格式

首行表头，UTF-8。模板见 `scripts/templates/bears-manifest.csv`。

| 列 | 必填 | 说明 |
|---|---|---|
| `id` | 否 | 留空自动分配 `bear-<库>-<四位>`；一旦分配就固定在 `ids.json`，改文件名不影响 |
| `库` | 是 | `pose` / `costume` / `portrait` / `body` |
| `体系` | 仅 pose | 必须是 `meta-zh.json` 的 `姿势体系` |
| `分类` | 是 | 对应库的词表：姿势分类 / 服装分类 / 人像分区 / 体型分类 |
| `名称` | 是 | 展示名，会进搜索 |
| `视角` | 是 | `正面` `俯视` `仰视` `侧面` `斜侧` `背面` |
| `组` | 否 | 仅姿势，多视角归组用；必须 `g-...`，同组共用一个体系/分类且视角不重复 |
| `标签` | 否 | 逗号分隔；姿势页之外按标签筛选 |
| `敏感` | **是** | `1` 或 `0`，空值直接拒绝 |
| `文件` | 是 | 相对收图根目录 |
| `发长` | 否 | 仅人像，必须是 `meta-zh.json` 的 `人像发长` |
| `身高`/`体重`/`体脂` | 否 | 仅身材，整数 |

示例：

```csv
id,库,体系,分类,名称,视角,组,标签,敏感,文件
,pose,全身・单人,站姿,自然站立,正面,g-b001,户外,0,pose/站姿/a.png
,pose,全身・单人,站姿,自然站立,侧面,g-b001,户外,0,pose/站姿/b.png
,body,,壮熊,宽肩厚背,正面,,体毛,0,body/壮熊/c.png
```

## 3. 运行

```bash
# 先校验，不写任何文件
python3 scripts/import_series.py --manifest ~/incoming/bears/manifest.csv --dry-run

# 正式导入（可反复执行，按 id 覆盖）
python3 scripts/import_series.py --manifest ~/incoming/bears/manifest.csv

# 让库与清单完全一致（删除清单外条目；图片保留，ID 退役不复用）
python3 scripts/import_series.py --manifest ~/incoming/bears/manifest.csv --prune
```

输出：缩略图 300px、原图长边 ≤1600、单张 ≤2MB 的 WebP，写入 `thumbs/bears/<库>/` 与 `img/bears/<库>/`；JSON 写入 `data/bears/<库>-zh.json`。

## 4. 看效果

- 测试站：<http://192.168.0.114:8651/bears/body>（本机 `localhost:8651`）
- 导入后刷新页面即可，测试站直读仓库；生产站要等重新发布。

## 5. 删掉自带的占位样例

仓库里预置了 6 条 `bear-body-sample-*` 占位图（纯色块，用来看页面）。用只含真实条目的清单执行一次 `--prune`，再删除：

```bash
rm -f img/bears/body/bear-body-sample-*.webp thumbs/bears/body/bear-body-sample-*.webp
```

## 6. 校验

```bash
python3 scripts/verify.py --catalogs   # 字段、全局 ID、敏感布尔值、本地资产
```

发布脚本（`scripts/build.sh`）在生产快照换入前会自动跑这条校验，`--skip-verify` 仅应急。
