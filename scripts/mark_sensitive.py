#!/usr/bin/env python3
"""把三库的敏感内容从「体系/分类黑名单」迁移为逐条 `敏感` 布尔字段。

用法（仓库根目录）:
    python3 scripts/mark_sensitive.py --dry-run   # 只报告，不写文件
    python3 scripts/mark_sensitive.py             # 写入 data/*-zh.json
    python3 scripts/mark_sensitive.py --check     # 校验字段与旧谓词等价

规则（与迁移前的 Web / ComfyUI 判定一致）:
- 姿势：`体系` 属于 {全身单人・性感系, 双人缠绵}
- 服装：已有 `敏感 === true`，或 `分类` 属于 {内衣・睡衣, 性感穿搭}
- 人像：迁移前没有隐藏逻辑，全部为 false

`敏感` 只加不改，写在每条记录末尾；保持原文件的缩进与换行风格。
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

POSES = ROOT / "data/pose-zh.json"
COSTUMES = [
    ROOT / "data/costume-zh.json",
    ROOT / "data/costume-anime-zh.json",
    ROOT / "data/costume-gia-anime-zh.json",
    ROOT / "data/costume-shisei-zh.json",
]
PORTRAITS = ROOT / "data/portrait-zh.json"

NSFW_POSE_SYSTEMS = {"全身单人・性感系", "双人缠绵"}
NSFW_COSTUME_CATEGORIES = {"内衣・睡衣", "性感穿搭"}


def legacy_sensitive(kind: str, row: dict) -> bool:
    if kind == "pose":
        return row.get("体系") in NSFW_POSE_SYSTEMS
    if kind == "costume":
        return row.get("敏感") is True or row.get("分类") in NSFW_COSTUME_CATEGORIES
    return False


def detect_style(text: str):
    newline = "\r\n" if "\r\n" in text else "\n"
    match = re.search(r"\n([ \t]+)\{", text)
    indent = len(match.group(1)) if match else 2
    trailing = text.endswith(("\n", "\r"))
    return newline, indent, trailing


def load(path: Path):
    raw = path.read_bytes().decode("utf-8")
    return raw, json.loads(raw)


def dump(rows, newline: str, indent: int, trailing: bool) -> str:
    text = json.dumps(rows, ensure_ascii=False, indent=indent).replace("\n", newline)
    return text + newline if trailing else text


def plan(kind: str, rows):
    expected = {row["id"]: legacy_sensitive(kind, row) for row in rows}
    added = sum(1 for row in rows if expected[row["id"]] and row.get("敏感") is not True)
    return expected, added


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="只报告，不写文件")
    parser.add_argument("--check", action="store_true", help="校验字段与旧谓词等价，不写文件")
    args = parser.parse_args()

    targets = [("pose", POSES), *[("costume", path) for path in COSTUMES], ("portrait", PORTRAITS)]
    total_changed = 0
    failures = 0

    for kind, path in targets:
        if not path.exists():
            print(f"跳过（不存在）: {path}")
            continue
        raw, rows = load(path)
        newline, indent, trailing = detect_style(raw)
        before = sum(1 for row in rows if row.get("敏感") is True)
        expected, added = plan(kind, rows)
        sensitive_ids = {key for key, value in expected.items() if value}

        if args.check:
            mismatched = [
                row["id"] for row in rows
                if (row.get("敏感") is True) != expected[row["id"]]
            ]
            if mismatched:
                failures += len(mismatched)
                print(f"✗ {path.name}: {len(mismatched)} 条与旧谓词不一致，例如 {mismatched[:5]}")
            else:
                print(f"✓ {path.name}: {len(rows)} 条，隐藏 {len(sensitive_ids)} 条，字段与旧谓词一致")
            continue

        total_changed += added
        print(
            f"{path.name}: 共 {len(rows)} 条，隐藏 {len(sensitive_ids)} 条"
            f"（新增标记 {added}，原有标记 {before}）"
        )
        if not args.dry_run:
            for row in rows:
                row["敏感"] = expected[row["id"]]
            path.write_bytes(dump(rows, newline, indent, trailing).encode("utf-8"))

    if args.check:
        raise SystemExit(1 if failures else 0)

    if args.dry_run:
        print(f"dry-run：未写文件；将新增 {total_changed} 条标记")
    else:
        print(f"完成：新增 {total_changed} 条标记")


if __name__ == "__main__":
    main()
