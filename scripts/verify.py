# -*- coding: utf-8 -*-
"""校验：文件是否存在、大小是否正常、图片头是否合法（覆盖 Pose / Costume / Portrait）。

用法（在仓库根目录）: python3 scripts/verify.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JPEG = b"\xff\xd8\xff"
PNG = b"\x89PNG\r\n\x1a\n"
WEBP = b"RIFF"

CATALOG_FIELDS = {
    "pose": ("体系", "分类", "姿势名称", "角度", "缩略图", "原图"),
    "costume": ("分类", "服装名称", "缩略图", "预览图", "原图"),
    "portrait": ("分区", "发型名称", "缩略图", "原图"),
    "body": ("体型分类", "体型名称", "视角", "缩略图", "原图"),
}


def verify_catalogs():
    """校验 Web/ComfyUI 实际读取的 *-zh.json：字段、全局 ID、敏感布尔值、本地资产。"""
    data_dir = os.path.join(ROOT, "data")
    files = [
        ("pose", os.path.join(data_dir, "pose-zh.json")),
        ("costume", os.path.join(data_dir, "costume-zh.json")),
        ("costume", os.path.join(data_dir, "costume-anime-zh.json")),
        ("costume", os.path.join(data_dir, "costume-gia-anime-zh.json")),
        ("costume", os.path.join(data_dir, "costume-shisei-zh.json")),
        ("portrait", os.path.join(data_dir, "portrait-zh.json")),
        ("pose", os.path.join(data_dir, "bears/pose-zh.json")),
        ("costume", os.path.join(data_dir, "bears/costume-zh.json")),
        ("portrait", os.path.join(data_dir, "bears/portrait-zh.json")),
        ("body", os.path.join(data_dir, "bears/body-zh.json")),
    ]
    seen = {}
    errors = []
    total = 0
    for kind, path in files:
        if not os.path.exists(path):
            errors.append((path, "缺失目录文件"))
            continue
        with open(path, encoding="utf-8") as fh:
            rows = json.load(fh)
        if not isinstance(rows, list):
            errors.append((path, "顶层不是数组"))
            continue
        for row in rows:
            total += 1
            item_id = row.get("id")
            if not item_id or not isinstance(item_id, str) or any(ch.isspace() for ch in item_id):
                errors.append((path, f"非法 id: {item_id!r}"))
                continue
            if item_id in seen:
                errors.append((path, f"id 重复: {item_id}（另见 {seen[item_id]}）"))
            else:
                seen[item_id] = os.path.relpath(path, ROOT)
            for field in CATALOG_FIELDS[kind]:
                if not row.get(field):
                    errors.append((f"{path}:{item_id}", f"缺少字段 {field}"))
            if not isinstance(row.get("敏感"), bool):
                errors.append((f"{path}:{item_id}", "敏感 必须是布尔值"))
            assets = [row.get("缩略图"), row.get("原图"), row.get("预览图")]
            for view in row.get("views") or []:
                assets.extend([view.get("缩略图"), view.get("预览图"), view.get("原图")])
            for asset in assets:
                if not asset or not isinstance(asset, str):
                    continue
                if asset.startswith(("http://", "https://", "data:")):
                    continue
                local = os.path.join(ROOT, asset.lstrip("/"))
                if not os.path.isfile(local):
                    errors.append((f"{path}:{item_id}", f"资产不存在 {asset}"))
    print(f"目录条目 {total}，唯一 ID {len(seen)}，异常 {len(errors)}")
    for location, why in errors[:40]:
        print(" ", location, why)
    if len(errors) > 40:
        print(f" ... 其余 {len(errors) - 40} 条省略")
    return 1 if errors else 0


if "--catalogs" in sys.argv[1:]:
    sys.exit(verify_catalogs())

checks = []

# 1. Pose
pose_path = os.path.join(ROOT, "data", "pose.json")
if os.path.exists(pose_path):
    with open(pose_path, encoding="utf-8") as f:
        for item in json.load(f):
            checks.append((os.path.join(ROOT, item["サムネ"]), JPEG, "thumbs"))
            checks.append((os.path.join(ROOT, item["原寸"]), PNG, "img"))

# 2. Costume
costume_path = os.path.join(ROOT, "data", "costume.json")
if os.path.exists(costume_path):
    with open(costume_path, encoding="utf-8") as f:
        for item in json.load(f):
            cid = item["id"]
            checks.append((os.path.join(ROOT, "thumbs", "costume", f"{cid}.webp"), WEBP, "thumbs"))
            checks.append((os.path.join(ROOT, "img", "costume", f"{cid}.webp"), WEBP, "img"))

# 3. Portrait
portrait_path = os.path.join(ROOT, "data", "portrait.json")
if os.path.exists(portrait_path):
    with open(portrait_path, encoding="utf-8") as f:
        for item in json.load(f):
            pid = item["id"]
            checks.append((os.path.join(ROOT, "thumbs", "portrait", f"{pid}.webp"), WEBP, "thumbs"))
            checks.append((os.path.join(ROOT, "img", "portrait", f"{pid}.webp"), WEBP, "img"))

bad = []
total = 0
size_thumbs = size_img = 0
for p, magic, bucket in checks:
    total += 1
    if not os.path.exists(p):
        bad.append((p, "MISSING"))
        continue
    sz = os.path.getsize(p)
    if sz < 1024:
        bad.append((p, f"TOO_SMALL {sz}"))
        continue
    with open(p, "rb") as fh:
        head = fh.read(12)
    if magic == WEBP:
        if not (head.startswith(b"RIFF") and head[8:12] == b"WEBP"):
            bad.append((p, f"BAD_WEBP {head[:12]!r}"))
            continue
    elif not head.startswith(magic):
        bad.append((p, f"BAD_HEADER {head[:4]!r}"))
        continue
    if bucket == "thumbs":
        size_thumbs += sz
    else:
        size_img += sz

print(f"期望文件数 {total}，异常 {len(bad)}")
print(f"thumbs 合计 {size_thumbs/1048576:.1f} MB，img 合计 {size_img/1048576:.1f} MB，"
      f"总计 {(size_thumbs+size_img)/1048576:.1f} MB")
if bad:
    for p, why in bad[:40]:
        print(" ", p, why)
    with open(os.path.join(ROOT, "verify_failed.txt"), "w", encoding="utf-8") as f:
        for p, why in bad:
            f.write(f"{p}\t{why}\n")
    print("完整清单 -> verify_failed.txt")
    sys.exit(1)
print("全部通过 ✅")

