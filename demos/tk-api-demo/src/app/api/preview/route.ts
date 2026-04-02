import { NextRequest, NextResponse } from 'next/server'
import { getScenario } from '@/lib/scenarios'
import { buildDisplayRequest } from '@/lib/executor'
import type { SessionState, StepConfig } from '@/types/scenario'

export async function POST(req: NextRequest) {
  const { scenarioId, stepIndex, sessionState, customSteps } = (await req.json()) as {
    scenarioId: string
    stepIndex: number
    sessionState: SessionState
    customSteps?: StepConfig[]
  }

  let step: StepConfig | undefined
  if (scenarioId === 'custom' && customSteps) {
    step = customSteps[stepIndex]
  } else {
    const scenario = getScenario(scenarioId)
    if (!scenario) {
      return NextResponse.json({ error: `Scenario '${scenarioId}' not found` }, { status: 404 })
    }
    step = scenario.steps[stepIndex]
  }

  if (!step) {
    return NextResponse.json({ error: `Step ${stepIndex} not found` }, { status: 400 })
  }

  return NextResponse.json({ request: buildDisplayRequest(step, sessionState) })
}
