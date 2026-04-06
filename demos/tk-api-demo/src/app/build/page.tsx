'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { StepConfig } from '@/types/scenario'
import { type CatalogItem, CATALOG, computeAvailableState, isAvailable, getMissingKeys, getProvidersForKey, keyLabel } from '@/lib/catalog'
import { Tooltip } from '@/components/ui/tooltip'


const ACTIVITIES = CATALOG.filter((c) => c.category === 'activity')
const QUERIES = CATALOG.filter((c) => c.category === 'query')

// ── Build page ─────────────────────────────────────────────────────────────

export default function BuildPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flow = (searchParams.get('flow') ?? 'sub-org') as 'parent' | 'sub-org'
  const flowLabel = flow === 'parent' ? 'Parent Org' : 'Sub-Org'
  const [selectedSteps, setSelectedSteps] = useState<CatalogItem[]>([])

  const addStep = (item: CatalogItem) => {
    setSelectedSteps((prev) => [...prev, item])
  }

  const removeStep = (index: number) => {
    setSelectedSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    const next = [...selectedSteps]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setSelectedSteps(next)
  }

  const launch = () => {
    const steps: StepConfig[] = selectedSteps.map((item) => ({
      kind: item.kind,
      title: item.title,
      description: item.description,
      params: item.params,
    }))
    sessionStorage.setItem(`custom-setup-${flow}`, JSON.stringify(steps))
    router.push(`/setup/custom/${flow}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
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
          Setup
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Custom {flowLabel} Setup</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Pick operations from the catalog to compose a custom setup. Steps run in order and share session state between them.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-8 items-start">
        {/* Left: Catalog */}
        <div>
          <CatalogSection title="Activities" items={ACTIVITIES} selectedSteps={selectedSteps} onAdd={addStep} />
          <div className="mt-6">
            <CatalogSection title="Queries" items={QUERIES} selectedSteps={selectedSteps} onAdd={addStep} />
          </div>
        </div>

        {/* Right: Builder */}
        <div className="sticky top-6">
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
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-10 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-600">
                Add steps from the catalog to build your scenario.
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-700 mt-1">
                Start with <span className="font-medium">Create Sub-Organization</span>
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

          <button
            onClick={launch}
            disabled={selectedSteps.length === 0}
            className="mt-5 w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {selectedSteps.length === 0 ? 'Add steps to launch' : `Launch ${flowLabel} Setup (${selectedSteps.length} steps) →`}
          </button>
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

// ── Sub-components ─────────────────────────────────────────────────────────

function CatalogSection({
  title,
  items,
  selectedSteps,
  onAdd,
}: {
  title: string
  items: CatalogItem[]
  selectedSteps: CatalogItem[]
  onAdd: (item: CatalogItem) => void
}) {
  const currentAvailable = computeAvailableState(selectedSteps)
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
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
