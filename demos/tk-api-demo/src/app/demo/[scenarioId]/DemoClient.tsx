'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArchitectureDiagram } from '@/components/ArchitectureDiagram'
import type { Scenario, SessionState, StepResult, StepKind, StepStatus, StepState } from '@/types/scenario'

const API_CALLS: Record<StepKind, { name: string; docs: string }> = {
  CREATE_SUB_ORG:   { name: 'create_sub_organization', docs: 'https://docs.turnkey.com/api-reference/activities/create-sub-organization' },
  CREATE_WALLET:    { name: 'create_wallet',           docs: 'https://docs.turnkey.com/api-reference/activities/create-wallet' },
  CREATE_API_USER:  { name: 'create_api_only_users',   docs: 'https://docs.turnkey.com/api-reference/activities/create-api-only-users' },
  CREATE_POLICY:    { name: 'create_policy',           docs: 'https://docs.turnkey.com/api-reference/activities/create-policy' },
  SIGN_TRANSACTION: { name: 'sign_transaction',        docs: 'https://docs.turnkey.com/api-reference/activities/sign-transaction' },
}

function ApiCallBadge({ kind }: { kind: StepKind }) {
  const { name, docs } = API_CALLS[kind]
  return (
    <a
      href={docs}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono bg-gray-200 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 px-1.5 py-px rounded text-[11px] hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {name} ↗
    </a>
  )
}

// ── JSON tree renderer ──────────────────────────────────────────────────────

function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const pad   = '  '.repeat(depth)
  const inner = '  '.repeat(depth + 1)

  // Inline annotation produced by annotate() in executor.ts
  if (typeof value === 'object' && value !== null && '__value' in value && '__comment' in value) {
    const { __value, __comment } = value as { __value: unknown; __comment: string }
    return <>
      <JsonTree value={__value} depth={depth} />
      <span className="text-gray-400 dark:text-gray-600 italic">  // {__comment}</span>
    </>
  }

  if (value === null)
    return <span className="text-gray-400 dark:text-gray-500">null</span>

  if (typeof value === 'boolean')
    return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>

  if (typeof value === 'number')
    return <span className="text-blue-700 dark:text-blue-400">{value}</span>

  if (typeof value === 'string')
    return <span className="text-emerald-700 dark:text-emerald-400">&quot;{value}&quot;</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span>{'[]'}</span>
    return <>
      {'[\n'}
      {value.map((item, i) => (
        <span key={i}>{inner}<JsonTree value={item} depth={depth + 1} />{i < value.length - 1 ? ',' : ''}{'\n'}</span>
      ))}
      {pad}{']'}
    </>
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span>{'{}'}</span>
    // Real entries only (no // comments) — used for trailing-comma logic
    const realEntries = entries.filter(([k]) => !k.startsWith('//'))
    return <>
      {'{\n'}
      {entries.map(([k, v]) => {
        if (k.startsWith('//')) {
          // Render as a dimmed comment line — value is ignored, key IS the comment text
          return <span key={k} className="text-gray-400 dark:text-gray-600 italic">{inner}{k}{'\n'}</span>
        }
        const isLast = realEntries[realEntries.length - 1][0] === k
        return (
          <span key={k}>
            {inner}<span className="text-violet-700 dark:text-violet-300">&quot;{k}&quot;</span>{': '}
            <JsonTree value={v} depth={depth + 1} />{isLast ? '' : ','}{'\n'}
          </span>
        )
      })}
      {pad}{'}'}
    </>
  }

  return <span>{String(value)}</span>
}

function StatusIcon({ status, index }: { status: StepStatus; index: number }) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0'
  switch (status) {
    case 'pending':
      return <div className={`${base} bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500`}>{index + 1}</div>
    case 'running':
      return (
        <div className={`${base} bg-violet-100 dark:bg-violet-900/50 border border-violet-400 dark:border-violet-500`}>
          <svg className="animate-spin w-3 h-3 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      )
    case 'success':
      return <div className={`${base} bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-400 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400`}>✓</div>
    case 'expected-failure':
      return <div className={`${base} bg-amber-100 dark:bg-amber-900/50 border border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-400`}>✗</div>
    case 'error':
      return <div className={`${base} bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-500 text-red-600 dark:text-red-400`}>!</div>
  }
}

