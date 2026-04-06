"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Filter, ExternalLink, ChevronDown, ChevronRight } from "lucide-react"
import { EthereumConditions } from "@/components/policy/chains/EthereumConditions"
import { SolanaConditions } from "@/components/policy/chains/SolanaConditions"
import { TronConditions } from "@/components/policy/chains/TronConditions"
import { BitcoinConditions } from "@/components/policy/chains/BitcoinConditions"
import { ActivityConditions } from "@/components/policy/chains/ActivityConditions"
import { SigningResourceConditions } from "@/components/policy/chains/SigningResourceConditions"
import type {
  ConditionConfig, ChainType, EthereumCondition, SolanaConditionConfig,
  TronCondition, BitcoinConditionConfig, ActivityCondition, SigningResourceCondition,
} from "@/types/policy"

interface ConditionBuilderProps {
  config: ConditionConfig
  onChange: (config: ConditionConfig) => void
}

const chainOptions = [
  { value: "ethereum", label: "Ethereum / EVM" },
  { value: "solana", label: "Solana" },
  { value: "tron", label: "Tron" },
  { value: "bitcoin", label: "Bitcoin" },
]

const joinOptions = [
  { value: "&&", label: "AND (&&) — all conditions must match" },
  { value: "||", label: "OR (||) — any condition must match" },
]

interface SectionHeaderProps {
  title: string
  enabled: boolean
  onToggle: () => void
  docUrl?: string
  docLabel?: string
}

function SectionHeader({ title, enabled, onToggle, docUrl, docLabel }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onToggle}
        className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors">
        {enabled ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
          {enabled ? "on" : "off"}
        </span>
      </button>
      {docUrl && (
        <a href={docUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {docLabel || "Docs"} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

export function ConditionBuilder({ config, onChange }: ConditionBuilderProps) {
  const isRawMode = !!config.rawCondition
  const join = config.conditionJoin || "&&"

  const networkEnabled = config.chain !== undefined
  const activityEnabled = config.activity !== undefined
  const signingResourceEnabled = config.signingResource !== undefined

  const toggleNetwork = () => {
    if (networkEnabled) {
      const { chain, ethereum, solana, tron, bitcoin, ...rest } = config
      void chain; void ethereum; void solana; void tron; void bitcoin
      onChange(rest)
    } else {
      onChange({ ...config, chain: "ethereum", ethereum: [] })
    }
  }

  const toggleActivity = () => {
    if (activityEnabled) {
      const { activity, ...rest } = config
      void activity
      onChange(rest)
    } else {
      onChange({ ...config, activity: [] })
    }
  }

  const toggleSigningResource = () => {
    if (signingResourceEnabled) {
      const { signingResource, ...rest } = config
      void signingResource
      onChange(rest)
    } else {
      onChange({ ...config, signingResource: [] })
    }
  }

  const handleChainChange = (chain: string) => {
    const newConfig: ConditionConfig = { ...config, chain: chain as ChainType }
    if (chain === "ethereum" && !newConfig.ethereum) newConfig.ethereum = []
    if (chain === "solana" && !newConfig.solana) newConfig.solana = { conditions: [] }
    if (chain === "tron" && !newConfig.tron) newConfig.tron = []
    if (chain === "bitcoin" && !newConfig.bitcoin) newConfig.bitcoin = { outputConditions: [] }
    onChange(newConfig)
  }

  const clearRaw = () => {
    const { rawCondition, ...rest } = config
    void rawCondition
    onChange(rest)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <Label className="text-lg font-semibold">Condition (When it applies)</Label>
        </div>
        <a href="https://docs.turnkey.com/concepts/policies/overview#condition" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="text-sm text-muted-foreground">
        Define when this policy applies. Enable one or more sections below and combine them with AND/OR.{" "}
        <a href="https://docs.turnkey.com/concepts/policies/language" target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline">View policy language reference</a>
      </p>

      {!isRawMode && (
        <div>
          <Label className="text-xs">Join conditions with</Label>
          <Select options={joinOptions} value={join}
            onChange={(e) => onChange({ ...config, conditionJoin: e.target.value as "&&" | "||" })} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" variant={isRawMode ? "default" : "outline"} size="sm"
          onClick={() => isRawMode ? clearRaw() : onChange({ ...config, rawCondition: "" })}>
          Raw Expression
        </Button>
        <span className="text-xs text-muted-foreground">Advanced: write the full condition manually</span>
      </div>

      {isRawMode ? (
        <div className="space-y-2">
          <Label className="text-base font-semibold">Raw Condition Expression</Label>
          <p className="text-sm text-muted-foreground">
            Enter a raw policy condition expression for advanced conditions not supported by the visual builder.
          </p>
          <Textarea className="font-mono text-sm" rows={4}
            placeholder={'activity.resource == "WALLET" && activity.action == "SIGN"'}
            value={config.rawCondition || ""}
            onChange={(e) => onChange({ ...config, rawCondition: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            Refer to the{" "}
            <a href="https://docs.turnkey.com/concepts/policies/language" target="_blank" rel="noopener noreferrer"
              className="text-primary underline">Turnkey Policy Language documentation</a>{" "}for syntax help.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Network/Chain */}
          <div className="border rounded-lg p-4 space-y-3">
            <SectionHeader title="Network / Chain" enabled={networkEnabled} onToggle={toggleNetwork}
              docUrl="https://docs.turnkey.com/concepts/policies/language#condition" docLabel="Chain docs" />
            {networkEnabled && (
              <div className="space-y-3 pt-1">
                <div>
                  <Label className="text-xs">Chain</Label>
                  <Select options={chainOptions} value={config.chain || "ethereum"}
                    onChange={(e) => handleChainChange(e.target.value)} />
                </div>
                {config.chain === "ethereum" && (
                  <EthereumConditions conditions={config.ethereum || []}
                    onChange={(c: EthereumCondition[]) => onChange({ ...config, ethereum: c })} />
                )}
                {config.chain === "solana" && (
                  <SolanaConditions config={config.solana || { conditions: [] }}
                    onChange={(c: SolanaConditionConfig) => onChange({ ...config, solana: c })} />
                )}
                {config.chain === "tron" && (
                  <TronConditions conditions={config.tron || []}
                    onChange={(c: TronCondition[]) => onChange({ ...config, tron: c })} />
                )}
                {config.chain === "bitcoin" && (
                  <BitcoinConditions config={config.bitcoin || { outputConditions: [] }}
                    onChange={(c: BitcoinConditionConfig) => onChange({ ...config, bitcoin: c })} />
                )}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="border rounded-lg p-4 space-y-3">
            <SectionHeader title="Activity" enabled={activityEnabled} onToggle={toggleActivity}
              docUrl="https://docs.turnkey.com/api/activity-types" docLabel="Activity types" />
            {activityEnabled && (
              <div className="pt-1">
                <ActivityConditions conditions={config.activity || []}
                  onChange={(c: ActivityCondition[]) => onChange({ ...config, activity: c })} />
              </div>
            )}
          </div>

          {/* Signing Resource */}
          <div className="border rounded-lg p-4 space-y-3">
            <SectionHeader title="Signing Resource" enabled={signingResourceEnabled} onToggle={toggleSigningResource}
              docUrl="https://docs.turnkey.com/concepts/policies/language#condition" docLabel="Resource docs" />
            {signingResourceEnabled && (
              <div className="pt-1">
                <SigningResourceConditions conditions={config.signingResource || []}
                  onChange={(c: SigningResourceCondition[]) => onChange({ ...config, signingResource: c })} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
