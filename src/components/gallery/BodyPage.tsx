import { useSuspenseQuery } from '@tanstack/react-query'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SearchIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { bodyQueryFor } from '@/api/gallery'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { ZoomViewport } from '@/components/common/ZoomViewport'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { isSensitive } from '@/lib/nsfw'
import { referenceImageUrl } from '@/lib/recipeImages'
import { cn } from '@/lib/utils'
import type { SeriesDef } from '@/lib/series'
import { useStudio } from '@/store/studioStore'

export function BodyPage({ series }: { series: SeriesDef }) {
  const { data: allItems } = useSuspenseQuery(bodyQueryFor(series.id))
  const { safeMode, requestUnlockNsfw } = useStudio()

  const [category, setCategory] = useState('')
  const [angle, setAngle] = useState('')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(60)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const baseItems = useMemo(
    () => (safeMode ? allItems.filter((item) => !isSensitive(item)) : allItems),
    [allItems, safeMode]
  )
  const hiddenNsfwCount = allItems.length - baseItems.length

  const categories = useMemo(() => [...new Set(baseItems.map((item) => item.体型分类))], [baseItems])
  const activeCategory = category && categories.includes(category) ? category : ''

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    return baseItems.filter((item) => {
      if (activeCategory && item.体型分类 !== activeCategory) return false
      if (angle && item.视角 !== angle) return false
      if (q && !`${item.检索} ${item.id}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [baseItems, activeCategory, angle, q])

  const currentItem = viewerIndex !== null ? filtered[viewerIndex] : null

  useEffect(() => {
    setViewerIndex(null)
  }, [safeMode])

  const reset = () => {
    setCategory('')
    setAngle('')
    setQuery('')
    setShown(60)
  }

  return (
    <>
      <PageHeader
        title="身材参考库"
        actions={
          hiddenNsfwCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => requestUnlockNsfw(() => reset())}>
              🔒 解锁 18+ 敏感内容 ({hiddenNsfwCount})
            </Button>
          )
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:pb-0">
        <button
          type="button"
          onClick={() => {
            setCategory('')
            setShown(60)
          }}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
            activeCategory === '' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          全部体型 ({baseItems.length})
        </button>
        {categories.map((item) => {
          const count = baseItems.filter((row) => row.体型分类 === item).length
          const hasSensitive = allItems.some((row) => row.体型分类 === item && isSensitive(row))
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item)
                setShown(60)
              }}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                activeCategory === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {item} ({count}){hasSensitive ? ' · 18+' : ''}
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 rounded-[22px] bg-muted p-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setShown(60)
            }}
            placeholder="搜索体型、标签或 ID…"
            className="bg-background pl-9"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-background p-1">
          {['', ...series.angles].map((item) => (
            <button
              key={item || 'all'}
              type="button"
              onClick={() => {
                setAngle(item)
                setShown(60)
              }}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition',
                angle === item ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {item || '全部视角'}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={reset}>
          重置
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={allItems.length === 0 ? '这个系列还没有身材参考' : '没有找到匹配的体型'}
          description={allItems.length === 0 ? '把图片按清单格式导入后即可在这里浏览' : '试试更换搜索词或切换体型分类'}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.slice(0, shown).map((item, index) => (
            <article key={item.id} className="group flex flex-col overflow-hidden rounded-[20px] bg-muted p-2 transition hover:-translate-y-0.5 hover:shadow-md">
              <button
                type="button"
                onClick={() => setViewerIndex(index)}
                className="relative aspect-3/4 cursor-zoom-in overflow-hidden rounded-2xl bg-background"
                aria-label={`查看 ${item.体型名称} 大图`}
              >
                <img
                  src={referenceImageUrl(item.缩略图)}
                  alt={item.体型名称}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-x-2 top-2 flex items-center justify-between gap-1">
                  <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">{item.id}</span>
                  <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900">{item.视角}</span>
                </span>
                {isSensitive(item) && (
                  <span className="absolute right-2 bottom-2 rounded-md bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">18+</span>
                )}
              </button>
              <div className="px-1.5 pt-2 pb-1">
                <div className="line-clamp-2 text-xs font-semibold">{item.体型名称}</div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{item.体型分类}</span>
                  {item.身高 ? <span>{item.身高} cm</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {filtered.length > shown && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setShown((n) => n + 60)}>
            加载更多
          </Button>
        </div>
      )}

      <Dialog open={currentItem !== null} onOpenChange={(open) => !open && setViewerIndex(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          {currentItem && (
            <>
              <DialogHeader>
                <DialogTitle>{currentItem.体型名称}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                <ZoomViewport imageUrl={referenceImageUrl(currentItem.原图)} alt={currentItem.体型名称} />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="上一张"
                      onClick={() => setViewerIndex((viewerIndex! - 1 + filtered.length) % filtered.length)}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {viewerIndex! + 1} / {filtered.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="下一张"
                      onClick={() => setViewerIndex((viewerIndex! + 1) % filtered.length)}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{currentItem.体型分类}</Badge>
                    <Badge variant="outline">{currentItem.视角}</Badge>
                    {isSensitive(currentItem) && <Badge variant="destructive">18+</Badge>}
                  </div>

                  <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">ID</dt>
                    <dd className="font-mono">{currentItem.id}</dd>
                    {currentItem.身高 ? (
                      <>
                        <dt className="text-muted-foreground">身高</dt>
                        <dd className="font-medium">{currentItem.身高} cm</dd>
                      </>
                    ) : null}
                    {currentItem.体重 ? (
                      <>
                        <dt className="text-muted-foreground">体重</dt>
                        <dd className="font-medium">{currentItem.体重} kg</dd>
                      </>
                    ) : null}
                    {currentItem.体脂 ? (
                      <>
                        <dt className="text-muted-foreground">体脂</dt>
                        <dd className="font-medium">{currentItem.体脂}%</dd>
                      </>
                    ) : null}
                    {currentItem.标签 && currentItem.标签.length > 0 ? (
                      <>
                        <dt className="text-muted-foreground">标签</dt>
                        <dd className="font-medium">{currentItem.标签.join(' · ')}</dd>
                      </>
                    ) : null}
                  </dl>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={referenceImageUrl(currentItem.原图)} download={`${currentItem.id}.webp`}>
                        <DownloadIcon className="size-3.5" />
                        下载原图
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={referenceImageUrl(currentItem.原图)} target="_blank" rel="noopener noreferrer">
                        <ExternalLinkIcon className="size-3.5" />
                        新窗口
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
