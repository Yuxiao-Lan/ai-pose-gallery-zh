#!/usr/bin/env bash
# 生产与测试环境说明见 docs/local-run.md。
set -euo pipefail

usage() {
  cat <<'EOF'
用法：
  bash scripts/build.sh [--allow-branch <name>] [--allow-untracked]
      生产：默认仅允许 main，拒绝未跟踪的 data/、thumbs/、img/ 文件；成功后发布到 dist/
      --allow-branch <name>  将本次生产发布要求的分支改为 <name>
      --allow-untracked      允许本次生产发布包含未跟踪的资产
  bash scripts/build.sh --test
      测试：构建 dist-test.next/，类型检查通过后替换 dist-test/，不复制静态资产
  bash scripts/build.sh -h|--help
      显示用法；--test 和帮助选项不能与其他参数组合
EOF
}

usage_error() {
  usage >&2
  exit 2
}

out_dir=dist.next
required_branch=
allow_untracked=false
case "${1:-}" in
  --test)
    [[ $# == 1 ]] || usage_error
    out_dir=dist-test.next
    shift
    ;;
  -h|--help)
    [[ $# == 1 ]] || usage_error
    usage
    exit 0
    ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-branch)
      [[ -z "$required_branch" && -n "${2:-}" && "$2" != -* ]] || usage_error
      required_branch=$2
      shift 2
      ;;
    --allow-untracked)
      [[ "$allow_untracked" == false ]] || usage_error
      allow_untracked=true
      shift
      ;;
    *) usage_error ;;
  esac
done

cd "$(dirname "$0")/.."

# 同一检出内串行构建：并发会让 staging 目录互相覆盖。
exec 9>.build.lock
if ! flock -n 9; then
  echo "已有构建在运行（.build.lock），本次退出。" >&2
  exit 1
fi

if [[ ! -e dist && -d dist.prev ]]; then
  echo "检测到上次发布中断：恢复 dist.prev/ 到 dist/。"
  mv -T dist.prev dist
fi

if [[ "$out_dir" == dist.next ]]; then
  required_branch=${required_branch:-main}
  current_branch=$(git symbolic-ref --quiet --short HEAD || true)
  if [[ -z "$current_branch" ]]; then
    echo '发布中止：当前处于 detached HEAD，无法确认发布分支。' >&2
    exit 1
  fi
  if [[ "$current_branch" != "$required_branch" ]]; then
    printf '发布中止：当前分支 %s，要求分支 %s。\n' "$current_branch" "$required_branch" >&2
    exit 1
  fi

  if [[ "$allow_untracked" == false ]]; then
    asset_status=$(git status --porcelain --ignored --untracked-files=all -- data thumbs img)
    untracked_assets=()
    while IFS= read -r entry; do
      case "$entry" in
        '?? '*|'!! '*) untracked_assets+=("${entry:3}") ;;
      esac
    done <<< "$asset_status"
    if [[ ${#untracked_assets[@]} -gt 0 ]]; then
      printf '发布中止：发现 %d 个未跟踪/被忽略资产（最多列出 20 个）：\n' "${#untracked_assets[@]}" >&2
      printf '  %s\n' "${untracked_assets[@]:0:20}" >&2
      echo '请先跟踪资产，或显式使用 --allow-untracked。' >&2
      exit 1
    fi
  fi
fi

if [ ! -d "node_modules" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
  else
    npm install
  fi
fi

# Vite 的路由插件先生成路由树，新增路由才能通过类型检查。
npx vite build --outDir "$out_dir" --emptyOutDir
npx tsc -b

if [[ "$out_dir" == dist-test.next ]]; then
  rm -rf dist-test
  mv -T "$out_dir" dist-test
  echo "dist-test ready:"
  du -sh dist-test
  find dist-test -type f | wc -l
  echo "预览：http://localhost:8651"
  exit 0
fi

cp -R _headers robots.txt sitemap.xml og-cover.jpg data thumbs img dist.next/

rm -rf dist.prev
if [ -e dist ]; then
  mv -T dist dist.prev
fi
if ! mv -T dist.next dist; then
  if [ -e dist.prev ]; then
    mv -T dist.prev dist
  fi
  exit 1
fi

echo "dist ready"
