'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SetupClient from '@/app/setup/SetupClient'
import type { StepConfig, SessionState } from '@/types/scenario'

interface InteractConfig {
  steps: StepConfig[]
  initialSessionState: SessionState
  targetName: string
}

export default function InteractRunPage() {
  const router = useRouter()
  const [config, setConfig] = useState<InteractConfig | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('interact-config')
    if (!raw) {
      router.replace('/interact')
      return
    }
    try {
      setConfig(JSON.parse(raw) as InteractConfig)
    } catch {
      router.replace('/interact')
    }
  }, [router])

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <SetupClient
      steps={config.steps}
      flowId="sub-org"
      initialSessionState={config.initialSessionState}
      ignorePersistedSession={true}
    />
  )
}
