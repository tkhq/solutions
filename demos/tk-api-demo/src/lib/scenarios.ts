import { scenarios } from '../../scenarios'
import type { Scenario } from '@/types/scenario'

export function getScenarios(): Scenario[] {
  return scenarios
}

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id)
}