function JsonPanel({ label, badge, data, error, muted }: { label: React.ReactNode; badge?: React.ReactNode; data: unknown; error?: string; muted?: boolean }) {
  const [copied, setCopied] = useState(false)

  const text = error ?? JSON.stringify(data, null, 2)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`rounded-xl overflow-hidden border transition-colors ${
      muted
        ? 'border-gray-200 dark:border-gray-800/60'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/60">
        <span className={`text-xs font-medium tracking-wide ${
          muted ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'
        }`}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          <button
            onClick={copy}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      {/* Body */}
      <pre className={`p-4 text-xs font-mono leading-relaxed ${
        muted
          ? 'bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-500'
          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
      }`}>
        {error
          ? <span className="text-red-500 dark:text-red-400">{error}</span>
          : <JsonTree value={data} />
        }
      </pre>
    </div>
  )
}

export default function DemoClient({ scenario }: { scenario: Scenario }) {
  const [stepStates, setStepStates] = useState<StepState[]>(
    scenario.steps.map(() => ({ status: 'pending' as StepStatus }))
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionState, setSessionState] = useState<SessionState>({})
  const [preview, setPreview] = useState<unknown>(null)

  // Fetch the request preview whenever we land on a new pending step
  useEffect(() => {
    setPreview(null)
    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: scenario.id, stepIndex: currentStep, sessionState }),
    })
      .then((r) => r.json())
      .then((d) => setPreview(d.request))
      .catch(() => {})
    // sessionState intentionally omitted — it's current at the time currentStep changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, scenario.id])

  const reset = useCallback(() => {
    setStepStates(scenario.steps.map(() => ({ status: 'pending' as StepStatus })))
    setCurrentStep(0)
    setSessionState({})
    setPreview(null)
  }, [scenario.steps])

  const runStep = useCallback(async () => {
    setStepStates((prev) =>
      prev.map((s, i) => (i === currentStep ? { ...s, status: 'running' as StepStatus } : s))
    )

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: scenario.id, stepIndex: currentStep, sessionState }),
      })
      const result: StepResult = await res.json()

      const status: StepStatus = result.success
        ? 'success'
        : result.expectedFailure
        ? 'expected-failure'
        : 'error'

      setSessionState(result.updatedState)
      setStepStates((prev) =>
        prev.map((s, i) => (i === currentStep ? { status, result } : s))
      )
    } catch (err) {
      setStepStates((prev) =>
        prev.map((s, i) =>
          i === currentStep
            ? {
                status: 'error',
                result: {
                  success: false,
                  request: null,
                  response: null,
                  error: String(err),
                  updatedState: sessionState,
                },
              }
            : s
        )
      )
    }
  }, [currentStep, scenario.id, sessionState])

  const currentStepState = stepStates[currentStep]
  const canAdvance =
    currentStepState.status === 'success' || currentStepState.status === 'expected-failure'
  const isLastStep = currentStep === scenario.steps.length - 1
  const isPending = currentStepState.status === 'pending'
  const isRunning = currentStepState.status === 'running'

  return (
    <div className="flex min-h-screen">
      {/* Left sidebar — step list */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="sticky top-0 flex flex-col gap-1 p-4 pt-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-4"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Scenarios
          </Link>

          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-2">
            Steps
          </p>

          {scenario.steps.map((step, i) => {
            const s = stepStates[i]
            const isActive = i === currentStep
            const isClickable = s.status !== 'pending' && s.status !== 'running' && !isActive

            return (
              <button
                key={i}
                onClick={() => isClickable && setCurrentStep(i)}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-sm transition-all w-full ${
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : isClickable
                    ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer'
                    : 'text-gray-400 dark:text-gray-600 cursor-default'
                }`}
              >
                <StatusIcon status={s.status} index={i} />
                <span className="leading-snug">{step.title}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">{scenario.name}</span>
          </div>
          <button
            onClick={reset}
            className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all"
          >
            Reset
          </button>
        </div>

        {/* Step content */}
        <div className="flex-1 px-8 py-6">
          {/* Step header */}
          <div className="mb-6 max-w-3xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                Step {currentStep + 1} of {scenario.steps.length}
              </span>
              {currentStepState.status === 'expected-failure' && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  Policy Rejected (Expected)
                </span>
              )}
              {currentStepState.status === 'success' && currentStep >= scenario.steps.length - 2 && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Signing Approved
                </span>
              )}
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {scenario.steps[currentStep].title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              {scenario.steps[currentStep].description}
            </p>
          </div>

          {/* Action row */}
          <div className="mb-5">
            {isPending && (
              <button
                onClick={runStep}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
              >
                Execute Step
              </button>
            )}
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin w-4 h-4 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Calling Turnkey API...
              </div>
            )}
            {canAdvance && (
              <div className="flex items-center gap-3">
                {!isLastStep ? (
                  <button
                    onClick={() => setCurrentStep((p) => p + 1)}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
                  >
                    Next →
                  </button>
                ) : (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                      Demo complete
                    </span>
                    <button
                      onClick={reset}
                      className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 px-4 py-2 rounded-lg transition-all"
                    >
                      Run again
                    </button>
                  </>
                )}
              </div>
            )}
            {currentStepState.status === 'error' && (
              <div className="flex items-center gap-3">
                <span className="text-red-500 dark:text-red-400 text-sm">
                  Unexpected error — see response below
                </span>
                <button
                  onClick={runStep}
                  className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg transition-all"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Live architecture diagram — builds up as each step succeeds */}
          <div className="mb-5">
            <ArchitectureDiagram
              steps={scenario.steps}
              stepStates={stepStates}
              currentStep={currentStep}
              session={sessionState}
              parentOrgId=""
            />
          </div>

          {/* Request + Response panels side by side */}
          <div className="grid grid-cols-2 gap-4">
            <JsonPanel
              label="Request"
              badge={<ApiCallBadge kind={scenario.steps[currentStep].kind} />}
              data={currentStepState.result ? currentStepState.result.request : (preview ?? '')}
            />
            {currentStepState.result ? (
              <JsonPanel
                label="Response"
                badge={
                  currentStepState.result.latencyMs != null ? (
                    <span className="font-mono bg-gray-200 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 px-1.5 py-px rounded text-[11px]">
                      {currentStepState.result.latencyMs}ms
                    </span>
                  ) : undefined
                }
                data={currentStepState.result.response}
                error={currentStepState.result.error}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center text-xs text-gray-400 dark:text-gray-600 min-h-24">
                response will appear here
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
