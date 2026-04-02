'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DemoClient from '../[scenarioId]/DemoClient'
import type { Scenario, StepConfig } from '@/types/scenario'

export default function CustomDemoPage() {
  const router = useRouter()
  const [scenario, setScenario] = useState<Scenario | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('custom-scenario')
    if (!raw) {
      router.replace('/build')
      return
    }
    try {
      const steps: StepConfig[] = JSON.parse(raw)
      setScenario({
        id: 'custom',
        name: 'Custom Scenario',
        description: 'A scenario you built from the step catalog.',
        steps,
      })
    } catch {
      router.replace('/build')
    }
  }, [router])

  if (!scenario) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
        Loading…
      </div>
    )
  }

  return <DemoClient scenario={scenario} customSteps={scenario.steps} />
}
