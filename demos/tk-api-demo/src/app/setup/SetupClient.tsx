'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { SessionState, StepResult, StepKind, StepConfig } from '@/types/scenario'
import { SDK_METHODS } from '@/lib/setup-flows'

const PARENT_STATE_KEY = 'tk-parent-org-state'
const flowSessionKey = (flowId: string) => `tk-session-${flowId}`

const DESTRUCTIVE_KINDS = new Set<StepKind>([
  'UPDATE_ROOT_QUORUM',
  'DELETE_POLICY', 'DELETE_POLICIES',
  'DELETE_WALLETS',
  'DELETE_USERS',
  'DELETE_PRIVATE_KEYS',
  'DELETE_API_KEYS',
  'DELETE_USER_TAGS',
  'DELETE_PRIVATE_KEY_TAGS',
])

// Fields each step kind produces in SessionState
const STEP_PRODUCES: Partial<Record<StepKind, (keyof SessionState)[]>> = {
  CREATE_SUB_ORG:         ['subOrgId', 'rootUserId'],
  CREATE_WALLET:          ['walletId', 'walletAddress'],
  CREATE_POLICY:          ['policyId'],
  CREATE_API_USER:        ['apiUserId', 'apiUserPublicKey', 'apiUserPrivateKey'],
  CREATE_USER_TAG:        ['userTagId'],
  CREATE_PRIVATE_KEY_TAG: ['privateKeyTagId'],
  CREATE_API_KEYS:        ['apiKeyId'],
  CREATE_PRIVATE_KEY:     ['privateKeyId'],
}

const SESSION_STATE_LABELS: Record<keyof SessionState, string> = {
  subOrgId:             'Sub-Org ID',
  subOrganizationName:  'Sub-Org Name',
  walletId:             'Wallet ID',
  walletAddress:        'Wallet Address',
  apiUserId:            'API User ID',
  apiUserPublicKey:     'API User Public Key',
  apiUserPrivateKey:    'API User Private Key',
  policyId:             'Policy ID',
  allowedAddress:       'Allowed Address',
  privateKeyId:         'Private Key ID',
  userTagId:            'User Tag ID',
  privateKeyTagId:      'Private Key Tag ID',
  apiKeyId:             'API Key ID',
  rootUserId:           'Root User ID',
}

