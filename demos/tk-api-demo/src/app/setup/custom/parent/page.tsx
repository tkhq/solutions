'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SetupClient from '@/app/setup/SetupClient'
import type { StepConfig } from '@/types/scenario'

export default function CustomParentSetupPage() {
  const router = useRouter()
  const [steps, setSteps] = useState<StepConfig[] | null>(null)
  const [hasSubOrgContinuation, setHasSubOrgContinuation] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('custom-setup-parent')
    if (!raw) {
      router.replace('/build?flow=parent')
      return
    }
    try {
      setSteps(JSON.parse(raw) as StepConfig[])
    } catch {
      router.replace('/build?flow=parent')
      return
    }

    // If launched from the recommender with sub-org steps, copy them into the
    // sub-org slot so SetupClient can offer a direct "Continue →" handoff.
    const subOrgRaw = sessionStorage.getItem('tk-recommend-suborg')
    if (subOrgRaw) {
      sessionStorage.setItem('custom-setup-sub-org', subOrgRaw)
      setHasSubOrgContinuation(true)
    }
  }, [router])

  if (!steps) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <SetupClient
      steps={steps}
      flowId="parent"
      nextFlowHref={hasSubOrgContinuation ? '/setup/custom/sub-org' : undefined}
      nextFlowLabel="Continue to Sub-Org Setup →"
    />
  )
}
