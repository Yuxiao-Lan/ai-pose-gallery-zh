import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRightIcon, LayersIcon, PersonStandingIcon, ShirtIcon, UserRoundIcon } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { SERIES_LIST } from '@/lib/series'

export const Route = createFileRoute('/')({
  staticData: { title: '系列入口' },
  component: SeriesLanding,
})

const LIBRARY_ICONS = [PersonStandingIcon, ShirtIcon, UserRoundIcon]

function SeriesLanding() {
  return (
    <>
      <PageHeader title="AI 角色参考库" />

      <div className="grid gap-4 sm:grid-cols-2">
        {SERIES_LIST.map((series) => (
          <Link
            key={series.id}
            to="/$series"
            params={{ series: series.id }}
            className="group flex flex-col justify-between rounded-[22px] bg-muted p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <LayersIcon className="size-4 text-primary" />
                  <h2 className="text-base font-semibold">{series.title}</h2>
                  {series.id === 'bears' && <Badge variant="secondary">建设中</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{series.subtitle}</p>
              </div>
              <ArrowRightIcon className="mt-1 size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {LIBRARY_ICONS.map((Icon, index) => {
                const labels = ['姿势', '服装', '人像']
                return (
                  <span
                    key={labels[index]}
                    className="flex items-center gap-1 rounded-lg bg-background px-2 py-1 text-[11px] text-muted-foreground"
                  >
                    <Icon className="size-3" />
                    {labels[index]}
                  </span>
                )
              })}
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        两个系列的数据彼此独立，通过左侧栏顶部的系列切换器切换。合成台仅使用「通用系列」的素材。
      </p>
    </>
  )
}
