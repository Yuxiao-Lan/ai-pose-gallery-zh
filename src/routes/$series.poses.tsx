import { createFileRoute, notFound } from '@tanstack/react-router'
import { posesQueryFor } from '@/api/gallery'
import { PosePage } from '@/components/gallery/PosePage'
import { getSeries } from '@/lib/series'

export const Route = createFileRoute('/$series/poses')({
  staticData: { title: '动作姿势库' },
  beforeLoad: ({ params }) => {
    if (!getSeries(params.series)) throw notFound()
  },
  loader: ({ context, params }) => {
    const series = getSeries(params.series)
    if (!series) throw notFound()
    return context.queryClient.ensureQueryData(posesQueryFor(series.id))
  },
  component: SeriesPosesRoute,
})

function SeriesPosesRoute() {
  const { series } = Route.useParams()
  const def = getSeries(series)
  if (!def) throw notFound()
  return <PosePage series={def} />
}
