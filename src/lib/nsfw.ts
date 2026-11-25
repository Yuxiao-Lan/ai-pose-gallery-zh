import type { CostumeItem, PortraitItem, PoseItem } from '@/types/gallery'

/** 逐条敏感标记；缺字段一律视为非敏感（迁移脚本已为存量数据补齐）。 */
export interface SensitiveFlag {
  敏感?: boolean
}

export function isSensitive(item: SensitiveFlag): boolean {
  return item.敏感 === true
}

export const isNsfwPose = (item: PoseItem) => isSensitive(item)
export const isNsfwCostume = (item: CostumeItem) => isSensitive(item)
export const isNsfwPortrait = (item: PortraitItem) => isSensitive(item)

export function groupHasSensitive(items: SensitiveFlag[]): boolean {
  return items.some(isSensitive)
}

export function groupAllSensitive(items: SensitiveFlag[]): boolean {
  return items.length > 0 && items.every(isSensitive)
}
