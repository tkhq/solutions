'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SetupClient from '@/app/setup/SetupClient'
import type { StepConfig } from '@/types/scenario'

export default function CustomParentSetupPage() {
  const router = useRouter()
  const [steps, setSteps] = useState<StepConfig[] | null>(null)

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
    }
  }, [router])

  if (!steps) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
        Loading…
      </div>
    )
  }

  return <SetupClient steps={steps} flowId="parent" />
}
