'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StepConfig, SessionState } from '@/types/scenario'
import {
  type CatalogItem,
  CATALOG_ACTIVITIES,
  CATALOG_QUERIES,
  computeAvailableState,
  isAvailable,
  getMissingKeys,
  getProvidersForKey,
  keyLabel,
} from '@/lib/catalog'
import { Tooltip } from '@/components/ui/tooltip'

// ── Types ───────────────────────────────────────────────────────────────────

interface SubOrg {
  id: string
  name: string
  wallets: { walletId: string; walletName: string }[]
  users: unknown[]
  policies: unknown[]
}

interface OrgMapData {
  parentOrg: {
    id: string
    name: string
    users: unknown[]
    policies: unknown[]
    userTags: unknown[]
    privateKeyTags: unknown[]
    totalSubOrgs: number
  }
  subOrgs: SubOrg[]
  fetchedSubOrgCount: number
}

interface SelectedTarget {
  orgId: string
  name: string
  walletId?: string
  isParent: boolean
}

// ── CatalogSection ─────────────────────────────────────────────────────────

function CatalogSection({
  title,
  items,
  selectedSteps,
  seed,
  onAdd,
}: {
  title: string
  items: CatalogItem[]
  selectedSteps: CatalogItem[]
  seed: Set<string>
  onAdd: (item: CatalogItem) => void
}) {
  const currentAvailable = computeAvailableState(selectedSteps, seed)
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => {
          const available = item.requires.every((r) => currentAvailable.has(r))
          const missing = available ? [] : getMissingKeys(item, currentAvailable)
          const card = (
            <div
              key={item.id}
              className={`border rounded-lg p-3 transition-colors ${
                available
                  ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950'
                  : 'border-gray-100 dark:border-gray-900 bg-gray-50 dark:bg-gray-950/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium leading-snug ${available ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.title}
                    </span>
                    <a
                      href={item.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-px rounded text-[10px] hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                      {item.apiCall} ↗
                    </a>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
                  {item.requires.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">needs:</span>
                      {item.requires.map((r) => (
                        <span
                          key={r}
                          className={`text-[10px] px-1 py-px rounded font-mono ${
                            currentAvailable.has(r)
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => available && onAdd(item)}
                  disabled={!available}
                  className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                >
                  Add
                </button>
              </div>
            </div>
          )

          if (!available && missing.length > 0) {
            return (
              <Tooltip
                key={item.id}
                className="w-full"
                side="right"
                content={
                  <div className="space-y-1.5 text-xs w-64">
                    <p className="font-semibold text-white mb-2">Not yet available</p>
                    {missing.map((key) => {
                      const providers = getProvidersForKey(key)
                      const allSameKind = providers.length > 1 && providers.every(p => p.kind === providers[0].kind)
                      const providerLabel = allSameKind
                        ? `any ${providers[0].kind.toLowerCase().replace(/_/g, ' ')} step`
                        : providers.length <= 2
                          ? providers.map(p => p.title).join(' or ')
                          : `${providers[0].title} (or ${providers.length - 1} similar)`
                      return (
                        <div key={key} className="flex gap-1.5">
                          <span className="text-amber-400 shrink-0">•</span>
                          <span className="text-gray-200">
                            <span className="font-mono text-amber-300">{key}</span>
                            {providers.length > 0
                              ? <> — add <span className="font-medium text-white">{providerLabel}</span> first</>
                              : <> ({keyLabel(key)})</>
                            }
                          </span>
                        </div>
                      )
                    })}
                  </div>
                }
              >
                {card}
              </Tooltip>
            )
          }
          return card
        })}
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function InteractPage() {
  const router = useRouter()
  const [orgData, setOrgData] = useState<OrgMapData | null>(null)
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [orgError, setOrgError] = useState<string | null>(null)
  const [target, setTarget] = useState<SelectedTarget | null>(null)
  const [manualId, setManualId] = useState('')
  const [manualName, setManualName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [selectedSteps, setSelectedSteps] = useState<CatalogItem[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/org-map')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setOrgData(d)
      })
      .catch((e) => setOrgError(String(e)))
      .finally(() => setLoadingOrgs(false))
  }, [])

  // Seed: the state keys that are already available from the selected target
  const seed = target
    ? new Set<string>(['subOrgId', ...(target.walletId ? ['walletId'] : [])])
    : new Set<string>()

  const addStep = (item: CatalogItem) => setSelectedSteps((prev) => [...prev, item])
  const removeStep = (i: number) => setSelectedSteps((prev) => prev.filter((_, j) => j !== i))
  const moveStep = (i: number, dir: -1 | 1) => {
    const next = [...selectedSteps]
    const swap = i + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[i], next[swap]] = [next[swap], next[i]]
    setSelectedSteps(next)
  }

  const selectTarget = (t: SelectedTarget) => {
    setTarget(t)
    setSelectedSteps([])
    setShowManual(false)
  }

  const applyManual = () => {
    const id = manualId.trim()
    if (!id) return
    selectTarget({
      orgId: id,
      name: manualName.trim() || `${id.slice(0, 16)}…`,
      isParent: false,
    })
  }

  const launch = () => {
    if (!target || selectedSteps.length === 0) return
    const steps: StepConfig[] = selectedSteps.map((item) => ({
      kind: item.kind,
      title: item.title,
      description: item.description,
      params: item.params,
    }))
    const initialSessionState: SessionState = {
      subOrgId: target.orgId,
      ...(target.walletId ? { walletId: target.walletId } : {}),
    }
    sessionStorage.setItem(
      'interact-config',
      JSON.stringify({ steps, initialSessionState, targetName: target.name })
    )
    router.push('/interact/run')
  }

  const filteredSubOrgs = orgData?.subOrgs.filter(
    (s) =>
      search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-black.svg" alt="Turnkey" height={20} className="dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.svg" alt="Turnkey" height={20} className="hidden dark:block" />
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-6"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Back
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Interact</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
          Select an existing org, build a custom scenario from the activity and query catalog, then run it live.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-10 items-start">
        {/* Left: Org selector + catalog */}
        <div className="space-y-8">
          {/* Step 1: Select target org */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <span className="mr-2 inline-flex w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-[11px] font-bold items-center justify-center">1</span>
              Select Target Org
            </h2>

            {loadingOrgs && (
              <div className="text-sm text-gray-400 dark:text-gray-600 py-4">Loading orgs…</div>
            )}

            {orgError && (
              <div className="text-sm text-red-500 dark:text-red-400 py-4">
                Failed to load orgs: {orgError}
              </div>
            )}

            {orgData && (
              <div className="space-y-2">
                {/* Parent org */}
                <button
                  onClick={() =>
                    selectTarget({
                      orgId: orgData.parentOrg.id,
                      name: orgData.parentOrg.name || 'Parent Org',
                      isParent: true,
                    })
                  }
                  className={`w-full text-left border rounded-xl px-4 py-3 transition-all ${
                    target?.orgId === orgData.parentOrg.id
                      ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-violet-300 dark:hover:border-violet-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-px rounded-full">Parent</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {orgData.parentOrg.name || 'Parent Org'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 truncate">{orgData.parentOrg.id}</p>
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-600 shrink-0 space-y-0.5 text-right">
                      <p>{orgData.parentOrg.users.length} user{orgData.parentOrg.users.length !== 1 ? 's' : ''}</p>
                      <p>{orgData.parentOrg.policies.length} polic{orgData.parentOrg.policies.length !== 1 ? 'ies' : 'y'}</p>
                    </div>
                  </div>
                </button>

                {/* Sub-orgs */}
                {orgData.subOrgs.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Sub-Orgs ({orgData.subOrgs.length})
                      </span>
                      {orgData.subOrgs.length > 4 && (
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Filter…"
                          className="flex-1 text-xs border border-gray-200 dark:border-gray-800 rounded-md px-2 py-0.5 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-700 outline-none focus:border-violet-400 dark:focus:border-violet-600"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {filteredSubOrgs.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() =>
                            selectTarget({
                              orgId: sub.id,
                              name: sub.name,
                              walletId: sub.wallets[0]?.walletId,
                              isParent: false,
                            })
                          }
                          className={`w-full text-left border rounded-xl px-4 py-3 transition-all ${
                            target?.orgId === sub.id
                              ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                              : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-violet-300 dark:hover:border-violet-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{sub.name}</p>
                              <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 truncate">{sub.id}</p>
                            </div>
                            <div className="text-[11px] text-gray-400 dark:text-gray-600 shrink-0 space-y-0.5 text-right">
                              <p>{sub.wallets.length} wallet{sub.wallets.length !== 1 ? 's' : ''}</p>
                              <p>{sub.users.length} user{sub.users.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                      {filteredSubOrgs.length === 0 && search !== '' && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 py-2 px-1">No sub-orgs match &ldquo;{search}&rdquo;.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Manual entry */}
                {showManual ? (
                  <div className="border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Enter Org ID manually</p>
                    <input
                      type="text"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      placeholder="Organization ID (UUID)"
                      className="w-full text-xs font-mono border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-700 outline-none focus:border-violet-400 dark:focus:border-violet-600"
                    />
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Display name (optional)"
                      className="w-full text-xs border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-700 outline-none focus:border-violet-400 dark:focus:border-violet-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={applyManual}
                        disabled={!manualId.trim()}
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-white transition-colors"
                      >
                        Use this ID
                      </button>
                      <button
                        onClick={() => { setShowManual(false); setManualId(''); setManualName('') }}
                        className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowManual(true)}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors py-1"
                  >
                    + Enter org ID manually
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Catalog (only shown after target is selected) */}
          {target && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                <span className="mr-2 inline-flex w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-[11px] font-bold items-center justify-center">2</span>
                Build Scenario
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 ml-7">
                <span className="font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 px-1 py-px rounded text-[10px]">subOrgId</span>
                {target.walletId && (
                  <> and <span className="font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 px-1 py-px rounded text-[10px]">walletId</span></>
                )}
                {' '}pre-seeded from selected org — all dependent steps are unlocked.
              </p>
              <CatalogSection
                title="Activities"
                items={CATALOG_ACTIVITIES}
                selectedSteps={selectedSteps}
                seed={seed}
                onAdd={addStep}
              />
              <div className="mt-5">
                <CatalogSection
                  title="Queries"
                  items={CATALOG_QUERIES}
                  selectedSteps={selectedSteps}
                  seed={seed}
                  onAdd={addStep}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Selected target summary + scenario builder */}
        <div className="sticky top-6 space-y-6">
          {/* Target summary */}
          {target ? (
            <div className="border border-violet-200 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-0.5">
                    {target.isParent ? 'Parent Org' : 'Sub-Org'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{target.name}</p>
                  <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 break-all">{target.orgId}</p>
                  {target.walletId && (
                    <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 break-all">
                      wallet: {target.walletId}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setTarget(null); setSelectedSteps([]) }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors shrink-0"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-600">
                Select an org on the left to get started.
              </p>
            </div>
          )}

          {/* Scenario builder */}
          {target && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Your Scenario
                    {selectedSteps.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                        {selectedSteps.length} step{selectedSteps.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </h2>
                  {selectedSteps.length > 0 && (
                    <button
                      onClick={() => setSelectedSteps([])}
                      className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {selectedSteps.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
                    <p className="text-sm text-gray-400 dark:text-gray-600">
                      Add steps from the catalog.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedSteps.map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="flex items-start gap-3 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-950"
                      >
                        <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{item.title}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{item.apiCall}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => moveStep(i, -1)}
                            disabled={i === 0}
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveStep(i, 1)}
                            disabled={i === selectedSteps.length - 1}
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeStep(i)}
                            className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={launch}
                disabled={selectedSteps.length === 0}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                {selectedSteps.length === 0
                  ? 'Add steps to launch'
                  : `Run Scenario (${selectedSteps.length} step${selectedSteps.length !== 1 ? 's' : ''}) →`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-black.svg" alt="Secured by Turnkey" height={18} className="dark:hidden opacity-40" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-white.svg" alt="Secured by Turnkey" height={18} className="hidden dark:block opacity-30" />
      </div>
    </div>
  )
}
