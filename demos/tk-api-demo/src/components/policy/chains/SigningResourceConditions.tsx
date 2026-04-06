"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import type { SigningResourceCondition, SigningResourceType } from "@/types/policy"

interface SigningResourceConditionsProps {
  conditions: SigningResourceCondition[]
  onChange: (conditions: SigningResourceCondition[]) => void
}

const resourceTypeOptions = [
  { value: "wallet", label: "Wallet" },
  { value: "wallet_account", label: "Wallet Account" },
  { value: "private_key", label: "Private Key" },
]

const fieldsByResource: Record<SigningResourceType, { value: string; label: string; isBoolean?: boolean }[]> = {
  wallet: [
    { value: "id", label: "Wallet ID" },
    { value: "label", label: "Label" },
    { value: "imported", label: "Imported", isBoolean: true },
    { value: "exported", label: "Exported", isBoolean: true },
  ],
  wallet_account: [{ value: "address", label: "Address" }],
  private_key: [
    { value: "id", label: "Private Key ID" },
    { value: "label", label: "Label" },
    { value: "imported", label: "Imported", isBoolean: true },
    { value: "exported", label: "Exported", isBoolean: true },
  ],
}

const operatorsByField = (isBoolean: boolean) =>
  isBoolean
    ? [{ value: "==", label: "equals (==)" }, { value: "!=", label: "not equals (!=)" }]
    : [
        { value: "==", label: "equals (==)" }, { value: "!=", label: "not equals (!=)" },
        { value: ">", label: "greater than (>)" }, { value: "<", label: "less than (<)" },
        { value: ">=", label: ">=" }, { value: "<=", label: "<=" },
      ]

export function SigningResourceConditions({ conditions, onChange }: SigningResourceConditionsProps) {
  const addCondition = () => {
    const newCond: SigningResourceCondition = { id: crypto.randomUUID(), resourceType: "wallet", field: "id", operator: "==", value: "" }
    onChange([...conditions, newCond])
  }

  const updateCondition = (id: string, key: keyof SigningResourceCondition, value: string) => {
    onChange(
      conditions.map((c) => {
        if (c.id !== id) return c
        const updated = { ...c, [key]: value }
        if (key === "resourceType") {
          const firstField = fieldsByResource[value as SigningResourceType]?.[0]
          updated.field = firstField?.value ?? "id"
          updated.operator = "=="
          updated.value = ""
        }
        if (key === "field") {
          const fieldDef = fieldsByResource[c.resourceType]?.find((f) => f.value === value)
          if (fieldDef?.isBoolean) { updated.operator = "=="; updated.value = "true" }
          else { updated.operator = "=="; updated.value = "" }
        }
        return updated
      })
    )
  }

  const removeCondition = (id: string) => {
    onChange(conditions.filter((c) => c.id !== id))
  }

  const getFieldDef = (cond: SigningResourceCondition) =>
    fieldsByResource[cond.resourceType]?.find((f) => f.value === cond.field)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Signing Resource Conditions</Label>
          <a href="https://docs.turnkey.com/concepts/policies/language#condition" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-1" /> Add Condition
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Restrict actions to specific wallets, wallet accounts, or private keys used in sign and export requests.
      </p>

      {conditions.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No conditions added.</p>
      )}

      {conditions.map((cond, index) => {
        const fieldDef = getFieldDef(cond)
        const isBoolean = fieldDef?.isBoolean ?? false
        return (
          <div key={cond.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Condition {index + 1}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(cond.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Resource</Label>
                <Select options={resourceTypeOptions} value={cond.resourceType}
                  onChange={(e) => updateCondition(cond.id, "resourceType", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Field</Label>
                <Select options={fieldsByResource[cond.resourceType].map((f) => ({ value: f.value, label: f.label }))}
                  value={cond.field} onChange={(e) => updateCondition(cond.id, "field", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Operator</Label>
                <Select options={operatorsByField(isBoolean)} value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, "operator", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                {isBoolean ? (
                  <Select options={[{ value: "true", label: "true" }, { value: "false", label: "false" }]}
                    value={cond.value || "true"} onChange={(e) => updateCondition(cond.id, "value", e.target.value)} />
                ) : (
                  <Input placeholder={cond.field === "id" ? "Enter UUID" : cond.field === "address" ? "Enter address" : "Enter value"}
                    value={cond.value} onChange={(e) => updateCondition(cond.id, "value", e.target.value)} />
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Expression: </span>
              <code className="bg-background px-1 py-0.5 rounded">
                {cond.resourceType}.{cond.field} {cond.operator} {isBoolean ? cond.value || "true" : `'${cond.value}'`}
              </code>
            </div>
          </div>
        )
      })}
    </div>
  )
}
