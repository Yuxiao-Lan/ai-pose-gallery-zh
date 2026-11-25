import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/costumes')({
  beforeLoad: () => {
    throw redirect({ to: '/$series/costumes', params: { series: 'general' }, replace: true })
  },
})
