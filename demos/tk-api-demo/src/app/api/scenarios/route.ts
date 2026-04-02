import { NextResponse } from 'next/server'
import { getScenarios } from '@/lib/scenarios'

export async function GET() {
  const scenarios = getScenarios().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    stepCount: s.steps.length,
  }))
  return NextResponse.json(scenarios)
}
