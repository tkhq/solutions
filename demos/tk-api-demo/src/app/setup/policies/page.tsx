'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PolicyBuilderModal } from '@/components/policy/PolicyBuilderModal'
import type { TurnkeyPolicy } from '@/types/policy'

// ── Types ───────────────────────────────────────────────────────────────────

type OrgUser = {
  id: string
  name: string
}

type OrgOption = {
  id: string
  name: string
  isParent: boolean
  policyCount: number
  users: OrgUser[]
}

type Policy = {
  policyId: string
  policyName: string
  effect: 'EFFECT_ALLOW' | 'EFFECT_DENY'
  condition: string
  consensus: string
  notes?: string
  status?: string
}

// ── Root page ───────────────────────────────────────────────────────────────

export default function PolicyManagerPage() {
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedOrg, setSelectedOrg] = useState<OrgOption | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loadingPolicies, setLoadingPolicies] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)

  const [policyBuilderOpen, setPolicyBuilderOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Policy | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Load org list on mount
  useEffect(() => {
    fetch('/api/org-map')
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        if (data.error) { setLoadError(data.error); setLoadingOrgs(false); return }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toUsers = (rawUsers: any[]): OrgUser[] =>
          (rawUsers ?? []).map((u) => ({ id: u.userId, name: u.username || u.userName || u.userEmail || u.userId }))

        const all: OrgOption[] = [
          {
            id: data.parentOrg.id,
            name: data.parentOrg.name,
            isParent: true,
            policyCount: data.parentOrg.policies?.length ?? 0,
            users: toUsers(data.parentOrg.users),
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...data.subOrgs.map((s: any) => ({
            id: s.id,
            name: s.name,
            isParent: false,
            policyCount: s.policies?.length ?? 0,
            users: toUsers(s.users),
          })),
        ]
        setOrgs(all)
        setLoadingOrgs(false)
      })
      .catch((e) => { setLoadError(String(e)); setLoadingOrgs(false) })
  }, [])

  const loadPolicies = useCallback(async (org: OrgOption) => {
    setLoadingPolicies(true)
    setPolicyError(null)
    try {
      const r = await fetch(`/api/policies?orgId=${encodeURIComponent(org.id)}`)
      const data = await r.json()
      if (data.error) { setPolicyError(data.error); return }
      const policies = data.policies ?? []
      setPolicies(policies)
      // Keep policyCount in the org selector in sync
      setOrgs((prev) => prev.map((o) => o.id === org.id ? { ...o, policyCount: policies.length } : o))
    } catch (e) {
      setPolicyError(String(e))
    } finally {
      setLoadingPolicies(false)
    }
  }, [])

  const handleSelectOrg = (org: OrgOption) => {
    setSelectedOrg(org)
    loadPolicies(org)
  }

  const handleApplyPolicy = async (policy: TurnkeyPolicy) => {
    if (!selectedOrg) return
    setSaving(true)
    setActionError(null)
    try {
      const url = '/api/policies'
      const method = editingPolicy ? 'PATCH' : 'POST'
      const body = editingPolicy
        ? { orgId: selectedOrg.id, policyId: editingPolicy.policyId, policyName: policy.policyName, effect: policy.effect, condition: policy.condition ?? '', consensus: policy.consensus ?? '', notes: policy.notes ?? '' }
        : { orgId: selectedOrg.id, policyName: policy.policyName, effect: policy.effect, condition: policy.condition ?? '', consensus: policy.consensus ?? '', notes: policy.notes ?? '' }
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await r.json()
      if (data.error) { setActionError(data.error); return }
      await loadPolicies(selectedOrg)
    } catch (e) {
      setActionError(String(e))
    } finally {
      setSaving(false)
      setEditingPolicy(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedOrg || !deleteTarget) return
    setDeleting(true)
    setActionError(null)
    try {
      const r = await fetch('/api/policies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: selectedOrg.id, policyId: deleteTarget.policyId }),
      })
      const data = await r.json()
      if (data.error) { setActionError(data.error); return }
      setDeleteTarget(null)
      await loadPolicies(selectedOrg)
    } catch (e) {
      setActionError(String(e))
    } finally {
      setDeleting(false)
    }
  }

  // ── Header (always shown) ──────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between mb-10">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-black.svg" alt="Turnkey" height={20} className="dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-white.svg" alt="Turnkey" height={20} className="hidden dark:block" />
      </div>
      {selectedOrg ? (
        <button
          onClick={() => { setSelectedOrg(null); setPolicies([]); setActionError(null) }}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Change Organization
        </button>
      ) : (
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Setup
        </Link>
      )}
    </div>
  )

  // ── Loading orgs ───────────────────────────────────────────────────────────
  if (loadingOrgs) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        {header}
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading organizations…</span>
        </div>
      </div>
    )
  }

  // ── Error loading orgs ─────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        {header}
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 px-5 py-4 text-sm text-red-700 dark:text-red-400">
          Failed to load organizations: {loadError}
        </div>
      </div>
    )
  }

  // ── Org selector ───────────────────────────────────────────────────────────
  if (!selectedOrg) {
    const parentOrg = orgs.find((o) => o.isParent)
    const subOrgs = orgs.filter((o) => !o.isParent)
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        {header}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Policy Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select an organization to view and manage its policies.
          </p>
        </div>

        {/* Parent org */}
        {parentOrg && (
          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Parent Organization</p>
            <button
              onClick={() => handleSelectOrg(parentOrg)}
              className="w-full text-left group border border-gray-200 dark:border-gray-800 rounded-xl p-5 bg-white dark:bg-transparent hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                      {parentOrg.name}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                      Parent
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-600 font-mono">{parentOrg.id}</p>
                </div>
                <div className="flex items-center gap-4">
                  <PolicyCountBadge count={parentOrg.policyCount} />
                  <span className="text-gray-400 dark:text-gray-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors">→</span>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Sub-orgs */}
        {subOrgs.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
              Sub-Organizations <span className="normal-case font-normal">({subOrgs.length})</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {subOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className="text-left group border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-transparent hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors truncate">
                        {org.name}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-600 font-mono mt-0.5 truncate">
                        {org.id.slice(0, 8)}…{org.id.slice(-4)}
                      </p>
                    </div>
                    <PolicyCountBadge count={org.policyCount} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {subOrgs.length === 0 && (
          <div className="mt-2 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">No sub-organizations found.</p>
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/secured-by-black.svg" alt="Secured by Turnkey" height={18} className="dark:hidden opacity-40" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/secured-by-white.svg" alt="Secured by Turnkey" height={18} className="hidden dark:block opacity-30" />
        </div>
      </div>
    )
  }

  // ── Policy manager ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {header}

      {/* Org context bar */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Policy Manager</h1>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedOrg.name}</span>
          {selectedOrg.isParent && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">Parent</span>
          )}
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{selectedOrg.id.slice(0, 8)}…{selectedOrg.id.slice(-6)}</span>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-start justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 text-red-400 hover:text-red-600 transition-colors">✕</button>
        </div>
      )}

      {/* Policies header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Policies
          {!loadingPolicies && (
            <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
              ({policies.length})
            </span>
          )}
        </h2>
        <button
          onClick={() => { setEditingPolicy(null); setPolicyBuilderOpen(true) }}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Policy
        </button>
      </div>

      {/* Policy list */}
      {loadingPolicies ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Loading policies…</span>
        </div>
      ) : policyError ? (
        <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {policyError}
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-600">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">No policies</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">Create a policy to start controlling access for this organization.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.policyId}
              policy={policy}
              onEdit={() => { setEditingPolicy(policy); setPolicyBuilderOpen(true) }}
              onDelete={() => setDeleteTarget(policy)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Policy</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Are you sure you want to delete <span className="font-medium text-gray-900 dark:text-white">{deleteTarget.policyName}</span>?
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">This cannot be undone. Any access controlled by this policy will be revoked immediately.</p>
            {actionError && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-4">{actionError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : 'Delete Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy builder modal */}
      <PolicyBuilderModal
        open={policyBuilderOpen}
        onClose={() => { setPolicyBuilderOpen(false); setEditingPolicy(null) }}
        onApply={handleApplyPolicy}
        title={editingPolicy ? 'Edit Policy' : 'Create Policy'}
        subtitle={
          editingPolicy
            ? `Editing "${editingPolicy.policyName}" — the condition and consensus will be replaced by your new settings.`
            : 'Build a policy visually and save it to this organization.'
        }
        applyLabel={editingPolicy ? 'Save Changes' : 'Save Policy'}
        initialPolicy={editingPolicy ? { policyName: editingPolicy.policyName, effect: editingPolicy.effect } : undefined}
        orgUsers={selectedOrg?.users}
      />

      <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-black.svg" alt="Secured by Turnkey" height={18} className="dark:hidden opacity-40" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-white.svg" alt="Secured by Turnkey" height={18} className="hidden dark:block opacity-30" />
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PolicyCountBadge({ count }: { count: number }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      count > 0
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
    }`}>
      {count} {count === 1 ? 'policy' : 'policies'}
    </span>
  )
}

function PolicyCard({
  policy,
  onEdit,
  onDelete,
}: {
  policy: Policy
  onEdit: () => void
  onDelete: () => void
}) {
  const isAllow = policy.effect === 'EFFECT_ALLOW'

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-transparent overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
            isAllow
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {isAllow ? 'Allow' : 'Deny'}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {policy.policyName}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-violet-300 dark:hover:border-violet-700 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        {policy.condition && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600 pt-0.5 w-20 shrink-0">Condition</span>
            <code className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all leading-relaxed line-clamp-2">
              {policy.condition}
            </code>
          </div>
        )}
        {policy.consensus && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600 pt-0.5 w-20 shrink-0">Consensus</span>
            <code className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all leading-relaxed line-clamp-2">
              {policy.consensus}
            </code>
          </div>
        )}
        {policy.notes && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600 pt-0.5 w-20 shrink-0">Notes</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{policy.notes}</span>
          </div>
        )}
        {!policy.condition && !policy.consensus && !policy.notes && (
          <p className="text-xs text-gray-400 dark:text-gray-600 italic">No condition or consensus defined.</p>
        )}
      </div>

      {/* Policy ID footer */}
      <div className="px-4 pb-3">
        <span className="text-[10px] text-gray-300 dark:text-gray-700 font-mono">{policy.policyId}</span>
      </div>
    </div>
  )
}
