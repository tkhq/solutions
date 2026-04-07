import { NextRequest, NextResponse } from 'next/server'
import { getScenario } from '@/lib/scenarios'
import { executeStep } from '@/lib/executor'
import type { SessionState, StepConfig } from '@/types/scenario'

export async function POST(req: NextRequest) {
  const { scenarioId, stepIndex, sessionState, customSteps, overrideRequest } = (await req.json()) as {
    scenarioId: string
    stepIndex: number
    sessionState: SessionState
    customSteps?: StepConfig[]
    overrideRequest?: Record<string, unknown>
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

  const t0 = Date.now()
  try {
    const result = await executeStep(step, sessionState, overrideRequest)
    return NextResponse.json({ ...result, latencyMs: Date.now() - t0 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
