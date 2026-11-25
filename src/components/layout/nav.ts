import {
  BookOpenIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  PersonStandingIcon,
  ShirtIcon,
  SparklesIcon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react'
import { SERIES_LIST, type SeriesDef, type SeriesId } from '@/lib/series'

export type NavTarget =
  | { to: '/$series'; params: { series: SeriesId } }
  | { to: '/$series/poses'; params: { series: SeriesId } }
  | { to: '/$series/costumes'; params: { series: SeriesId } }
  | { to: '/$series/portraits'; params: { series: SeriesId } }
  | { to: '/studio' }
  | { to: '/settings' }
  | { to: '/guide' }

export interface NavItem {
  title: string
  target: NavTarget
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export function navGroupsFor(series: SeriesDef): NavGroup[] {
  return [
    {
      label: '工作台',
      items: [
        { title: '图库总览', target: { to: '/$series', params: { series: series.id } }, icon: LayoutDashboardIcon },
        { title: 'AI 角色合成台', target: { to: '/studio' }, icon: SparklesIcon, badge: 'PRO' },
      ],
    },
    {
      label: series.id === 'bears' ? '胖熊系列图库' : '通用参考图库',
      items: [
        { title: '动作姿势库', target: { to: '/$series/poses', params: { series: series.id } }, icon: PersonStandingIcon },
        { title: '服装穿搭库', target: { to: '/$series/costumes', params: { series: series.id } }, icon: ShirtIcon },
        { title: '人像颜值库', target: { to: '/$series/portraits', params: { series: series.id } }, icon: UserRoundIcon },
      ],
    },
    {
      label: '配置与说明',
      items: [
        { title: 'API 接口配置', target: { to: '/settings' }, icon: KeyRoundIcon },
        { title: '使用说明与免责声明', target: { to: '/guide' }, icon: BookOpenIcon },
      ],
    },
  ]
}

export function navPath(target: NavTarget): string {
  if ('params' in target) return target.to.replace('$series', target.params.series)
  return target.to
}

const allItems = SERIES_LIST.flatMap((series) => navGroupsFor(series).flatMap((group) => group.items))

export function activeNavTo(pathname: string): string | undefined {
  let best: string | undefined
  for (const { target } of allItems) {
    const path = navPath(target)
    const hit = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
    if (hit && (!best || path.length > best.length)) best = path
  }
  return best
}
