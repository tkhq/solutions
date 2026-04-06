"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import type { BitcoinConditionConfig, BitcoinOutputCondition } from "@/types/policy"

interface BitcoinConditionsProps {
  config: BitcoinConditionConfig
  onChange: (config: BitcoinConditionConfig) => void
}

const quantifierOptions = [
  { value: "all", label: "All outputs (all)" },
  { value: "any", label: "Any output (any)" },
]
const operatorOptions = [
  { value: "==", label: "equals (==)" }, { value: "!=", label: "not equals (!=)" },
  { value: ">", label: "greater than (>)" }, { value: "<", label: "less than (<)" },
  { value: ">=", label: ">=" }, { value: "<=", label: "<=" },
]

export function BitcoinConditions({ config, onChange }: BitcoinConditionsProps) {
  const addOutput = () => {
    const newCond: BitcoinOutputCondition = { id: crypto.randomUUID(), quantifier: "all", operator: "<=", value: "" }
    onChange({ ...config, outputConditions: [...config.outputConditions, newCond] })
  }

  const updateOutput = (id: string, key: keyof BitcoinOutputCondition, value: string) => {
    onChange({ ...config, outputConditions: config.outputConditions.map((c) => c.id === id ? { ...c, [key]: value } : c) })
  }

  const removeOutput = (id: string) => {
    onChange({ ...config, outputConditions: config.outputConditions.filter((c) => c.id !== id) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Bitcoin Output Conditions</Label>
          <a href="https://docs.turnkey.com/concepts/policies/examples/bitcoin" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Examples <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addOutput}>
          <Plus className="h-4 w-4 mr-1" /> Add Output Condition
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Control Bitcoin transactions by filtering on output values (in satoshis).{" "}
        <a href="https://docs.turnkey.com/networks/bitcoin#policy-enabled-bitcoin-transaction-signing" target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline">Learn more</a>
      </p>

      {config.outputConditions.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No output conditions added.</p>
      )}

      {config.outputConditions.map((cond, index) => (
        <div key={cond.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Output Condition {index + 1}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeOutput(cond.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Quantifier</Label>
              <Select options={quantifierOptions} value={cond.quantifier}
                onChange={(e) => updateOutput(cond.id, "quantifier", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Operator</Label>
              <Select options={operatorOptions} value={cond.operator}
                onChange={(e) => updateOutput(cond.id, "operator", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Value (satoshis)</Label>
              <Input type="number" min={0} placeholder="e.g. 100000000 (1 BTC)" value={cond.value}
                onChange={(e) => updateOutput(cond.id, "value", e.target.value)} />
            </div>
          </div>
          {cond.value && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Expression: </span>
              <code className="bg-background px-1 py-0.5 rounded">
                bitcoin.tx.outputs.{cond.quantifier}(output, output.value {cond.operator} {cond.value})
              </code>
              <span className="ml-2 opacity-70">≈ {(Number(cond.value) / 1e8).toFixed(8)} BTC</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
