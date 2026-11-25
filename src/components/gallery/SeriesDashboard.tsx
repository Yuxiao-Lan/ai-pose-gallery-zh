import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CheckIcon,
  FlameIcon,
  LayersIcon,
  PersonStandingIcon,
  RulerIcon,
  PlusIcon,
  ShirtIcon,
  UserRoundIcon,
} from 'lucide-react'
import { bodyQueryFor, buildPoseGroups, costumesQueryFor, portraitsQueryFor, posesQueryFor } from '@/api/gallery'
import { isSensitive } from '@/lib/nsfw'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useStudio } from '@/store/studioStore'
import type { SeriesDef } from '@/lib/series'
import { referenceImageUrl } from '@/lib/recipeImages'


export function SeriesDashboard({ series }: { series: SeriesDef }) {
  const { data: posesData } = useSuspenseQuery(posesQueryFor(series.id))
  const { data: costumes } = useSuspenseQuery(costumesQueryFor(series.id))
  const { data: portraits } = useSuspenseQuery(portraitsQueryFor(series.id))
  const { data: bodyItems } = useSuspenseQuery(bodyQueryFor(series.id))
  const { recipe, togglePortrait, safeMode } = useStudio()

  const visiblePoses = safeMode ? posesData.items.filter((item) => !isSensitive(item)) : posesData.items
  const visibleGroups = safeMode ? buildPoseGroups(visiblePoses, series.angles).groups : posesData.groups
  const visibleCostumes = safeMode ? costumes.filter((item) => !isSensitive(item)) : costumes
  const visiblePortraits = safeMode ? portraits.filter((item) => !isSensitive(item)) : portraits
  const visibleBody = safeMode ? bodyItems.filter((item) => !isSensitive(item)) : bodyItems
  const topPortraits = series.allowRecipe ? visiblePortraits.filter((p) => p.热门).slice(0, 10) : []
  const totalImages = visiblePoses.length + visibleCostumes.length + visiblePortraits.length + visibleBody.length
  const realisticCostumes = costumes.filter((item) => (item.一级分类 || '现实') === '现实').length
  const animeCostumes = costumes.length - realisticCostumes
  const hairCount = new Set(portraits.map((item) => item.发型名称).filter(Boolean)).size
  const posesHaveDepth = posesData.items.some((item) => item.hasDepth !== false && !item.缩略图.startsWith('thumbs/bears/'))

  return (
    <>
      <PageHeader title={`${series.title} · 参考库`} />

      {/* 核心数据指标卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="总参考图"
          value={totalImages.toLocaleString('zh-CN')}
          icon={<LayersIcon />}
          desc="本地参考图"
        />
        <StatCard
          title="动作姿势 (Pose)"
          value={`${visibleGroups.length} 组`}
          icon={<PersonStandingIcon />}
          desc={`${visiblePoses.length} 张 · ${posesHaveDepth ? '白模/深度' : '本地参考图'}`}
        />
        <StatCard
          title="服装穿搭 (Costume)"
          value={`${visibleCostumes.length.toLocaleString('zh-CN')} 套`}
          icon={<ShirtIcon />}
          desc={series.showProvenance ? `现实 ${realisticCostumes} · 二次元 ${animeCostumes}` : '本地收录'}
        />
        <StatCard
          title="人像颜值 (Portrait)"
          value={`${visiblePortraits.length.toLocaleString('zh-CN')} 张`}
          icon={<UserRoundIcon />}
          desc={series.showProvenance ? `CC0 协议 · ${hairCount} 款发型` : `${hairCount} 款发型`}
        />
        {series.libraries.body && (
          <StatCard
            title="身材参考 (Body)"
            value={`${visibleBody.length.toLocaleString('zh-CN')} 张`}
            icon={<RulerIcon />}
            desc="体型与视角参考"
          />
        )}
      </div>

      {/* 核心图库入口卡片 */}
      <div className={`grid gap-3 sm:gap-4 ${series.libraries.body ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <Link
          to="/$series/poses"
          params={{ series: series.id }}
          className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">🕺 动作姿势库</h2>
            <Badge variant="secondary">{visiblePoses.length.toLocaleString('zh-CN')}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {visibleGroups.slice(0, 4).map((g) => (
              <img
                key={g.key}
                src={`/${g.order[0].缩略图}`}
                alt={g.name}
                loading="lazy"
                className="aspect-3/4 w-full rounded-lg bg-background object-cover"
              />
            ))}
          </div>
        </Link>

        <Link
          to="/$series/costumes"
          params={{ series: series.id }}
          className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">👗 服装穿搭库</h2>
            <Badge variant="secondary">{visibleCostumes.length.toLocaleString('zh-CN')}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {visibleCostumes.slice(0, 4).map((c) => (
              <img
                key={c.id}
                src={referenceImageUrl(c.缩略图)}
                alt={c.服装名称}
                loading="lazy"
                className="aspect-3/4 w-full rounded-lg bg-background object-cover"
              />
            ))}
          </div>
        </Link>

        <Link
          to="/$series/portraits"
          params={{ series: series.id }}
          className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">👤 人像颜值库</h2>
            <Badge variant="secondary">{visiblePortraits.length.toLocaleString('zh-CN')}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {visiblePortraits.slice(0, 4).map((p) => (
              <img
                key={p.id}
                src={`/${p.缩略图}`}
                alt={p.标题}
                loading="lazy"
                className="aspect-3/4 w-full rounded-lg bg-background object-cover"
              />
            ))}
          </div>
        </Link>

        {series.libraries.body && (
          <Link
            to="/$series/body"
            params={{ series: series.id }}
            className="group flex flex-col justify-between rounded-[20px] bg-muted p-4 transition hover:bg-muted/70"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">🧍 身材参考库</h2>
              <Badge variant="secondary">{visibleBody.length.toLocaleString('zh-CN')}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {visibleBody.slice(0, 4).map((item) => (
                <img
                  key={item.id}
                  src={referenceImageUrl(item.缩略图)}
                  alt={item.体型名称}
                  loading="lazy"
                  className="aspect-3/4 w-full rounded-lg bg-background object-cover"
                />
              ))}
            </div>
          </Link>
        )}
      </div>

      {/* 热门人像 Top10 速选区 */}
      {topPortraits.length > 0 && (
        <section className="rounded-[20px] bg-muted p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
              <FlameIcon className="size-4 text-orange-500" />
              热门人像 Top 10
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/$series/portraits" params={{ series: series.id }}>
                全部
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
            {topPortraits.map((item, idx) => {
              const picked = recipe.portrait?.id === item.id
              return (
                <div
                  key={item.id}
                  onClick={() => togglePortrait(item)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl bg-background transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-4/5 overflow-hidden">
                    <img
                      src={`/${item.缩略图}`}
                      alt={item.标题}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <span className="absolute top-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      #{idx + 1}
                    </span>
                    <span
                      className={`absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full text-white shadow ${
                        picked ? 'bg-emerald-600' : 'bg-black/65 group-hover:bg-primary'
                      }`}
                    >
                      {picked ? <CheckIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
                    </span>
                  </div>
                  <div className="p-1.5">
                    <div className="truncate text-[11px] font-medium">{item.发型名称}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 底部免责声明提示条 */}
      <footer className="rounded-[18px] border border-border/60 bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        {series.showProvenance ? (
          <>
            <strong className="text-foreground">⚠️ 免责声明：</strong>
            本站原有姿势与现实服饰参考图源自 X 创作者{' '}
            <a href="https://x.com/giaaibusi" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              ギア (@giaaibusi)
            </a>{' '}
            公开分享。新增二次元服装来自 たき AI · CharaDB，仅收录元数据，图片从来源站点读取，各素材适用各自条件。默认已开启「安全模式 (SFW)」隐藏 18+ 敏感条目，未满 18 周岁请勿关闭。本工具与素材
            <strong className="text-foreground">仅供个人学习与合法艺术创作使用，严禁用于任何违法违规或侵害他人肖像权用途</strong>。{' '}
            <Link to="/guide" className="font-medium text-primary underline">查看完整免责声明 →</Link>
          </>
        ) : (
          <>
            <strong className="text-foreground">⚠️ 说明：</strong>
            本系列为独立收录的参考图库，默认隐藏逐条标记的 18+ 内容；未满 18 周岁请勿关闭安全模式。素材仅供个人学习与合法艺术创作使用。
          </>
        )}
      </footer>

    </>
  )
}
