import { createFileRoute, notFound } from '@tanstack/react-router'
import { bodyQueryFor } from '@/api/gallery'
import { BodyPage } from '@/components/gallery/BodyPage'
import { getSeries } from '@/lib/series'

export const Route = createFileRoute('/$series/body')({
  staticData: { title: '身材参考库' },
  beforeLoad: ({ params }) => {
    const series = getSeries(params.series)
    if (!series || !series.libraries.body) throw notFound()
  },
  loader: ({ context, params }) => {
    const series = getSeries(params.series)
    if (!series || !series.libraries.body) throw notFound()
    return context.queryClient.ensureQueryData(bodyQueryFor(series.id))
  },
  component: SeriesBodyRoute,
})

function SeriesBodyRoute() {
  const { series } = Route.useParams()
  const def = getSeries(series)
  if (!def || !def.libraries.body) throw notFound()
  return <BodyPage series={def} />
}
