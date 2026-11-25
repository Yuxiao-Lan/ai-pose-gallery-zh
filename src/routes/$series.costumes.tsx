import { createFileRoute, notFound } from '@tanstack/react-router'
import { costumesQueryFor } from '@/api/gallery'
import { CostumePage } from '@/components/gallery/CostumePage'
import { getSeries } from '@/lib/series'

export const Route = createFileRoute('/$series/costumes')({
  staticData: { title: '服装穿搭库' },
  beforeLoad: ({ params }) => {
    if (!getSeries(params.series)) throw notFound()
  },
  loader: ({ context, params }) => {
    const series = getSeries(params.series)
    if (!series) throw notFound()
    return context.queryClient.ensureQueryData(costumesQueryFor(series.id))
  },
  component: SeriesCostumesRoute,
})

function SeriesCostumesRoute() {
  const { series } = Route.useParams()
  const def = getSeries(series)
  if (!def) throw notFound()
  return <CostumePage series={def} />
}
