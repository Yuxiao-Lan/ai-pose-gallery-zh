import { queryOptions } from '@tanstack/react-query'
import type { CostumeItem, PortraitItem, PoseGroup, PoseItem } from '@/types/gallery'
import { SERIES, type SeriesId } from '@/lib/series'

export const ANGLES = ['正面', '俯视', '仰视', '侧面', '斜侧'] as const

export const PREFERRED_POSE_LINE_ORDER = [
  '全身单人・标准系',
  '上半身单人',
  '全身单人・性感系',
  '双人缠绵',
  '全身・单人',
  '半身・单人',
  '局部・特写',
  '双人・互动',
] as const

export function sortPoseLines(lines: Iterable<string>): string[] {
  return [...new Set(lines)].sort((a, b) => {
    const ia = PREFERRED_POSE_LINE_ORDER.indexOf(a as (typeof PREFERRED_POSE_LINE_ORDER)[number])
    const ib = PREFERRED_POSE_LINE_ORDER.indexOf(b as (typeof PREFERRED_POSE_LINE_ORDER)[number])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

export function buildPoseGroups(
  items: PoseItem[],
  angles: readonly string[] = ANGLES
): { items: PoseItem[]; groups: PoseGroup[]; lines: string[] } {
  const lines = sortPoseLines(items.map((x) => x.体系))
  const groupMap = new Map<string, PoseGroup>()
  const groups: PoseGroup[] = []

  for (const item of items) {
    const key = `${item.体系}|${item.姿势编号 || item.id}`
    let group = groupMap.get(key)
    if (!group) {
      group = {
        key,
        system: item.体系,
        number: item.姿势编号,
        name: item.姿势名称,
        category: item.分类,
        items: [],
        angles: {},
        order: [],
      }
      groupMap.set(key, group)
      groups.push(group)
    }
    group.items.push(item)
    if (item.角度 && !group.angles[item.角度]) {
      group.angles[item.角度] = item
    }
  }

  groups.sort((a, b) => lines.indexOf(a.system) - lines.indexOf(b.system) || String(a.number).localeCompare(String(b.number)))
  for (const group of groups) {
    group.order = angles.map((a) => group.angles[a]).filter(Boolean)
    for (const item of group.items) {
      if (!group.order.includes(item)) group.order.push(item)
    }
  }

  return { items, groups, lines }
}

/**
 * 读取图库 JSON。
 * 胖熊系列的目录允许缺失或为空数组（视为空库）；通用系列缺失或格式错误必须报错，
 * 避免把「数据坏了」静默显示成「没有数据」。
 */
async function fetchItems<T>(url: string, series: SeriesId, label: string): Promise<T[]> {
  const res = await fetch(url)
  const allowMissing = series !== 'general'
  if (res.status === 404) {
    if (allowMissing) return []
    throw new Error(`加载${label}失败: HTTP 404 (${url})`)
  }
  if (!res.ok) throw new Error(`加载${label}失败: HTTP ${res.status} (${url})`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error(`${label}数据格式错误：期望数组 (${url})`)
  return data as T[]
}

export function posesQueryFor(series: SeriesId) {
  const def = SERIES[series]
  return queryOptions({
    queryKey: ['gallery', series, 'poses'],
    staleTime: Infinity,
    queryFn: async () => {
      if (!def.libraries.poses) return buildPoseGroups([], def.angles)
      const data = await fetchItems<PoseItem>(`/${def.libraries.poses}`, series, '姿势数据')
      return buildPoseGroups(data, def.angles)
    },
  })
}

export function costumesQueryFor(series: SeriesId) {
  const def = SERIES[series]
  return queryOptions({
    queryKey: ['gallery', series, 'costumes'],
    staleTime: Infinity,
    queryFn: async () => {
      if (!def.libraries.costumes) return []
      const lists = await Promise.all(
        def.libraries.costumes.map((path) => fetchItems<CostumeItem>(`/${path}`, series, '服装数据'))
      )
      return lists.flat()
    },
  })
}

export function portraitsQueryFor(series: SeriesId) {
  const def = SERIES[series]
  return queryOptions({
    queryKey: ['gallery', series, 'portraits'],
    staleTime: Infinity,
    queryFn: async () => {
      if (!def.libraries.portraits) return []
      return fetchItems<PortraitItem>(`/${def.libraries.portraits}`, series, '人像数据')
    },
  })
}

/** 通用系列查询：合成台与全局随机仍只用这一套。 */
export const posesQuery = posesQueryFor('general')
export const costumesQuery = costumesQueryFor('general')
export const portraitsQuery = portraitsQueryFor('general')