const API_CALLS: Record<StepKind, { name: string; docs: string }> = {
  // Activities
  CREATE_SUB_ORG:        { name: 'create_sub_organization',  docs: 'https://docs.turnkey.com/api-reference/activities/create-sub-organization' },
  CREATE_WALLET:         { name: 'create_wallet',            docs: 'https://docs.turnkey.com/api-reference/activities/create-wallet' },
  CREATE_WALLET_ACCOUNTS:{ name: 'create_wallet_accounts',   docs: 'https://docs.turnkey.com/api-reference/activities/create-wallet-accounts' },
  CREATE_API_USER:       { name: 'create_api_only_users',    docs: 'https://docs.turnkey.com/api-reference/activities/create-api-only-users' },
  CREATE_API_KEYS:       { name: 'create_api_keys',          docs: 'https://docs.turnkey.com/api-reference/activities/create-api-keys' },
  CREATE_PRIVATE_KEY:    { name: 'create_private_keys',      docs: 'https://docs.turnkey.com/api-reference/activities/create-private-keys' },
  CREATE_POLICY:         { name: 'create_policy',            docs: 'https://docs.turnkey.com/api-reference/activities/create-policy' },
  SIGN_TRANSACTION:      { name: 'sign_transaction',         docs: 'https://docs.turnkey.com/api-reference/activities/sign-transaction' },
  SIGN_RAW_PAYLOAD:      { name: 'sign_raw_payload',         docs: 'https://docs.turnkey.com/api-reference/activities/sign-raw-payload' },
  SIGN_RAW_PAYLOADS:     { name: 'sign_raw_payloads',        docs: 'https://docs.turnkey.com/api-reference/activities/sign-raw-payloads' },
  UPDATE_WALLET:         { name: 'update_wallet',            docs: 'https://docs.turnkey.com/api-reference/activities/update-wallet' },
  UPDATE_POLICY:         { name: 'update_policy',            docs: 'https://docs.turnkey.com/api-reference/activities/update-policy' },
  UPDATE_USER:           { name: 'update_user',              docs: 'https://docs.turnkey.com/api-reference/activities/update-user' },
  DELETE_POLICY:         { name: 'delete_policy',            docs: 'https://docs.turnkey.com/api-reference/activities/delete-policy' },
  DELETE_WALLETS:        { name: 'delete_wallets',           docs: 'https://docs.turnkey.com/api-reference/activities/delete-wallets' },
  DELETE_USERS:          { name: 'delete_users',             docs: 'https://docs.turnkey.com/api-reference/activities/delete-users' },
  CREATE_USER_TAG:        { name: 'create_user_tag',         docs: 'https://docs.turnkey.com/api-reference/activities/create-user-tag' },
  CREATE_PRIVATE_KEY_TAG: { name: 'create_private_key_tag',  docs: 'https://docs.turnkey.com/api-reference/activities/create-private-key-tag' },
  CREATE_POLICIES:        { name: 'create_policies',         docs: 'https://docs.turnkey.com/api-reference/activities/create-policies' },
  CREATE_INVITATIONS:     { name: 'create_invitations',      docs: 'https://docs.turnkey.com/api-reference/activities/create-invitations' },
  DELETE_PRIVATE_KEYS:    { name: 'delete_private_keys',     docs: 'https://docs.turnkey.com/api-reference/activities/delete-private-keys' },
  DELETE_API_KEYS:        { name: 'delete_api_keys',         docs: 'https://docs.turnkey.com/api-reference/activities/delete-api-keys' },
  DELETE_USER_TAGS:       { name: 'delete_user_tags',        docs: 'https://docs.turnkey.com/api-reference/activities/delete-user-tags' },
  DELETE_PRIVATE_KEY_TAGS:{ name: 'delete_private_key_tags', docs: 'https://docs.turnkey.com/api-reference/activities/delete-private-key-tags' },
  DELETE_POLICIES:        { name: 'delete_policies',         docs: 'https://docs.turnkey.com/api-reference/activities/delete-policies' },
  UPDATE_ROOT_QUORUM:     { name: 'update_root_quorum',      docs: 'https://docs.turnkey.com/api-reference/activities/update-root-quorum' },
  UPDATE_ORGANIZATION_NAME:{ name: 'update_organization_name', docs: 'https://docs.turnkey.com/api-reference/activities/update-organization-name' },
  SET_ORG_FEATURE:        { name: 'set_organization_feature', docs: 'https://docs.turnkey.com/api-reference/activities/set-organization-feature' },
  REMOVE_ORG_FEATURE:     { name: 'remove_organization_feature', docs: 'https://docs.turnkey.com/api-reference/activities/remove-organization-feature' },
  // Queries
  GET_WHO_AM_I:          { name: 'get_whoami',               docs: 'https://docs.turnkey.com/api-reference/queries/who-am-i' },
  GET_WALLET:            { name: 'get_wallet',               docs: 'https://docs.turnkey.com/api-reference/queries/get-wallet' },
  GET_USER:              { name: 'get_user',                 docs: 'https://docs.turnkey.com/api-reference/queries/get-user' },
  GET_POLICY:            { name: 'get_policy',               docs: 'https://docs.turnkey.com/api-reference/queries/get-policy' },
  GET_API_KEYS:          { name: 'get_api_keys',             docs: 'https://docs.turnkey.com/api-reference/queries/get-api-keys' },
  GET_CONFIGS:           { name: 'get_configs',              docs: 'https://docs.turnkey.com/api-reference/queries/get-configs' },
  LIST_WALLETS:          { name: 'get_wallets',              docs: 'https://docs.turnkey.com/api-reference/queries/list-wallets' },
  LIST_WALLET_ACCOUNTS:  { name: 'get_wallet_accounts',      docs: 'https://docs.turnkey.com/api-reference/queries/list-wallets-accounts' },
  LIST_USERS:            { name: 'get_users',                docs: 'https://docs.turnkey.com/api-reference/queries/list-users' },
  LIST_POLICIES:         { name: 'get_policies',             docs: 'https://docs.turnkey.com/api-reference/queries/list-policies' },
  LIST_ACTIVITIES:       { name: 'get_activities',           docs: 'https://docs.turnkey.com/api-reference/queries/list-activities' },
  LIST_PRIVATE_KEYS:     { name: 'get_private_keys',         docs: 'https://docs.turnkey.com/api-reference/queries/list-private-keys' },
  GET_PRIVATE_KEY:       { name: 'get_private_key',          docs: 'https://docs.turnkey.com/api-reference/queries/get-private-key' },
  GET_AUTHENTICATORS:    { name: 'get_authenticators',       docs: 'https://docs.turnkey.com/api-reference/queries/get-authenticators' },
  GET_SUB_ORGS:          { name: 'get_sub_org_ids',          docs: 'https://docs.turnkey.com/api-reference/queries/get-sub-organizations' },
  GET_VERIFIED_SUB_ORGS: { name: 'get_verified_sub_org_ids', docs: 'https://docs.turnkey.com/api-reference/queries/get-verified-sub-organizations' },
  LIST_USER_TAGS:        { name: 'list_user_tags',           docs: 'https://docs.turnkey.com/api-reference/queries/list-user-tags' },
  LIST_PRIVATE_KEY_TAGS: { name: 'list_private_key_tags',    docs: 'https://docs.turnkey.com/api-reference/queries/list-private-key-tags' },
  LIST_SUPPORTED_ASSETS: { name: 'list_supported_assets',    docs: 'https://docs.turnkey.com/api-reference/queries/list-supported-assets' },
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

// Strips annotate() wrappers ({ __value, __comment }) to plain values for editing
function stripAnnotations(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if ('__value' in obj && '__comment' in obj) return stripAnnotations(obj.__value)
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, stripAnnotations(v)]))
  }
  if (Array.isArray(value)) return value.map(stripAnnotations)
  return value
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

