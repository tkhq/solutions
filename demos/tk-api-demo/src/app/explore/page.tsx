'use client'

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface OrgPolicy {
  policyId: string
  policyName: string
  effect: string
  condition?: string
  consensus?: string
  notes?: string
}

interface OrgUser {
  userId: string
  userName: string
  userType?: string
  apiKeys?: Array<{ apiKeyId: string; apiKeyName: string }>
  userTagIds?: string[]
}

interface OrgWallet {
  walletId: string
  walletName: string
  accounts?: Array<{ address: string; addressFormat: string; path?: string }>
}

interface OrgTag {
  userTagId?: string
  userTagName?: string
  privateKeyTagId?: string
  privateKeyTagName?: string
}

interface SubOrg {
  id: string
  name: string
  users: OrgUser[]
  wallets: OrgWallet[]
  policies: OrgPolicy[]
}

interface ParentOrg {
  id: string
  name: string
  users: OrgUser[]
  policies: OrgPolicy[]
  userTags: OrgTag[]
  privateKeyTags: OrgTag[]
  totalSubOrgs: number
}

interface OrgMapData {
  parentOrg: ParentOrg
  subOrgs: SubOrg[]
  fetchedSubOrgCount: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
}

function formatDate(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Small components ──────────────────────────────────────────────────────────

function EffectBadge({ effect }: { effect: string }) {
  const allow = effect === 'EFFECT_ALLOW'
  return (
    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
      allow
        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
    }`}>
      {allow ? 'allow' : 'deny'}
    </span>
  )
}

function UserTypeBadge({ type }: { type?: string }) {
  if (!type) return null
  const isApi = type === 'USER_TYPE_API_KEY_ONLY'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      isApi
        ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
    }`}>
      {isApi ? 'API' : 'Human'}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-[10px] text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors ml-1"
    >
      {copied ? '✓' : 'copy'}
    </button>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</h3>
        {count !== undefined && (
          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-medium">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-gray-400 dark:text-gray-600 italic">{label}</p>
}

// ── Policy row ────────────────────────────────────────────────────────────────

function PolicyRow({ policy, inherited = false }: { policy: OrgPolicy; inherited?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!(policy.condition || policy.consensus || policy.notes)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
        onClick={() => hasDetail && setExpanded((e) => !e)}
      >
        <EffectBadge effect={policy.effect} />
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
          {policy.policyName}
        </span>
        {inherited && (
          <span className="text-[10px] text-gray-400 dark:text-gray-600 italic shrink-0">inherited</span>
        )}
        {hasDetail && (
          <span className="text-gray-400 dark:text-gray-600 text-xs shrink-0">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 py-3 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800 space-y-3">
          {policy.condition && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                Condition
              </div>
              <code className="text-xs font-mono text-violet-700 dark:text-violet-300 break-all leading-relaxed">
                {policy.condition}
              </code>
            </div>
          )}
          {policy.consensus && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                Consensus
              </div>
              <code className="text-xs font-mono text-violet-700 dark:text-violet-300 break-all leading-relaxed">
                {policy.consensus}
              </code>
            </div>
          )}
          {policy.notes && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
                Notes
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{policy.notes}</p>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono">{policy.policyId}</span>
            <CopyButton text={policy.policyId} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-org tree node card ────────────────────────────────────────────────────

const SubOrgNode = ({
  sub,
  selected,
  onClick,
  nodeRef,
}: {
  sub: SubOrg
  selected: boolean
  onClick: () => void
  nodeRef: (el: HTMLDivElement | null) => void
}) => (
  <div
    ref={nodeRef}
    onClick={onClick}
    className={`cursor-pointer rounded-xl border p-4 w-44 shrink-0 transition-all select-none ${
      selected
        ? 'border-violet-400 dark:border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-md shadow-violet-100 dark:shadow-violet-900/30'
        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-sm'
    }`}
  >
    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-1">
      Sub-Org
    </div>
    <div className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-1.5">
      {sub.name}
    </div>
    <div className="text-[10px] font-mono text-gray-400 dark:text-gray-600 mb-3 truncate">
      {shortId(sub.id)}
    </div>
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-violet-600 dark:text-violet-400">◈</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{sub.wallets.length} wallet{sub.wallets.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-blue-500 dark:text-blue-400">●</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{sub.users.length} user{sub.users.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">▪</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{sub.policies.length} polic{sub.policies.length !== 1 ? 'ies' : 'y'}</span>
      </div>
    </div>
  </div>
)

// ── Parent org node card ──────────────────────────────────────────────────────

const ParentOrgNode = ({
  org,
  selected,
  onClick,
  nodeRef,
}: {
  org: ParentOrg
  selected: boolean
  onClick: () => void
  nodeRef: (el: HTMLDivElement | null) => void
}) => (
  <div
    ref={nodeRef}
    onClick={onClick}
    className={`cursor-pointer rounded-2xl border-2 p-6 w-80 transition-all select-none ${
      selected
        ? 'border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-900/20 shadow-lg shadow-violet-100 dark:shadow-violet-900/30'
        : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
        Parent Org
      </span>
    </div>
    <div className="text-lg font-bold text-gray-900 dark:text-white mb-1 leading-snug">
      {org.name}
    </div>
    <div className="text-[11px] font-mono text-gray-400 dark:text-gray-600 mb-4 truncate">
      {shortId(org.id)}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-blue-500 dark:text-blue-400">●</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{org.users.length} users</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">▪</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{org.policies.length} policies</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-amber-500 dark:text-amber-400">⬡</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{org.userTags.length} user tags</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-amber-500 dark:text-amber-400">⬡</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{org.privateKeyTags.length} key tags</span>
      </div>
      <div className="col-span-2 flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 dark:text-gray-600">⤷</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{org.totalSubOrgs} sub-orgs</span>
      </div>
    </div>
  </div>
)

// ── Detail panel ──────────────────────────────────────────────────────────────

function ParentOrgDetail({ org }: { org: ParentOrg }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-1">
          Parent Org
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{org.name}</h2>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs font-mono text-gray-400 dark:text-gray-600">{org.id}</span>
          <CopyButton text={org.id} />
        </div>
      </div>

      {/* Policies — top-level policies flow down to all sub-orgs */}
      <Section title="Policies" count={org.policies.length}>
        {org.policies.length === 0 ? (
          <EmptyState label="No policies defined" />
        ) : (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 leading-relaxed">
              These policies apply to the parent org itself. Sub-orgs may override or add their own policies.
            </p>
            <div className="space-y-2">
              {org.policies.map((p) => (
                <PolicyRow key={p.policyId} policy={p} />
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Users */}
      <Section title="Users" count={org.users.length}>
        {org.users.length === 0 ? (
          <EmptyState label="No users" />
        ) : (
          <div className="space-y-2">
            {org.users.map((u) => (
              <div key={u.userId} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.userName}</span>
                    <UserTypeBadge type={u.userType} />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">{shortId(u.userId)}</span>
                    <CopyButton text={u.userId} />
                  </div>
                </div>
                {u.apiKeys && u.apiKeys.length > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">{u.apiKeys.length} API key{u.apiKeys.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Tags */}
      <div className="grid grid-cols-2 gap-6">
        <Section title="User Tags" count={org.userTags.length}>
          {org.userTags.length === 0 ? (
            <EmptyState label="No user tags" />
          ) : (
            <div className="space-y-1.5">
              {org.userTags.map((t, i) => (
                <div key={t.userTagId ?? i} className="flex items-center justify-between rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.userTagName}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">{t.userTagId ? shortId(t.userTagId) : ''}</span>
                    {t.userTagId && <CopyButton text={t.userTagId} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Private Key Tags" count={org.privateKeyTags.length}>
          {org.privateKeyTags.length === 0 ? (
            <EmptyState label="No key tags" />
          ) : (
            <div className="space-y-1.5">
              {org.privateKeyTags.map((t, i) => (
                <div key={t.privateKeyTagId ?? i} className="flex items-center justify-between rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.privateKeyTagName}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">{t.privateKeyTagId ? shortId(t.privateKeyTagId) : ''}</span>
                    {t.privateKeyTagId && <CopyButton text={t.privateKeyTagId} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function SubOrgDetail({
  sub,
  parentPolicies,
  onDelete,
}: {
  sub: SubOrg
  parentPolicies: OrgPolicy[]
  onDelete: () => void
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Sub-Org
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{sub.name}</h2>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-600">{sub.id}</span>
            <CopyButton text={sub.id} />
          </div>
        </div>
        {!showDeleteDialog && (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="shrink-0 text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-800/60 hover:border-red-400 dark:hover:border-red-600 px-3 py-1.5 rounded-lg transition-all"
          >
            Delete
          </button>
        )}
      </div>

      {/* Delete dialog */}
      {showDeleteDialog && (
        <DeleteSubOrgDialog
          sub={sub}
          onDeleted={onDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}

      {/* Wallets */}
      <Section title="Wallets" count={sub.wallets.length}>
        {sub.wallets.length === 0 ? (
          <EmptyState label="No wallets" />
        ) : (
          <div className="space-y-2">
            {sub.wallets.map((w) => (
              <div key={w.walletId} className="rounded-lg border border-violet-100 dark:border-violet-900/30 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-violet-50 dark:bg-violet-900/10">
                  <div className="flex items-center gap-2">
                    <span className="text-violet-500 dark:text-violet-400 text-sm">◈</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{w.walletName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">{shortId(w.walletId)}</span>
                    <CopyButton text={w.walletId} />
                  </div>
                </div>
                {w.accounts && w.accounts.length > 0 && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {w.accounts.map((a, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-0.5">
                            {a.addressFormat?.replace('ADDRESS_FORMAT_', '')}
                            {a.path && <span className="ml-2 font-mono text-gray-300 dark:text-gray-700">{a.path}</span>}
                          </div>
                          <code className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{a.address}</code>
                        </div>
                        <CopyButton text={a.address} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Users */}
      <Section title="Users" count={sub.users.length}>
        {sub.users.length === 0 ? (
          <EmptyState label="No users" />
        ) : (
          <div className="space-y-2">
            {sub.users.map((u) => (
              <div key={u.userId} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.userName}</span>
                    <UserTypeBadge type={u.userType} />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">{shortId(u.userId)}</span>
                    <CopyButton text={u.userId} />
                  </div>
                </div>
                {u.apiKeys && u.apiKeys.length > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">
                    {u.apiKeys.length} API key{u.apiKeys.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Policies — sub-org + inherited from parent */}
      <Section
        title="Policies"
        count={sub.policies.length + parentPolicies.length}
      >
        {sub.policies.length + parentPolicies.length === 0 ? (
          <EmptyState label="No policies" />
        ) : (
          <div className="space-y-2">
            {sub.policies.map((p) => (
              <PolicyRow key={p.policyId} policy={p} />
            ))}
            {parentPolicies.length > 0 && sub.policies.length > 0 && (
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                <span className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider">from parent org</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
            )}
            {parentPolicies.map((p) => (
              <PolicyRow key={p.policyId} policy={p} inherited />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Delete sub-org dialog ─────────────────────────────────────────────────────

function DeleteSubOrgDialog({
  sub,
  onDeleted,
  onCancel,
}: {
  sub: SubOrg
  onDeleted: () => void
  onCancel: () => void
}) {
  const [deleteWithoutExport, setDeleteWithoutExport] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/delete-sub-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subOrgId: sub.id, deleteWithoutExport }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)
      onDeleted()
    } catch (e) {
      setError(String(e))
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/10 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
          Delete &ldquo;{sub.name}&rdquo;?
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
          This permanently removes the sub-organization and all its contents from Turnkey. This action cannot be undone.
        </p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={deleteWithoutExport}
          onChange={(e) => setDeleteWithoutExport(e.target.checked)}
          className="mt-0.5 rounded border-red-300 dark:border-red-700 accent-red-600"
        />
        <div>
          <p className="text-xs font-medium text-red-700 dark:text-red-400 leading-snug">
            Delete even if wallets haven&apos;t been exported
          </p>
          <p className="text-[11px] text-red-500 dark:text-red-500/80 mt-0.5 leading-relaxed">
            Turnkey blocks deletion by default to protect unexported keys. Check this to force delete regardless.
          </p>
        </div>
      </label>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg px-3 py-2 font-mono break-all">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          {deleting && (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {deleting ? 'Deleting…' : 'Confirm Delete'}
        </button>
        <button
          onClick={onCancel}
          disabled={deleting}
          className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [data, setData] = useState<OrgMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<'parent' | string>('parent')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // SVG line refs
  const containerRef = useRef<HTMLDivElement>(null)
  const parentNodeRef = useRef<HTMLDivElement>(null)
  const subOrgRefs = useRef<(HTMLDivElement | null)[]>([])
  const [svgDims, setSvgDims] = useState({ w: 0, h: 0 })
  const [lines, setLines] = useState<Array<{ d: string; highlight: boolean }>>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/org-map')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as OrgMapData & { error?: string }
      if (json.error) throw new Error(json.error)
      setData(json)
      setLastUpdated(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset sub-org refs array length when data changes
  useEffect(() => {
    subOrgRefs.current = subOrgRefs.current.slice(0, data?.subOrgs.length ?? 0)
  }, [data])

  const computeLines = useCallback(() => {
    if (!containerRef.current || !parentNodeRef.current) {
      setLines([])
      return
    }
    const cRect = containerRef.current.getBoundingClientRect()
    const pRect = parentNodeRef.current.getBoundingClientRect()

    const px = pRect.left - cRect.left + pRect.width / 2
    const py = pRect.bottom - cRect.top

    const newLines = subOrgRefs.current.map((ref): { d: string; highlight: boolean } | null => {
      if (!ref) return null
      const rRect = ref.getBoundingClientRect()
      const cx = rRect.left - cRect.left + rRect.width / 2
      const cy = rRect.top - cRect.top
      const my = py + (cy - py) * 0.5
      const highlight = selectedNode === ref.dataset.id
      return {
        d: `M ${px} ${py} C ${px} ${my}, ${cx} ${my}, ${cx} ${cy}`,
        highlight,
      }
    }).filter((l): l is { d: string; highlight: boolean } => l !== null)

    setSvgDims({ w: cRect.width, h: cRect.height })
    setLines(newLines)
  }, [selectedNode])

  useLayoutEffect(() => {
    computeLines()
  }, [data, selectedNode, computeLines])

  useEffect(() => {
    const observer = new ResizeObserver(computeLines)
    const el = containerRef.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [computeLines])

  const selectedSubOrg = data?.subOrgs.find((s) => s.id === selectedNode) ?? null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Setup
          </Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-black.svg" alt="Turnkey" height={16} className="dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-white.svg" alt="Turnkey" height={16} className="hidden dark:block" />
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Org Explorer</span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && !loading && (
            <span className="text-xs text-gray-400 dark:text-gray-600">
              Updated {formatDate(lastUpdated)}
            </span>
          )}
          <a
            href="https://app.turnkey.com/dashboard/auth/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 border border-violet-200 dark:border-violet-800/60 hover:border-violet-400 dark:hover:border-violet-600 px-3 py-1.5 rounded-lg transition-all"
          >
            Turnkey Dashboard
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            <svg
              className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M4.582 9A8 8 0 0120 12m-.582 3A8 8 0 014 12" />
            </svg>
            {loading ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div className="mx-8 mt-6 p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-gray-400 dark:text-gray-600">
            <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">Fetching org structure…</span>
          </div>
        </div>
      )}

      {/* Main content */}
      {data && (
        <div className="flex-1 flex flex-col">
          {/* Tree visualization */}
          <div className="px-8 py-8 overflow-x-auto">
            <div ref={containerRef} className="relative min-w-max mx-auto" style={{ minHeight: data.subOrgs.length > 0 ? 320 : 160 }}>
              {/* SVG lines overlay */}
              <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                width={svgDims.w}
                height={svgDims.h}
                style={{ zIndex: 0 }}
              >
                <defs>
                  <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4">
                    <circle cx="5" cy="5" r="4" className="fill-gray-300 dark:fill-gray-700" />
                  </marker>
                  <marker id="dot-active" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4">
                    <circle cx="5" cy="5" r="4" className="fill-violet-400 dark:fill-violet-500" />
                  </marker>
                </defs>
                {lines.map((line, i) => (
                  <path
                    key={i}
                    d={line.d}
                    fill="none"
                    strokeWidth={line.highlight ? 2 : 1}
                    strokeDasharray={line.highlight ? undefined : '4 3'}
                    className={
                      line.highlight
                        ? 'stroke-violet-400 dark:stroke-violet-500'
                        : 'stroke-gray-300 dark:stroke-gray-700'
                    }
                    markerEnd={line.highlight ? 'url(#dot-active)' : 'url(#dot)'}
                  />
                ))}
              </svg>

              {/* Parent node */}
              <div className="relative flex justify-center mb-16" style={{ zIndex: 1 }}>
                <ParentOrgNode
                  org={data.parentOrg}
                  selected={selectedNode === 'parent'}
                  onClick={() => setSelectedNode('parent')}
                  nodeRef={(el) => { parentNodeRef.current = el }}
                />
              </div>

              {/* Sub-org nodes */}
              {data.subOrgs.length > 0 && (
                <div className="relative flex gap-4 justify-center flex-wrap" style={{ zIndex: 1 }}>
                  {data.subOrgs.map((sub, i) => (
                    <SubOrgNode
                      key={sub.id}
                      sub={sub}
                      selected={selectedNode === sub.id}
                      onClick={() => setSelectedNode(selectedNode === sub.id ? 'parent' : sub.id)}
                      nodeRef={(el) => {
                        subOrgRefs.current[i] = el
                        if (el) el.dataset.id = sub.id
                      }}
                    />
                  ))}
                  {data.parentOrg.totalSubOrgs > data.fetchedSubOrgCount && (
                    <div className="w-44 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center text-xs text-gray-400 dark:text-gray-600 p-4">
                      +{data.parentOrg.totalSubOrgs - data.fetchedSubOrgCount} more
                    </div>
                  )}
                </div>
              )}

              {data.subOrgs.length === 0 && !loading && (
                <div className="flex justify-center">
                  <p className="text-sm text-gray-400 dark:text-gray-600 italic">No sub-orgs yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="px-8 mb-6">
            <div className="border-t border-gray-200 dark:border-gray-800" />
          </div>

          {/* Detail panel */}
          <div className="px-8 pb-16 max-w-3xl">
            {selectedNode === 'parent' ? (
              <ParentOrgDetail org={data.parentOrg} />
            ) : selectedSubOrg ? (
              <SubOrgDetail
                sub={selectedSubOrg}
                parentPolicies={data.parentOrg.policies}
                onDelete={() => {
                  setSelectedNode('parent')
                  fetchData()
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
