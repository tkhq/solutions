"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { PolicyBuilder } from "@/components/policy/PolicyBuilder"
import type { TurnkeyPolicy } from "@/types/policy"

interface OrgUser {
  id: string
  name: string
}

interface PolicyBuilderModalProps {
  open: boolean
  onClose: () => void
  /** May be async — the modal waits for the promise to resolve before closing. */
  onApply: (policy: TurnkeyPolicy) => void | Promise<void>
  title?: string
  subtitle?: string
  applyLabel?: string
  initialPolicy?: { policyName?: string; effect?: 'EFFECT_ALLOW' | 'EFFECT_DENY' }
  orgUsers?: OrgUser[]
}

export function PolicyBuilderModal({ open, onClose, onApply, title, subtitle, applyLabel, initialPolicy, orgUsers }: PolicyBuilderModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title ?? 'Policy Builder'}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle ?? 'Build a policy visually, then click \u201cApply to Step\u201d to inject it into the request.'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close policy builder"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <PolicyBuilder
            onApply={async (policy) => { await onApply(policy); onClose() }}
            applyLabel={applyLabel}
            initialPolicy={initialPolicy}
            orgUsers={orgUsers}
          />
        </div>
      </div>
    </div>
  )
}
