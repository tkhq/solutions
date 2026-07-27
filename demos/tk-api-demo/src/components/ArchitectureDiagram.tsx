'use client'

import type { Scenario, SessionState, StepState, StepKind } from '@/types/scenario'

// ── Derived node status ──────────────────────────────────────────────────────
// A sub-org resource walks: ghost (not built yet) → active (its step is the
// current target / in-flight) → done (created). The parent org's resources are
// pre-existing, so they render as 'static' (neutral, established) cards.
// Everything is driven by step + session state, so the picture stays in lockstep
// with the actual API calls.

type NodeStatus = 'ghost' | 'active' | 'done'
type CardStatus = NodeStatus | 'static'

interface DiagramProps {
  steps: Scenario['steps']
  stepStates: StepState[]
  currentStep: number
  session: SessionState
  parentOrgId: string
}

function short(id: string | undefined, head = 6, tail = 4): string {
  if (!id) return ''
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

// ── Icons ────────────────────────────────────────────────────────────────────

function Icon({ kind, className = 'w-4 h-4' }: { kind: 'building' | 'user' | 'key' | 'wallet' | 'policy'; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
  switch (kind) {
    case 'building':
      return <svg className={className} {...common}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 13v.01M9 17v.01" /></svg>
    case 'user':
      return <svg className={className} {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
    case 'key':
      return <svg className={className} {...common}><circle cx="8" cy="15" r="4" /><path d="m10.85 12.15 8-8M18 4l2 2M15 7l2 2" /></svg>
    case 'wallet':
      return <svg className={className} {...common}><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M16 12h.01M3 9h18" /></svg>
    case 'policy':
      return <svg className={className} {...common}><path d="M14 3v4a1 1 0 0 0 1 1h4M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 13l2 2 4-4" /></svg>
  }
}

// ── Bucket column ──────────────────────────────────────────────────────────────
// One of the three columns under an org: a labelled header + stacked cards.

function Bucket({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5 px-0.5">
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ── Item card ────────────────────────────────────────────────────────────────
// A single resource (a user, a policy, a wallet) inside a bucket.

function ItemCard({
  icon,
  label,
  tag,
  detail,
  status,
}: {
  icon: 'wallet' | 'user' | 'policy'
  label: string
  tag?: string
  detail?: string
  status: CardStatus
}) {
  const styles: Record<CardStatus, string> = {
    ghost:
      'border-dashed border-gray-200 dark:border-gray-800 bg-transparent text-gray-300 dark:text-gray-700',
    active:
      'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shadow-sm ring-2 ring-violet-200 dark:ring-violet-500/20 animate-pulse',
    done:
      'border-emerald-300 dark:border-emerald-700/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-gray-700 dark:text-gray-200',
    static:
      'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-gray-600 dark:text-gray-300',
  }
  const tagStyles: Record<CardStatus, string> = {
    ghost: 'border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-700',
    active: 'border-violet-300 dark:border-violet-700 text-violet-500 dark:text-violet-400',
    done: 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500',
    static: 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500',
  }
  const showDetail = status === 'done' || status === 'static'
  return (
    <div className={`rounded-lg border px-3 py-2 transition-all duration-500 ${styles[status]}`}>
      <div className="flex items-center gap-2">
        <span className={status === 'done' ? 'text-emerald-500 dark:text-emerald-400' : ''}>
          <Icon kind={icon} className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-medium truncate">{label}</span>
        {tag && (
          <span className={`shrink-0 rounded-full border px-1.5 text-[9px] font-medium uppercase tracking-wide ${tagStyles[status]}`}>
            {tag}
          </span>
        )}
        {status === 'done' && <span className="ml-auto text-emerald-500 dark:text-emerald-400 text-xs">✓</span>}
      </div>
      <div className="mt-1 font-mono text-[10px] leading-tight text-gray-400 dark:text-gray-500 truncate h-3">
        {showDetail ? detail : status === 'active' ? 'creating…' : ''}
      </div>
    </div>
  )
}

// A derived account nested under an HD wallet — indented with an elbow connector
// to convey that one wallet holds many accounts, potentially of different types.
function WalletAccount({ status, type, text }: { status: CardStatus; type: string; text?: string }) {
  const shown = status === 'done' || status === 'static'
  const active = status === 'active'

  const elbow = shown
    ? 'border-gray-300 dark:border-gray-600'
    : active
    ? 'border-violet-300 dark:border-violet-600'
    : 'border-gray-200 dark:border-gray-800'
  const chip = shown
    ? 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
    : active
    ? 'border-violet-300 dark:border-violet-700 text-violet-500 dark:text-violet-400'
    : 'border-dashed border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-700'
  const tagCls = shown
    ? 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
    : active
    ? 'border-violet-300 dark:border-violet-700 text-violet-500 dark:text-violet-400'
    : 'border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-700'

  return (
    <div className="mt-1.5 flex pl-2">
      <div className={`w-3 h-3.5 shrink-0 rounded-bl-md border-l border-b transition-colors duration-500 ${elbow}`} />
      <div className={`-mt-1 ml-0.5 flex flex-1 min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 transition-all duration-500 ${chip}`}>
        <span className={`shrink-0 rounded-full border px-1.5 text-[9px] font-medium uppercase tracking-wide ${tagCls}`}>
          {type}
        </span>
        <span className="font-mono text-[10px] truncate">
          {shown ? text || '' : active ? 'deriving…' : '—'}
        </span>
      </div>
    </div>
  )
}

// Placeholder shown in the sub-org Policies bucket before any policy exists.
function EmptyPolicy() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 px-3 py-3 text-center">
      <span className="text-[11px] text-gray-400 dark:text-gray-600">No policies yet</span>
    </div>
  )
}

// ── Signing flow lane ────────────────────────────────────────────────────────
// Only rendered once we reach a SIGN_TRANSACTION step. Shows the request path
// API user → policy gate → destination, coloured by the outcome.

type SignState = 'idle' | 'running' | 'approved' | 'blocked'

function SigningLane({ state, target, allowed, label }: { state: SignState; target: string; allowed: boolean; label?: string }) {
  const gate = {
    idle: 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600',
    running: 'border-violet-400 dark:border-violet-500 text-violet-600 dark:text-violet-300 animate-pulse',
    approved: 'border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400',
    blocked: 'border-red-400 dark:border-red-600 text-red-600 dark:text-red-400',
  }[state]

  const arrowColor = {
    idle: 'text-gray-300 dark:text-gray-700',
    running: 'text-violet-400 dark:text-violet-500',
    approved: 'text-emerald-500 dark:text-emerald-400',
    blocked: 'text-red-400 dark:text-red-500',
  }[state]

  const destStyle = {
    idle: 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600',
    running: 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400',
    approved: 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
    blocked: 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 line-through decoration-red-400/60',
  }[state]

  const Arrow = () => (
    <svg className={`w-8 h-4 shrink-0 transition-colors duration-500 ${arrowColor}`} viewBox="0 0 32 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h24m-5-4 5 4-5 4" />
    </svg>
  )

  return (
    <div>
      {label && (
        <div className="mb-1 px-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">{label}</div>
      )}
      <div className="flex items-center gap-1.5 rounded-lg border border-gray-100 dark:border-gray-800/60 bg-gray-50/60 dark:bg-gray-900/40 px-3 py-2.5">
        <div className="flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-gray-600 dark:text-gray-300 shrink-0">
          <Icon kind="user" className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">API user</span>
        </div>

        <Arrow />

        <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors duration-500 shrink-0 ${gate}`}>
          <Icon kind="policy" className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">
            {state === 'approved' ? 'Policy · allow' : state === 'blocked' ? 'Policy · deny' : 'Policy gate'}
          </span>
        </div>

        <Arrow />

        <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors duration-500 min-w-0 ${destStyle}`}>
          <span className="text-[11px] font-medium shrink-0">{allowed ? 'Allowed addr' : 'Other addr'}</span>
          <span className="font-mono text-[10px] truncate">{short(target, 6, 4)}</span>
        </div>

        <div className="ml-auto pl-2 text-[11px] font-medium shrink-0">
          {state === 'approved' && <span className="text-emerald-600 dark:text-emerald-400">✓ Signed</span>}
          {state === 'blocked' && <span className="text-red-600 dark:text-red-400">✕ Rejected</span>}
          {state === 'running' && <span className="text-violet-600 dark:text-violet-400">signing…</span>}
        </div>
      </div>
    </div>
  )
}

// ── Org header ────────────────────────────────────────────────────────────────

function OrgHeader({ title, subtitle, idText, muted, provisioning }: {
  title: string
  subtitle: string
  idText?: string
  muted?: boolean
  provisioning?: boolean
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={muted ? 'text-gray-300 dark:text-gray-700' : 'text-gray-500 dark:text-gray-400'}>
        <Icon kind="building" />
      </span>
      <span className={`text-sm font-semibold ${muted ? 'text-gray-300 dark:text-gray-700' : 'text-gray-800 dark:text-gray-100'}`}>
        {title}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
        {subtitle}
      </span>
      {idText ? (
        <span className="ml-auto font-mono text-[10px] text-gray-400 dark:text-gray-500">{idText}</span>
      ) : provisioning ? (
        <span className="ml-auto text-[10px] text-violet-500 dark:text-violet-400">provisioning…</span>
      ) : null}
    </div>
  )
}

// ── Main diagram ──────────────────────────────────────────────────────────────

const ALLOWED_DISPLAY = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const BLOCKED_DISPLAY = '0x000000000000000000000000000000000000dEaD'

export function ArchitectureDiagram({ steps, stepStates, currentStep, session, parentOrgId }: DiagramProps) {
  // Status for the single-occurrence sub-org resource kinds.
  const nodeStatus = (kind: StepKind): NodeStatus => {
    const i = steps.findIndex((s) => s.kind === kind)
    if (i === -1) return 'ghost'
    const st = stepStates[i]?.status
    if (st === 'success') return 'done'
    if (st === 'running') return 'active'
    if (i === currentStep && st === 'pending') return 'active'
    return 'ghost'
  }

  const subOrg = nodeStatus('CREATE_SUB_ORG')
  const rootUser = subOrg // root user is created as part of the sub-org
  const apiUser = nodeStatus('CREATE_API_USER')
  const policy = nodeStatus('CREATE_POLICY')
  const wallet = nodeStatus('CREATE_WALLET')

  // The sign steps drive the signing lanes. Show a lane for every sign step that
  // has been reached (executed) or is the current step, so an earlier successful
  // "allowed" attempt stays on screen when we advance to the "blocked" attempt.
  const signIndices = steps.map((s, i) => (s.kind === 'SIGN_TRANSACTION' ? i : -1)).filter((i) => i >= 0)
  const signLanes = signIndices
    .filter((i) => stepStates[i]?.status !== 'pending' || i === currentStep)
    .map((i) => {
      const allowed = Boolean((steps[i].params as { useAllowedAddress?: boolean })?.useAllowedAddress)
      const target = allowed ? session.allowedAddress ?? ALLOWED_DISPLAY : BLOCKED_DISPLAY
      const st = stepStates[i]?.status
      const state: SignState =
        st === 'running' ? 'running'
        : st === 'success' ? 'approved'
        : st === 'expected-failure' || st === 'error' ? 'blocked'
        : 'idle'
      return { i, allowed, target, state, label: steps[i].title }
    })

  const subOrgBuilt = subOrg !== 'ghost'

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 overflow-x-auto">
      <div className="flex items-stretch gap-2 min-w-[860px]">
        {/* Parent org — pre-existing; same bucket structure, static cards */}
        <div className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60 px-4 py-3">
          <OrgHeader title="Parent Organization" subtitle="your business" idText={parentOrgId ? short(parentOrgId, 8, 6) : undefined} />
          <div className="grid grid-cols-3 gap-3 items-start">
            <Bucket title="Users">
              <ItemCard icon="user" label="Root users" tag="root" status="static" detail="quorum 2 of 3" />
              <ItemCard icon="user" label="Backend API user" tag="api" status="static" detail="programmatic" />
            </Bucket>
            <Bucket title="Policies">
              <ItemCard icon="policy" label="Create wallets" status="static" detail="allow" />
              <ItemCard icon="policy" label="Sign with wallets" status="static" detail="allow" />
            </Bucket>
            <Bucket title="Wallets">
              <div>
                <ItemCard icon="wallet" label="Business wallet" status="static" detail="HD wallet" />
                <WalletAccount status="static" type="ETH" text="account 0" />
              </div>
            </Bucket>
          </div>
        </div>

        {/* Horizontal connector */}
        <div className="flex flex-col items-center justify-center shrink-0 w-24">
          <span
            className={`text-[9px] font-medium text-center leading-tight px-1 mb-1 transition-colors duration-500 ${
              subOrg === 'active'
                ? 'text-violet-600 dark:text-violet-300'
                : subOrgBuilt
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-300 dark:text-gray-700'
            }`}
          >
            {subOrg === 'active' ? 'creating…' : 'create_sub_organization'}
          </span>
          <svg
            className={`w-full h-4 transition-colors duration-500 ${
              subOrgBuilt ? 'text-violet-400 dark:text-violet-500' : 'text-gray-200 dark:text-gray-800'
            }`}
            viewBox="0 0 96 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8h86m-7-5 7 5-7 5" />
          </svg>
        </div>

        {/* Sub-org — materializes at step 1, then fills the same buckets live */}
        <div
          className={`flex-1 min-w-0 rounded-lg border transition-all duration-500 px-4 py-3 ${
            subOrg === 'ghost'
              ? 'border-dashed border-gray-200 dark:border-gray-800 bg-transparent'
              : subOrg === 'active'
              ? 'border-violet-400 dark:border-violet-500 bg-violet-50/40 dark:bg-violet-950/20 ring-2 ring-violet-200 dark:ring-violet-500/20'
              : 'border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/50'
          }`}
        >
          <OrgHeader
            title="Sub-Organization"
            subtitle="isolated per end-user"
            muted={subOrg === 'ghost'}
            idText={session.subOrgId ? short(session.subOrgId, 8, 6) : undefined}
            provisioning={subOrg === 'active'}
          />
          <div className="grid grid-cols-3 gap-3 items-start">
            <Bucket title="Users">
              <ItemCard icon="user" label="Root user" tag="root" status={rootUser} detail="admin · full access" />
              <ItemCard icon="user" label="API user" tag="non-root" status={apiUser} detail={short(session.apiUserId, 6, 4)} />
            </Bucket>
            <Bucket title="Policies">
              {policy === 'ghost' ? (
                <EmptyPolicy />
              ) : (
                <ItemCard icon="policy" label="Address allowlist" status={policy} detail={short(session.policyId, 6, 4)} />
              )}
            </Bucket>
            <Bucket title="Wallets">
              <div>
                <ItemCard icon="wallet" label="Demo Wallet" status={wallet} detail="HD wallet" />
                <WalletAccount status={wallet} type="ETH" text={short(session.walletAddress, 6, 4)} />
              </div>
            </Bucket>
          </div>

          {signLanes.length > 0 && (
            <div className="mt-3 space-y-2">
              {signLanes.map((l) => (
                <SigningLane key={l.i} state={l.state} target={l.target} allowed={l.allowed} label={l.label} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
