#!/usr/bin/env bash
# 构建发布目录。
#
# 用法（在仓库根目录，或任意位置调用本脚本）:
#   bash scripts/build.sh            # 生产：构建 dist/，并复制 data/thumbs/img（发布用）
#   bash scripts/build.sh --test     # 测试：只构建 dist-test/，静态资产由 Caddy 从仓库根直读
#
# 生产与测试环境说明见 docs/local-run.md。
set -euo pipefail

MODE=produce
case "${1:-}" in
  "")       MODE=produce ;;
  --test)   MODE=test ;;
  -h|--help)
    sed -n '2,10p' "$0"
    exit 0
    ;;
  *)
    echo "未知参数: $1（可用：--test）" >&2
    exit 2
    ;;
esac

cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
  else
    npm install
  fi
fi

if [ "$MODE" = "test" ]; then
  # 测试站：只出前端，秒级；data/thumbs/img 由 Caddy 的 :8651 直接指向仓库根。
  npx tsc -b
  npx vite build --outDir dist-test --emptyOutDir
  echo "dist-test ready:"
  du -sh dist-test
  find dist-test -type f | wc -l
  echo "预览：http://localhost:8651"
  exit 0
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm build
else
  npm run build
fi

cp -R _headers robots.txt sitemap.xml og-cover.jpg data thumbs img dist/

echo "dist ready:"
du -sh dist
find dist -type f | wc -l
