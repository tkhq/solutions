"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Tooltip } from "@/components/ui/tooltip"
import { Sparkles, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { getPresetsByCategory } from "@/lib/presets"
import type { PolicyConfig, PolicyPreset } from "@/types/policy"

interface PolicyPresetsProps {
  onSelect: (config: PolicyConfig) => void
}

const categoryOptions = [
  { value: "all", label: "All Presets" },
  { value: "ethereum", label: "Ethereum" },
  { value: "solana", label: "Solana" },
  { value: "tron", label: "Tron" },
  { value: "general", label: "General" },
]

export function PolicyPresets({ onSelect }: PolicyPresetsProps) {
  const [category, setCategory] = useState("all")
  const [isExpanded, setIsExpanded] = useState(true)
  const filteredPresets = getPresetsByCategory(category)

  const handlePresetClick = (preset: PolicyPreset) => {
    const config = JSON.parse(JSON.stringify(preset.config))
    onSelect(config)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Sparkles className="h-5 w-5 shrink-0" />
            <CardTitle className="text-lg">Quick Start Presets</CardTitle>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {isExpanded && (
            <Select className="w-36 shrink-0" options={categoryOptions} value={category}
              onChange={(e) => setCategory(e.target.value)} />
          )}
        </div>
        {!isExpanded && (
          <p className="text-sm text-muted-foreground mt-1">Click to expand and choose a preset template</p>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filteredPresets.map((preset) => (
              <Tooltip key={preset.id} content={
                <div className="space-y-2">
                  <p className="font-medium">{preset.name}</p>
                  <p>{preset.description}</p>
                  {preset.docUrl && (
                    <a href={preset.docUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}>
                      View docs <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              }>
                <Button type="button" variant="outline"
                  className="h-auto py-3 px-4 flex flex-col items-start text-left overflow-hidden w-full"
                  onClick={() => handlePresetClick(preset)}>
                  <span className="font-medium text-sm w-full truncate">{preset.name}</span>
                  <span className="text-xs text-muted-foreground font-normal mt-1 line-clamp-2 w-full">
                    {preset.description}
                  </span>
                </Button>
              </Tooltip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Click a preset to load it into the builder. Replace placeholder values like &lt;USER_ID&gt; and &lt;ALLOWED_ADDRESS&gt;.{" "}
            <a href="https://docs.turnkey.com/concepts/policies/overview" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline">
              Learn more about policies <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </CardContent>
      )}
    </Card>
  )
}
