export type SeriesId = 'general' | 'bears'

export interface SeriesLibraries {
  /** 姿势库的 JSON 路径；null 表示该系列暂无此库 */
  poses: string | null
  /** 服装库可能由多个文件合并；null 表示暂无 */
  costumes: string[] | null
  portraits: string | null
  /** 身材库；null 表示该系列暂无 */
  body: string | null
}

export interface SeriesDef {
  id: SeriesId
  title: string
  subtitle: string
  /** 数据目录，拼接为 `${dataDir}/pose-zh.json` 等 */
  dataDir: string
  /** 图片目录前缀，空串表示仓库根 */
  imageDir: string
  /** 是否允许把该系列条目加入合成配方（本期仅通用系列） */
  allowRecipe: boolean
  /** 该系列使用的视角顺序，供分组、筛选和灯箱使用 */
  angles: readonly string[]
  libraries: SeriesLibraries
  /** 是否显示来源筛选与来源/许可声明（通用系列 true，胖熊系列 false） */
  showProvenance: boolean
}

const GENERAL_ANGLES = ['正面', '俯视', '仰视', '侧面', '斜侧'] as const
const BEARS_ANGLES = [...GENERAL_ANGLES, '背面'] as const

export const SERIES: Record<SeriesId, SeriesDef> = {
  general: {
    id: 'general',
    title: '通用系列',
    subtitle: '姿势 · 服装 · 人像（原三库）',
    dataDir: 'data',
    imageDir: '',
    allowRecipe: true,
    angles: GENERAL_ANGLES,
    libraries: {
      poses: 'data/pose-zh.json',
      costumes: [
        'data/costume-zh.json',
        'data/costume-anime-zh.json',
        'data/costume-gia-anime-zh.json',
        'data/costume-shisei-zh.json',
      ],
      portraits: 'data/portrait-zh.json',
      body: null,
    },
    showProvenance: true,
  },
  bears: {
    id: 'bears',
    title: '胖熊系列',
    subtitle: '独立图库 · 建设中',
    dataDir: 'data/bears',
    imageDir: 'bears',
    allowRecipe: false,
    angles: BEARS_ANGLES,
    libraries: {
      poses: 'data/bears/pose-zh.json',
      costumes: ['data/bears/costume-zh.json'],
      portraits: 'data/bears/portrait-zh.json',
      body: 'data/bears/body-zh.json',
    },
    showProvenance: false,
  },
}

export const SERIES_LIST: SeriesDef[] = [SERIES.general, SERIES.bears]

export const DEFAULT_SERIES: SeriesId = 'general'

export function isSeriesId(value: unknown): value is SeriesId {
  return value === 'general' || value === 'bears'
}

export function getSeries(id: string): SeriesDef | null {
  return isSeriesId(id) ? SERIES[id] : null
}

/** 库页面的标题，例如「动作姿势库」。 */
export const LIBRARY_LABELS = {
  poses: '动作姿势库',
  costumes: '服装穿搭库',
  portraits: '人像颜值库',
  body: '身材参考库',
} as const

export type LibraryKey = keyof typeof LIBRARY_LABELS

export const SERIES_STORAGE_KEY = 'pose_atlas_series_v1'

export function readStoredSeries(): SeriesId {
  try {
    const value = localStorage.getItem(SERIES_STORAGE_KEY)
    return isSeriesId(value) ? value : DEFAULT_SERIES
  } catch {
    return DEFAULT_SERIES
  }
}

export function writeStoredSeries(id: SeriesId) {
  try {
    localStorage.setItem(SERIES_STORAGE_KEY, id)
  } catch {
    // 存储不可用时只影响下次默认值，不影响当前浏览
  }
}
