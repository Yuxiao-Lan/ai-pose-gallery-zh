import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/portraits')({
  beforeLoad: () => {
    throw redirect({ to: '/$series/portraits', params: { series: 'general' }, replace: true })
  },
})
