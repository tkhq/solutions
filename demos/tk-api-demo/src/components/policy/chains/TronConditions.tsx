"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import type { TronCondition, TronContractType } from "@/types/policy"

interface TronConditionsProps {
  conditions: TronCondition[]
  onChange: (conditions: TronCondition[]) => void
}

const contractTypeOptions = [
  { value: "", label: "Any Contract Type" },
  { value: "TransferContract", label: "TransferContract (TRX)" },
  { value: "TriggerSmartContract", label: "TriggerSmartContract" },
  { value: "DelegateResourceContract", label: "DelegateResourceContract" },
  { value: "UnDelegateResourceContract", label: "UnDelegateResourceContract" },
  { value: "FreezeBalanceV2Contract", label: "FreezeBalanceV2Contract" },
  { value: "UnfreezeBalanceV2Contract", label: "UnfreezeBalanceV2Contract" },
  { value: "AccountPermissionUpdateContract", label: "AccountPermissionUpdateContract" },
]
const fieldOptions = [
  { value: "", label: "Contract Type Only" },
  { value: "owner_address", label: "Owner Address" },
  { value: "to_address", label: "Recipient Address" },
  { value: "amount", label: "Amount (sun)" },
  { value: "contract_address", label: "Contract Address" },
]
const operatorOptions = [
  { value: "==", label: "equals (==)" }, { value: "!=", label: "not equals (!=)" },
  { value: ">", label: "greater than (>)" }, { value: "<", label: "less than (<)" },
  { value: ">=", label: ">=" }, { value: "<=", label: "<=" },
]

export function TronConditions({ conditions, onChange }: TronConditionsProps) {
  const addCondition = () => {
    onChange([...conditions, { contractType: "TransferContract", operator: "==", value: "" }])
  }

  const updateCondition = (index: number, field: keyof TronCondition, value: string) => {
    const updated = [...conditions]
    if (field === "contractType") {
      updated[index] = { ...updated[index], contractType: value as TronContractType }
    } else if (field === "field") {
      updated[index] = { ...updated[index], field: value as TronCondition["field"] }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    onChange(updated)
  }

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Tron Conditions</Label>
          <a href="https://docs.turnkey.com/concepts/policies/examples/tron" target="_blank" rel="noopener noreferrer"
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
          No conditions added. The policy will apply to all Tron transactions.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contract Type</Label>
              <Select options={contractTypeOptions} value={condition.contractType || ""}
                onChange={(e) => updateCondition(index, "contractType", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Field (Optional)</Label>
              <Select options={fieldOptions} value={condition.field || ""}
                onChange={(e) => updateCondition(index, "field", e.target.value)} />
            </div>
          </div>
          {condition.field && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Operator</Label>
                <Select options={operatorOptions} value={condition.operator}
                  onChange={(e) => updateCondition(index, "operator", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input placeholder={condition.field === "amount" ? "Amount in sun" : "Address (T...)"}
                  value={condition.value} onChange={(e) => updateCondition(index, "value", e.target.value)} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {condition.contractType === "TransferContract" && "Native TRX transfer"}
            {condition.contractType === "TriggerSmartContract" && "Smart contract call (including TRC-20)"}
            {condition.field === "amount" && " (1 TRX = 1,000,000 sun)"}
          </p>
        </div>
      ))}
    </div>
  )
}
