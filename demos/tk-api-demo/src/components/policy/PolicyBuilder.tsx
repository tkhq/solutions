"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Shield, ShieldOff, FileText } from "lucide-react"
import { ConsensusBuilder } from "@/components/policy/ConsensusBuilder"
import { ConditionBuilder } from "@/components/policy/ConditionBuilder"
import { JsonOutput } from "@/components/policy/JsonOutput"
import { PolicyPresets } from "@/components/policy/PolicyPresets"
import { buildPolicy } from "@/lib/policy-builder"
import type { PolicyConfig, PolicyEffect, ConsensusConfig, ConditionConfig, TurnkeyPolicy } from "@/types/policy"

const defaultConsensus: ConsensusConfig = { operator: "any", users: [] }
const defaultCondition: ConditionConfig = { conditionJoin: "&&", chain: "ethereum", ethereum: [] }
const defaultConfig: PolicyConfig = {
  policyName: "",
  effect: "EFFECT_ALLOW",
  consensus: defaultConsensus,
  condition: defaultCondition,
  notes: "",
}

interface PolicyBuilderProps {
  onApply?: (policy: TurnkeyPolicy) => void
}

export function PolicyBuilder({ onApply }: PolicyBuilderProps) {
  const [config, setConfig] = useState<PolicyConfig>(defaultConfig)
  const [policy, setPolicy] = useState<TurnkeyPolicy>(() => buildPolicy(defaultConfig))

  useEffect(() => { setPolicy(buildPolicy(config)) }, [config])

  const updateConfig = <K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <PolicyPresets onSelect={(presetConfig: PolicyConfig) => setConfig(presetConfig)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Builder Form */}
        <div className="space-y-6 order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Policy Builder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Policy Name */}
              <div className="space-y-2">
                <Label htmlFor="policyName">Policy Name</Label>
                <Input id="policyName" placeholder="Enter a descriptive name for this policy"
                  value={config.policyName} onChange={(e) => updateConfig("policyName", e.target.value)} />
              </div>

              {/* Effect Toggle */}
              <div className="space-y-2">
                <Label>Effect</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button"
                    variant={config.effect === "EFFECT_ALLOW" ? "default" : "outline"}
                    className={config.effect === "EFFECT_ALLOW" ? "bg-green-600 hover:bg-green-700 flex-1 sm:flex-none" : "flex-1 sm:flex-none"}
                    onClick={() => updateConfig("effect", "EFFECT_ALLOW" as PolicyEffect)}>
                    <Shield className="h-4 w-4 mr-2" />ALLOW
                  </Button>
                  <Button type="button"
                    variant={config.effect === "EFFECT_DENY" ? "default" : "outline"}
                    className={config.effect === "EFFECT_DENY" ? "bg-red-600 hover:bg-red-700 flex-1 sm:flex-none" : "flex-1 sm:flex-none"}
                    onClick={() => updateConfig("effect", "EFFECT_DENY" as PolicyEffect)}>
                    <ShieldOff className="h-4 w-4 mr-2" />DENY
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.effect === "EFFECT_ALLOW"
                    ? "This policy will ALLOW matching actions."
                    : "This policy will DENY matching actions. Deny always takes precedence over Allow."}
                </p>
              </div>

              <div className="border-t" />

              <ConsensusBuilder config={config.consensus || defaultConsensus}
                onChange={(consensus: ConsensusConfig) => updateConfig("consensus", consensus)} />

              <div className="border-t" />

              <ConditionBuilder config={config.condition || defaultCondition}
                onChange={(condition: ConditionConfig) => updateConfig("condition", condition)} />

              <div className="border-t" />

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" placeholder="Add any notes or documentation for this policy"
                  value={config.notes || ""} onChange={(e) => updateConfig("notes", e.target.value)} rows={3} />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setConfig(defaultConfig)}>
                  Reset
                </Button>
                {onApply && (
                  <Button type="button"
                    className="bg-violet-600 hover:bg-violet-500 text-white border-violet-600"
                    onClick={() => onApply(policy)}>
                    Apply to Step
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — JSON Output */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <JsonOutput policy={policy} />
        </div>
      </div>
    </div>
  )
}