type StepStatus = 'pending' | 'running' | 'success' | 'expected-failure' | 'error'

interface StepState {
  status: StepStatus
  result?: StepResult
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
    <div className={`rounded-xl border transition-colors ${
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
      <pre className={`p-4 text-xs font-mono leading-relaxed overflow-x-auto ${
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

function SessionStateField({ name, value }: { name: keyof SessionState; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
          {SESSION_STATE_LABELS[name] ?? name}
        </span>
        <button
          onClick={copy}
          className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors shrink-0"
        >
          {copied ? '✓' : 'copy'}
        </button>
      </div>
      <p className="text-[11px] font-mono text-gray-600 dark:text-gray-300 break-all leading-snug">
        {value}
      </p>
    </div>
  )
}

function getCodeSnippet(kind: StepKind, requestJson: string): string {
  const method = SDK_METHODS[kind] ?? kind.toLowerCase()
  let parsed: unknown
  try { parsed = JSON.parse(requestJson) } catch { parsed = {} }
  return `// @turnkey/sdk-server\nconst response = await client.${method}(\n${JSON.stringify(parsed, null, 2)}\n)`
}

export default function SetupClient({
  steps,
  flowId,
  initialSessionState,
}: {
  steps: StepConfig[]
  flowId: 'parent' | 'sub-org'
  initialSessionState?: SessionState
}) {
  const scenarioId = 'custom'
  const flowName = flowId === 'parent' ? 'Parent Org Setup' : 'Sub-Org Setup'

  const [stepStates, setStepStates] = useState<StepState[]>(
    steps.map(() => ({ status: 'pending' as StepStatus }))
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [sessionState, setSessionState] = useState<SessionState>(initialSessionState ?? {})
  const [preview, setPreview] = useState<unknown>(null)
  const [editedRequest, setEditedRequest] = useState<string>('')
  const [requestParseError, setRequestParseError] = useState<string | null>(null)
  const [requestTab, setRequestTab] = useState<'request' | 'code'>('request')
  const [editMode, setEditMode] = useState(false)
  const [hasParentState, setHasParentState] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // New state for the 5 improvements
  const [stateInspectorOpen, setStateInspectorOpen] = useState(false)
  const [confirmingDestructive, setConfirmingDestructive] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipValues, setSkipValues] = useState<Record<string, string>>({})

  // Ref to always have latest stepStates in effects without re-triggering them
  const stepStatesRef = useRef(stepStates)
  useEffect(() => { stepStatesRef.current = stepStates }, [stepStates])

  // On mount: restore persisted session or merge parent state
  useEffect(() => {
    const sessionKey = flowSessionKey(flowId)
    const saved = localStorage.getItem(sessionKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          sessionState: SessionState
          stepStates: StepState[]
          currentStep: number
        }
        setSessionState(parsed.sessionState ?? {})
        // Guard against stale saves with a different step count
        if (parsed.stepStates?.length === steps.length) {
          setStepStates(parsed.stepStates)
          setCurrentStep(parsed.currentStep ?? 0)
        }
        setHasParentState(!!localStorage.getItem(PARENT_STATE_KEY))
        return
      } catch {
        // ignore corrupt data
      }
    }

    // No saved session — check parent state
    const parentStored = localStorage.getItem(PARENT_STATE_KEY)
    if (parentStored) {
      setHasParentState(true)
      if (flowId === 'sub-org') {
        try {
          const parsed = JSON.parse(parentStored) as SessionState
          setSessionState((prev) => ({ ...parsed, ...prev }))
        } catch {
          // ignore
        }
      }
    }
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch the request preview whenever we land on a new step
  useEffect(() => {
    setPreview(null)
    setEditedRequest('')
    setRequestParseError(null)
    setRequestTab('request')
    setEditMode(false)
    setConfirmingDestructive(false)
    setSkipOpen(false)
    setSkipValues({})

    // Step replay: if this step is already done, populate from stored result
    const existing = stepStatesRef.current[currentStep]
    if (existing?.status === 'success' || existing?.status === 'expected-failure') {
      if (existing.result) {
        setPreview(existing.result.request)
        const req = existing.result.request
        if (req !== null && req !== undefined) {
          setEditedRequest(JSON.stringify(req, null, 2))
        }
      }
      return
    }

    fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId, stepIndex: currentStep, sessionState, customSteps: steps }),
    })
      .then((r) => r.json())
      .then((d) => {
        setPreview(d.request)
        setEditedRequest(JSON.stringify(stripAnnotations(d.request), null, 2))
      })
      .catch(() => {})
    // sessionState intentionally omitted — it's current at the time currentStep changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  const reset = useCallback(() => {
    setStepStates(steps.map(() => ({ status: 'pending' as StepStatus })))
    setCurrentStep(0)
    setSessionState({})
    setPreview(null)
    setEditedRequest('')
    setRequestParseError(null)
    setRequestTab('request')
    setEditMode(false)
    setConfirmingDestructive(false)
    setSkipOpen(false)
    setSkipValues({})
    localStorage.removeItem(flowSessionKey(flowId))
    if (flowId === 'parent') {
      localStorage.removeItem(PARENT_STATE_KEY)
      setHasParentState(false)
    }
  }, [steps, flowId])

  const runStep = useCallback(async () => {
    // Parse the edited request — bail out if invalid JSON
    let overrideRequest: Record<string, unknown> | undefined
    try {
      overrideRequest = JSON.parse(editedRequest)
    } catch {
      setRequestParseError('Invalid JSON — fix the request before running.')
      return
    }
    setRequestParseError(null)

    setStepStates((prev) =>
      prev.map((s, i) => (i === currentStep ? { ...s, status: 'running' as StepStatus } : s))
    )

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, stepIndex: currentStep, sessionState, customSteps: steps, overrideRequest }),
      })
      const result: StepResult = await res.json()

      const status: StepStatus = result.success
        ? 'success'
        : result.expectedFailure
        ? 'expected-failure'
        : 'error'

      setSessionState(result.updatedState)

      const updatedStepStates = stepStates.map((s, i) =>
        i === currentStep ? { status, result } : s
      )

      // Persist parent-to-sub-org handoff state
      if (flowId === 'parent') {
        localStorage.setItem(PARENT_STATE_KEY, JSON.stringify(result.updatedState))
        setHasParentState(true)
      }

      // Persist full session state for refresh recovery
      localStorage.setItem(flowSessionKey(flowId), JSON.stringify({
        sessionState: result.updatedState,
        stepStates: updatedStepStates,
        currentStep,
      }))

      setStepStates(updatedStepStates)
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
  }, [currentStep, editedRequest, sessionState, steps, stepStates, flowId])

  const applySkip = useCallback(() => {
    const produces = STEP_PRODUCES[steps[currentStep].kind] ?? []
    const patch: SessionState = {}
    for (const field of produces) {
      const v = (skipValues[field] ?? '').trim()
      if (v) (patch as Record<string, string>)[field] = v
    }
    const updatedState: SessionState = { ...sessionState, ...patch }
    const skippedResult: StepResult = {
      success: true,
      request: null,
      response: { note: 'Step skipped — IDs provided manually', ...patch },
      updatedState,
    }
    setSessionState(updatedState)
    const updatedStepStates = stepStates.map((s, i) =>
      i === currentStep ? { status: 'success' as StepStatus, result: skippedResult } : s
    )
    localStorage.setItem(flowSessionKey(flowId), JSON.stringify({
      sessionState: updatedState,
      stepStates: updatedStepStates,
      currentStep,
    }))
    if (flowId === 'parent') {
      localStorage.setItem(PARENT_STATE_KEY, JSON.stringify(updatedState))
      setHasParentState(true)
    }
    setStepStates(updatedStepStates)
    setSkipOpen(false)
    setSkipValues({})
  }, [currentStep, sessionState, skipValues, steps, stepStates, flowId])

  const currentStepState = stepStates[currentStep]
  const canAdvance =
    currentStepState.status === 'success' || currentStepState.status === 'expected-failure'
  const isLastStep = currentStep === steps.length - 1
  const isPending = currentStepState.status === 'pending'
  const isRunning = currentStepState.status === 'running'
  const isDestructive = DESTRUCTIVE_KINDS.has(steps[currentStep].kind)
  const stepProduces = STEP_PRODUCES[steps[currentStep].kind] ?? []

  const badge = <ApiCallBadge kind={steps[currentStep].kind} />

  const copyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet(steps[currentStep].kind, editedRequest))
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 1500)
  }

  // Non-null session state entries for the inspector
  const sessionEntries = Object.entries(sessionState).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  ) as [keyof SessionState, string][]

  return (
    <div className="flex min-h-screen">
      {/* Left sidebar — step list */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="sticky top-0 flex flex-col gap-1 p-4 pt-6 max-h-screen overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-black.svg" alt="Turnkey" height={18} className="dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-white.svg" alt="Turnkey" height={18} className="hidden dark:block" />
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-3"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Setup
          </Link>

          <p className="text-sm font-semibold text-gray-900 dark:text-white px-2 mb-1">
            {flowName}
          </p>

          {flowId === 'sub-org' && hasParentState && (
            <span className="text-[10px] px-2 py-0.5 mb-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-full w-fit font-medium">
              Parent org configured ✓
            </span>
          )}

          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-2 mt-2">
            Steps
          </p>

          {steps.map((step, i) => {
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

          {/* Session state inspector */}
          {sessionEntries.length > 0 && (
            <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
              <button
                onClick={() => setStateInspectorOpen((o) => !o)}
                className="flex items-center justify-between w-full px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <span>Session State ({sessionEntries.length})</span>
                <span className="text-[10px]">{stateInspectorOpen ? '▾' : '▸'}</span>
              </button>
              {stateInspectorOpen && (
                <div className="mt-2 space-y-1.5">
                  {sessionEntries.map(([k, v]) => (
                    <SessionStateField key={k} name={k} value={v} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">{flowName}</span>
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
                Step {currentStep + 1} of {steps.length}
              </span>
              {currentStepState.status === 'expected-failure' && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  Policy Rejected (Expected)
                </span>
              )}
              {currentStepState.status === 'success' && (
                steps[currentStep].kind === 'SIGN_TRANSACTION' ||
                steps[currentStep].kind === 'SIGN_RAW_PAYLOAD'
              ) && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Signing Approved
                </span>
              )}
              {currentStepState.result?.response != null &&
                typeof currentStepState.result.response === 'object' &&
                'note' in (currentStepState.result.response as object) &&
                (currentStepState.result.response as Record<string, unknown>).note === 'Step skipped — IDs provided manually' && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  Skipped
                </span>
              )}
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {steps[currentStep].title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Action row */}
          <div className="mb-5 space-y-3">
            {/* Destructive warning */}
            {isPending && confirmingDestructive && (
              <div className="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-4 max-w-lg">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                  Destructive operation
                </p>
                <p className="text-sm text-red-600 dark:text-red-500 mb-3 leading-relaxed">
                  This action cannot easily be undone. Make sure you have the right IDs before continuing.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setConfirmingDestructive(false); runStep() }}
                    className="bg-red-600 hover:bg-red-500 text-white font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Confirm & Execute
                  </button>
                  <button
                    onClick={() => setConfirmingDestructive(false)}
                    className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-1.5 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Skip form */}
            {isPending && skipOpen && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4 max-w-lg">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mark as complete with existing IDs
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Enter the IDs that already exist for this step. They will be carried forward into subsequent steps.
                </p>
                {stepProduces.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {stepProduces.map((field) => (
                      <div key={field}>
                        <label className="block text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                          {SESSION_STATE_LABELS[field] ?? field}
                        </label>
                        <input
                          type="text"
                          placeholder={`Enter ${SESSION_STATE_LABELS[field] ?? field}`}
                          value={skipValues[field] ?? ''}
                          onChange={(e) => setSkipValues((p) => ({ ...p, [field]: e.target.value }))}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:border-violet-400 dark:focus:border-violet-500"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 italic">
                    This step doesn't produce tracked IDs — it will be marked done without changes to session state.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={applySkip}
                    className="bg-gray-800 dark:bg-gray-200 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Apply & Continue
                  </button>
                  <button
                    onClick={() => { setSkipOpen(false); setSkipValues({}) }}
                    className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-1.5 rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Main action buttons */}
            {isPending && !confirmingDestructive && !skipOpen && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isDestructive ? setConfirmingDestructive(true) : runStep()}
                  className={`font-medium px-5 py-2 rounded-lg text-sm transition-colors ${
                    isDestructive
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  Execute Step
                </button>
                <button
                  onClick={() => setSkipOpen(true)}
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 px-4 py-2 rounded-lg transition-all"
                >
                  Skip
                </button>
              </div>
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
                      Setup complete
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

          {/* Request + Response panels side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Request panel with tabs */}
            <div>
              {/* Tab bar — only show once editedRequest is populated */}
              {editedRequest && (
                <div className="rounded-xl border border-violet-300 dark:border-violet-700">
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700/60">
                    <button
                      onClick={() => setRequestTab('request')}
                      className={`text-xs font-medium transition-colors ${requestTab === 'request' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Request
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <button
                      onClick={() => setRequestTab('code')}
                      className={`text-xs font-medium transition-colors ${requestTab === 'code' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Code
                    </button>
                    <div className="flex-1" />
                    {requestTab === 'request' && badge}
                    {requestTab === 'request' && (isPending || currentStepState.status === 'error') && (
                      editMode ? (
                        <>
                          {editedRequest !== JSON.stringify(stripAnnotations(preview), null, 2) && (
                            <>
                              <span className="text-[10px] px-1.5 py-px rounded bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 font-medium">
                                edited
                              </span>
                              <button
                                onClick={() => {
                                  setEditedRequest(JSON.stringify(stripAnnotations(preview), null, 2))
                                  setRequestParseError(null)
                                }}
                                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              >
                                Reset
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => { setEditMode(false); setRequestParseError(null) }}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          >
                            View
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditMode(true)}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          Edit
                        </button>
                      )
                    )}
                  </div>

                  {requestTab === 'request' ? (
                    (isPending || currentStepState.status === 'error') ? (
                      editMode ? (
                        <div className="relative">
                          <textarea
                            value={editedRequest}
                            onChange={(e) => {
                              setEditedRequest(e.target.value)
                              setRequestParseError(null)
                            }}
                            spellCheck={false}
                            className="w-full p-4 text-xs font-mono leading-relaxed bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 resize-none focus:outline-none min-h-48 overflow-x-auto whitespace-pre"
                            style={{ height: `${Math.max(192, (editedRequest.split('\n').length + 1) * 18)}px` }}
                          />
                          {requestParseError && (
                            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                              {requestParseError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <pre className="p-4 text-xs font-mono leading-relaxed bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 overflow-x-auto">
                          <JsonTree value={preview ?? ''} />
                        </pre>
                      )
                    ) : (
                      <pre className="p-4 text-xs font-mono leading-relaxed bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 overflow-x-auto">
                        <JsonTree value={currentStepState.result ? currentStepState.result.request : (preview ?? '')} />
                      </pre>
                    )
                  ) : (
                    <div className="relative">
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={copyCode}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        >
                          {codeCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono leading-relaxed bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 min-h-48 overflow-x-auto">
                        {getCodeSnippet(steps[currentStep].kind, editedRequest)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback when editedRequest not yet loaded */}
              {!editedRequest && (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center text-xs text-gray-400 dark:text-gray-600 min-h-24">
                  loading request...
                </div>
              )}
            </div>

            {/* Response panel */}
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
