"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import type { SolanaConditionConfig, SolanaTransferCondition } from "@/types/policy"

interface SolanaConditionsProps {
  config: SolanaConditionConfig
  onChange: (config: SolanaConditionConfig) => void
}

const transferTypeOptions = [
  { value: "transfers", label: "Native SOL Transfers" },
  { value: "spl_transfers", label: "SPL Token Transfers" },
]
const quantifierOptions = [
  { value: "all", label: "All transfers must match" },
  { value: "any", label: "At least one must match" },
]
const fieldOptions = [
  { value: "to", label: "Recipient (to)" },
  { value: "from", label: "Sender (from)" },
  { value: "amount", label: "Amount (lamports)" },
]
const operatorOptions = [
  { value: "==", label: "equals (==)" }, { value: "!=", label: "not equals (!=)" },
  { value: ">", label: "greater than (>)" }, { value: "<", label: "less than (<)" },
  { value: ">=", label: ">=" }, { value: "<=", label: "<=" },
]
const countOperatorOptions = [
  { value: "==", label: "exactly" }, { value: ">=", label: "at least" },
  { value: "<=", label: "at most" }, { value: ">", label: "more than" },
  { value: "<", label: "less than" },
]

export function SolanaConditions({ config, onChange }: SolanaConditionsProps) {
  const addTransferCondition = () => {
    const newCondition: SolanaTransferCondition = { type: "transfers", quantifier: "all", field: "to", operator: "==", value: "" }
    onChange({ ...config, conditions: [...config.conditions, newCondition] })
  }

  const updateCondition = (index: number, field: keyof SolanaTransferCondition, value: string | number) => {
    const updated = [...config.conditions]
    updated[index] = { ...updated[index], [field]: value } as SolanaTransferCondition
    onChange({ ...config, conditions: updated })
  }

  const removeCondition = (index: number) => {
    onChange({ ...config, conditions: config.conditions.filter((_, i) => i !== index) })
  }

  const updateInstructionCount = (operator: "==" | ">" | "<" | ">=" | "<=", value: number) => {
    onChange({ ...config, instructionCount: { operator, value } })
  }

  const updateTransferCount = (operator: "==" | ">" | "<" | ">=" | "<=", value: number) => {
    onChange({ ...config, transferCount: { operator, value } })
  }

  const clearInstructionCount = () => {
    const { instructionCount, ...rest } = config
    void instructionCount
    onChange(rest as SolanaConditionConfig)
  }

  const clearTransferCount = () => {
    const { transferCount, ...rest } = config
    void transferCount
    onChange(rest as SolanaConditionConfig)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Solana Conditions</Label>
        <a href="https://docs.turnkey.com/concepts/policies/examples/solana" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Examples <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Instruction Count */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Instruction Count</Label>
          {config.instructionCount ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearInstructionCount}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => updateInstructionCount("==", 1)}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          )}
        </div>
        {config.instructionCount && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
            <span className="text-sm">Instructions must be</span>
            <Select className="w-32" options={countOperatorOptions} value={config.instructionCount.operator}
              onChange={(e) => updateInstructionCount(e.target.value as "==" | ">" | "<" | ">=" | "<=", config.instructionCount!.value)} />
            <Input type="number" className="w-20" min={0} value={config.instructionCount.value}
              onChange={(e) => updateInstructionCount(config.instructionCount!.operator, parseInt(e.target.value) || 0)} />
          </div>
        )}
      </div>

      {/* Transfer Count */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Transfer Count</Label>
          {config.transferCount ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearTransferCount}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => updateTransferCount("==", 1)}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          )}
        </div>
        {config.transferCount && (
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
            <span className="text-sm">Transfers must be</span>
            <Select className="w-32" options={countOperatorOptions} value={config.transferCount.operator}
              onChange={(e) => updateTransferCount(e.target.value as "==" | ">" | "<" | ">=" | "<=", config.transferCount!.value)} />
            <Input type="number" className="w-20" min={0} value={config.transferCount.value}
              onChange={(e) => updateTransferCount(config.transferCount!.operator, parseInt(e.target.value) || 0)} />
          </div>
        )}
      </div>

      {/* Transfer Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Transfer Conditions</Label>
          <Button type="button" variant="outline" size="sm" onClick={addTransferCondition}>
            <Plus className="h-4 w-4 mr-1" /> Add Condition
          </Button>
        </div>
        {config.conditions.length === 0 && (
          <p className="text-sm text-muted-foreground">No transfer conditions added.</p>
        )}
        {config.conditions.map((condition, index) => {
          if (!("type" in condition)) return null
          const tc = condition as SolanaTransferCondition
          return (
            <div key={index} className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Condition {index + 1}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Transfer Type</Label>
                  <Select options={transferTypeOptions} value={tc.type}
                    onChange={(e) => updateCondition(index, "type", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Quantifier</Label>
                  <Select options={quantifierOptions} value={tc.quantifier}
                    onChange={(e) => updateCondition(index, "quantifier", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Field</Label>
                  <Select options={fieldOptions} value={tc.field}
                    onChange={(e) => updateCondition(index, "field", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select options={operatorOptions} value={tc.operator}
                    onChange={(e) => updateCondition(index, "operator", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input placeholder={tc.field === "amount" ? "Lamports" : "Address"} value={tc.value}
                    onChange={(e) => updateCondition(index, "value", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tc.type === "spl_transfers" && "For SPL transfers, use the token account address, not the wallet address"}
                {tc.field === "amount" && " (1 SOL = 1,000,000,000 lamports)"}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
