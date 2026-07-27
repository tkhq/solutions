import { notFound } from 'next/navigation'
import { getScenario } from '@/lib/scenarios'
import DemoClient from './DemoClient'

export default async function DemoPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>
}) {
  const { scenarioId } = await params
  const scenario = getScenario(scenarioId)
  if (!scenario) notFound()

  return <DemoClient scenario={scenario} />
}
