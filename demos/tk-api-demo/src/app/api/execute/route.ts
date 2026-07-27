import { NextRequest, NextResponse } from 'next/server'
import { getScenario } from '@/lib/scenarios'
import { executeStep } from '@/lib/executor'
import type { SessionState } from '@/types/scenario'

export async function POST(req: NextRequest) {
  const { scenarioId, stepIndex, sessionState } = (await req.json()) as {
    scenarioId: string
    stepIndex: number
    sessionState: SessionState
  }

  const scenario = getScenario(scenarioId)
  if (!scenario) {
    return NextResponse.json({ error: `Scenario '${scenarioId}' not found` }, { status: 404 })
  }

  const step = scenario.steps[stepIndex]
  if (!step) {
    return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 400 })
  }

  const t0 = Date.now()
  const result = await executeStep(step, sessionState)
  return NextResponse.json({ ...result, latencyMs: Date.now() - t0 })
}
