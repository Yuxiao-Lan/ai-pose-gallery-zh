import { createFileRoute, notFound } from '@tanstack/react-router'
import { bodyQueryFor, costumesQueryFor, portraitsQueryFor, posesQueryFor } from '@/api/gallery'
import { SeriesDashboard } from '@/components/gallery/SeriesDashboard'
import { getSeries } from '@/lib/series'

export const Route = createFileRoute('/$series/')({
  staticData: { title: '图库总览' },
  beforeLoad: ({ params }) => {
    if (!getSeries(params.series)) throw notFound()
  },
  loader: ({ context, params }) => {
    const series = getSeries(params.series)
    if (!series) throw notFound()
    return Promise.all([
      context.queryClient.ensureQueryData(posesQueryFor(series.id)),
      context.queryClient.ensureQueryData(costumesQueryFor(series.id)),
      context.queryClient.ensureQueryData(portraitsQueryFor(series.id)),
      context.queryClient.ensureQueryData(bodyQueryFor(series.id)),
    ])
  },
  component: SeriesIndexRoute,
})

function SeriesIndexRoute() {
  const { series } = Route.useParams()
  const def = getSeries(series)
  if (!def) throw notFound()
  return <SeriesDashboard series={def} />
}
