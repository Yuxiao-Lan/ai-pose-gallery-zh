import { createFileRoute, notFound } from '@tanstack/react-router'
import { portraitsQueryFor } from '@/api/gallery'
import { PortraitPage } from '@/components/gallery/PortraitPage'
import { getSeries } from '@/lib/series'

export const Route = createFileRoute('/$series/portraits')({
  staticData: { title: '人像颜值库' },
  beforeLoad: ({ params }) => {
    if (!getSeries(params.series)) throw notFound()
  },
  loader: ({ context, params }) => {
    const series = getSeries(params.series)
    if (!series) throw notFound()
    return context.queryClient.ensureQueryData(portraitsQueryFor(series.id))
  },
  component: SeriesPortraitsRoute,
})

function SeriesPortraitsRoute() {
  const { series } = Route.useParams()
  const def = getSeries(series)
  if (!def) throw notFound()
  return <PortraitPage series={def} />
}
