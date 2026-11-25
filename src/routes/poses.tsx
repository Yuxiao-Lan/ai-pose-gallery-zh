import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/poses')({
  beforeLoad: () => {
    throw redirect({ to: '/$series/poses', params: { series: 'general' }, replace: true })
  },
})
