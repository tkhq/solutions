"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import type { EthereumCondition } from "@/types/policy"

interface EthereumConditionsProps {
  conditions: EthereumCondition[]
  onChange: (conditions: EthereumCondition[]) => void
}

const fieldOptions = [
  { value: "to", label: "Recipient Address (to)" },
  { value: "value", label: "Value (wei)" },
  { value: "chain_id", label: "Chain ID" },
  { value: "gas", label: "Gas Limit" },
  { value: "gas_price", label: "Gas Price" },
  { value: "data", label: "Call Data" },
]

const operatorOptions = [
  { value: "==", label: "equals (==)" },
  { value: "!=", label: "not equals (!=)" },
  { value: ">", label: "greater than (>)" },
  { value: "<", label: "less than (<)" },
  { value: ">=", label: "greater or equal (>=)" },
  { value: "<=", label: "less or equal (<=)" },
  { value: "startsWith", label: "starts with" },
]

export function EthereumConditions({ conditions, onChange }: EthereumConditionsProps) {
  const addCondition = () => {
    onChange([...conditions, { field: "to", operator: "==", value: "" }])
  }

  const updateCondition = (index: number, field: keyof EthereumCondition, value: string) => {
    const updated = [...conditions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Ethereum Conditions</Label>
          <a href="https://docs.turnkey.com/concepts/policies/examples/ethereum" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Examples <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-1" /> Add Condition
        </Button>
      </div>

      {conditions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No conditions added. The policy will apply to all Ethereum transactions.{" "}
          <a href="https://docs.turnkey.com/concepts/policies/examples/ethereum" target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline">See example policies</a>
        </p>
      )}

      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Condition {index + 1}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Field</Label>
              <Select options={fieldOptions} value={condition.field}
                onChange={(e) => updateCondition(index, "field", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Operator</Label>
              <Select options={operatorOptions} value={condition.operator}
                onChange={(e) => updateCondition(index, "operator", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Value</Label>
              <Input
                placeholder={condition.field === "to" ? "0x..." : condition.field === "chain_id" ? "1" : "Enter value"}
                value={condition.value}
                onChange={(e) => updateCondition(index, "value", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {condition.field === "to" && "The recipient Ethereum address"}
            {condition.field === "value" && "Transaction value in wei (1 ETH = 1e18 wei)"}
            {condition.field === "chain_id" && "1 = Mainnet, 137 = Polygon, 42161 = Arbitrum"}
            {condition.field === "gas" && "Maximum gas units for the transaction"}
            {condition.field === "gas_price" && "Gas price in wei"}
            {condition.field === "data" && "Transaction call data (hex encoded)"}
          </p>
        </div>
      ))}
    </div>
  )
}
