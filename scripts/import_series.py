#!/usr/bin/env python3
"""清单驱动导入胖熊系列图片。

用法（仓库根目录）:
    python3 scripts/import_series.py --manifest ~/incoming/bears/manifest.csv --dry-run
    python3 scripts/import_series.py --manifest ~/incoming/bears/manifest.csv
    python3 scripts/import_series.py --manifest ... --prune

清单列（UTF-8 CSV，首行表头）:
    id,库,体系,分类,名称,视角,组,标签,敏感,文件
    以及可选列: 发长,身高,体重,体脂

约定:
- `库` 为 pose / costume / portrait / body；`敏感` 必须显式 1 或 0。
- `id` 留空时按 `bear-<库>-<四位序号>` 分配，并持久化到 data/bears/ids.json。
- `组` 仅姿势使用，必须是 `g-...`，同组共用体系/分类且视角不重复。
- 图片只在清单目录内解析；输出 thumb 宽 300、原图长边 ≤ 1600、单张 ≤ 2 MB 的 WebP。
- `--prune` 移除清单外的旧条目（保留图片与退役 ID，不复用）。
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOT = Path.home() / "incoming/bears"
SERIES = "bears"
DATA_DIR = ROOT / "data" / SERIES
ASSET_DIR = ROOT / "img" / SERIES
THUMB_DIR = ROOT / "thumbs" / SERIES
LIBRARIES = {"pose", "costume", "portrait", "body"}
ID_RE = re.compile(r"^bear-[a-z0-9]+(?:-[a-z0-9]+)*$")
GROUP_RE = re.compile(r"^g-[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_OUTPUT_BYTES = 2 * 1024 * 1024
FULL_MAX_SIDE = 1600
THUMB_WIDTH = 300


def fail(message: str) -> None:
    print(f"错误：{message}", file=sys.stderr)
    raise SystemExit(1)


def load_meta() -> dict:
    return json.loads((DATA_DIR / "meta-zh.json").read_text(encoding="utf-8"))


def load_ids() -> dict:
    path = DATA_DIR / "ids.json"
    if not path.exists():
        return {"next": {lib: 1 for lib in LIBRARIES}, "byPath": {}, "retired": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("next", {lib: 1 for lib in LIBRARIES})
    data.setdefault("byPath", {})
    data.setdefault("retired", [])
    return data


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def parse_bool(value: str, line: int) -> bool:
    text = (value or "").strip()
    if text not in ("0", "1"):
        fail(f"第 {line} 行：敏感 必须是 0 或 1（当前 {value!r}）")
    return text == "1"


def resolve(root: Path, relative: str, line: int) -> Path:
    if not relative or Path(relative).is_absolute():
        fail(f"第 {line} 行：文件必须是相对路径")
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        fail(f"第 {line} 行：文件越出清单目录（{relative}）")
    if not candidate.is_file():
        fail(f"第 {line} 行：文件不存在（{relative}）")
    return candidate


def ensure_bytes(im: Image.Image, path: Path, quality: int = 82) -> None:
    im.save(path, "WEBP", quality=quality, method=4)
    if path.stat().st_size <= MAX_OUTPUT_BYTES:
        return
    for q in (72, 62, 52):
        im.save(path, "WEBP", quality=q, method=4)
        if path.stat().st_size <= MAX_OUTPUT_BYTES:
            return
    fail(f"压缩后仍超过 2 MB：{path}")


def process_images(source: Path, library: str, item_id: str, dry: bool) -> tuple[str, str, int, int, int]:
    rel_thumb = f"thumbs/{SERIES}/{library}/{item_id}.webp"
    rel_full = f"img/{SERIES}/{library}/{item_id}.webp"
    with Image.open(source) as raw:
        im = raw.convert("RGB")
    width, height = im.size
    if not dry:
        full = im.copy()
        full.thumbnail((FULL_MAX_SIDE, FULL_MAX_SIDE), Image.LANCZOS)
        full_path = ROOT / rel_full
        full_path.parent.mkdir(parents=True, exist_ok=True)
        ensure_bytes(full, full_path)

        thumb = im.copy()
        thumb.thumbnail((THUMB_WIDTH, THUMB_WIDTH * 2), Image.LANCZOS)
        thumb_path = ROOT / rel_thumb
        thumb_path.parent.mkdir(parents=True, exist_ok=True)
        ensure_bytes(thumb, thumb_path)
        output_bytes = full_path.stat().st_size
    if dry:
        output_bytes = source.stat().st_size

    return rel_thumb, rel_full, width, height, output_bytes


def build_row(library: str, row: dict, item_id: str, meta: dict, assets: dict) -> dict:
    name = row["名称"].strip()
    tags = [t.strip() for t in re.split(r"[,，]", row.get("标签", "")) if t.strip()]
    search = " ".join([item_id, row["分类"].strip(), name, row["视角"].strip(), *tags]).strip()
    common = {"id": item_id, "缩略图": assets["thumb"], "原图": assets["full"], "检索": search, "敏感": assets["sensitive"]}

    if library == "pose":
        return {
            **common,
            "体系": row["体系"].strip(),
            "姿势编号": row["组"].strip() or item_id,
            "分类": row["分类"].strip(),
            "姿势名称": name,
            "角度": row["视角"].strip(),
            "hasDepth": False,
        }
    if library == "costume":
        return {
            **common,
            "分类": row["分类"].strip(),
            "服装名称": name,
            "标签": tags,
            "关键词": " ".join(tags),
            "预览图": assets["full"],
            "一级分类": "现实",
        }
    if library == "portrait":
        return {
            **common,
            "分区": row["分类"].strip(),
            "发长": row.get("发长", "").strip(),
            "发型名称": name,
            "标题": name,
            "宽": assets["width"],
            "高": assets["height"],
            "字节数": assets["bytes"],
            "精选": False,
            "热门": False,
        }
    result = {
        **common,
        "体型分类": row["分类"].strip(),
        "体型名称": name,
        "视角": row["视角"].strip(),
        "标签": tags,
    }
    for key in ("身高", "体重", "体脂"):
        value = row.get(key, "").strip()
        if value:
            try:
                result[key] = int(float(value))
            except ValueError:
                fail(f"{item_id}：{key} 必须是数字（当前 {value!r}）")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", required=True, help="manifest.csv 路径")
    parser.add_argument("--root", default=str(DEFAULT_ROOT), help="收图根目录（默认 ~/incoming/bears）")
    parser.add_argument("--dry-run", action="store_true", help="只校验，不写文件")
    parser.add_argument("--prune", action="store_true", help="移除清单外条目（保留图片与退役 ID）")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    manifest = Path(args.manifest).expanduser().resolve()
    if not manifest.is_file():
        fail(f"清单不存在：{manifest}")
    if not root.is_dir():
        fail(f"收图目录不存在：{root}")

    meta = load_meta()
    ids = load_ids()
    rows = list(csv.DictReader(manifest.open(encoding="utf-8-sig")))
    if not rows:
        fail("清单为空")

    seen_ids: set[str] = set()
    seen_paths: set[str] = set()
    groups: dict[str, tuple[str, str, set[str]]] = {}
    by_library: dict[str, list[dict]] = {lib: [] for lib in LIBRARIES}

    for line, row in enumerate(rows, start=2):
        library = (row.get("库") or "").strip()
        if library not in LIBRARIES:
            fail(f"第 {line} 行：库 必须是 {sorted(LIBRARIES)}（当前 {library!r}）")
        for column in ("分类", "名称", "视角", "文件"):
            if not (row.get(column) or "").strip():
                fail(f"第 {line} 行：{column} 不能为空")
        sensitive = parse_bool(row.get("敏感", ""), line)

        relative = row["文件"].strip()
        if relative in seen_paths:
            fail(f"第 {line} 行：文件重复（{relative}）")
        seen_paths.add(relative)
        source = resolve(root, relative, line)

        item_id = (row.get("id") or "").strip()
        if item_id:
            if not ID_RE.match(item_id):
                fail(f"第 {line} 行：id 必须匹配 {ID_RE.pattern}")
        else:
            key = f"{library}:{relative}"
            item_id = ids["byPath"].get(key) or f"bear-{library}-{ids['next'][library]:04d}"
            if key not in ids["byPath"]:
                ids["byPath"][key] = item_id
                ids["next"][library] += 1
        if item_id in seen_ids or item_id in ids.get("retired", []):
            fail(f"第 {line} 行：id 重复或已退役（{item_id}）")
        seen_ids.add(item_id)

        category = row["分类"].strip()
        angle = row["视角"].strip()
        if angle not in meta["视角"]:
            fail(f"第 {line} 行：视角 必须是 {meta['视角']}（当前 {angle!r}）")

        if library == "pose":
            if row["体系"].strip() not in meta["姿势体系"]:
                fail(f"第 {line} 行：体系 必须是 {meta['姿势体系']}")
            if category not in meta["姿势分类"]:
                fail(f"第 {line} 行：分类 必须是 {meta['姿势分类']}")
            group = (row.get("组") or "").strip()
            if group:
                if not GROUP_RE.match(group):
                    fail(f"第 {line} 行：组 必须匹配 {GROUP_RE.pattern}")
                if group in seen_ids:
                    fail(f"第 {line} 行：组与已有 id 冲突（{group}）")
                meta_key = (row["体系"].strip(), category)
                if group in groups:
                    if groups[group][:2] != meta_key:
                        fail(f"第 {line} 行：同组必须使用同一体系/分类（{group}）")
                    if angle in groups[group][2]:
                        fail(f"第 {line} 行：同组视角重复（{group} / {angle}）")
                    groups[group][2].add(angle)
                else:
                    groups[group] = (meta_key[0], meta_key[1], {angle})
        elif library == "costume":
            if category not in meta["服装分类"]:
                fail(f"第 {line} 行：分类 必须是 {meta['服装分类']}")
            if (row.get("组") or "").strip():
                fail(f"第 {line} 行：服装不支持分组")
        elif library == "portrait":
            if category not in meta["人像分区"]:
                fail(f"第 {line} 行：分类 必须是 {meta['人像分区']}")
            hair = (row.get("发长") or "").strip()
            if hair and hair not in meta["人像发长"]:
                fail(f"第 {line} 行：发长 必须是 {meta['人像发长']}")
        else:
            if category not in meta["体型分类"]:
                fail(f"第 {line} 行：分类 必须是 {meta['体型分类']}")

        # 标签不做白名单校验：词表用于筛选提示，允许自由扩展
        thumb, full, width, height, size = process_images(source, library, item_id, args.dry_run)
        assets = {
            "thumb": thumb,
            "full": full,
            "width": width,
            "height": height,
            "bytes": size,
            "sensitive": sensitive,
        }
        by_library[library].append(build_row(library, row, item_id, meta, assets))

    removed_ids: set[str] = set()
    for library, new_rows in by_library.items():
        path = DATA_DIR / f"{library}-zh.json"
        old_rows = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        if args.prune:
            keep = {row["id"] for row in new_rows}
            removed_ids |= {row["id"] for row in old_rows if row["id"] not in keep}
            old_rows = [row for row in old_rows if row["id"] in keep]
        merged = {row["id"]: row for row in old_rows}
        for row in new_rows:
            merged[row["id"]] = row
        ordered = sorted(merged.values(), key=lambda item: item["id"])
        if not args.dry_run:
            save_json(path, ordered)
        print(f"{path.name}: {len(new_rows)} 条来自清单，合计 {len(ordered)} 条" + ("（dry-run）" if args.dry_run else ""))

    if removed_ids:
        ids["retired"] = sorted(set(ids.get("retired", [])) | removed_ids)
        print(f"prune：移除 {len(removed_ids)} 条，ID 已退役")
    if not args.dry_run:
        save_json(DATA_DIR / "ids.json", ids)


if __name__ == "__main__":
    main()
