import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ExternalLinkIcon, LayersIcon, SparklesIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useStudio } from '@/store/studioStore'
import { DEFAULT_SERIES, SERIES, SERIES_LIST, isSeriesId, readStoredSeries, writeStoredSeries } from '@/lib/series'
import { activeNavTo, navGroupsFor, navPath } from './nav'

export function AppSidebar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const params = useParams({ strict: false }) as { series?: string }
  const navigate = useNavigate()
  const active = activeNavTo(pathname)
  const { recipe } = useStudio()
  const count = [recipe.portrait, recipe.costume, recipe.pose].filter(Boolean).length

  const seriesId = isSeriesId(params.series) ? params.series : readStoredSeries()
  const series = SERIES[seriesId] ?? SERIES[DEFAULT_SERIES]

  useEffect(() => {
    if (isSeriesId(params.series)) writeStoredSeries(params.series)
  }, [params.series])

  const switchSeries = (next: string) => {
    if (!isSeriesId(next)) return
    writeStoredSeries(next)
    const library = pathname.split('/')[2]
    if (library === 'costumes') navigate({ to: '/$series/costumes', params: { series: next } })
    else if (library === 'portraits') navigate({ to: '/$series/portraits', params: { series: next } })
    else navigate({ to: '/$series/poses', params: { series: next } })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <LayersIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">POSE &amp; CHARACTER</span>
                  <span className="truncate text-xs text-muted-foreground">AI 角色参考台</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="mt-1 px-1 group-data-[collapsible=icon]:hidden">
            <Select value={series.id} onValueChange={switchSeries}>
              <SelectTrigger aria-label="切换系列" className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERIES_LIST.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="text-xs">
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroupsFor(series).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const path = navPath(item.target)
                return (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton asChild isActive={path === active} tooltip={item.title}>
                      <Link {...item.target}>
                        <item.icon />
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] font-medium">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="当前角色配方">
              <Link to="/studio" className="bg-sidebar-accent/70 hover:bg-sidebar-accent">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SparklesIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <span className="truncate font-semibold">角色配方槽 ({count}/3)</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {count === 0 ? '未选择 · 点击去捏人' : '点击进入 AI 合成台'}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild tooltip="访问 GitHub 仓库">
              <a
                href="https://github.com/anhao/ai-pose-gallery-zh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground"
              >
                <ExternalLinkIcon className="size-3.5" />
                <span>GitHub · @anhao_ai</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
