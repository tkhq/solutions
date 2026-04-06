"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Copy, Download, Code, ExternalLink } from "lucide-react"
import type { TurnkeyPolicy } from "@/types/policy"

interface JsonOutputProps {
  policy: TurnkeyPolicy
}

export function JsonOutput({ policy }: JsonOutputProps) {
  const [copied, setCopied] = useState(false)
  const jsonString = JSON.stringify(policy, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${policy.policyName.replace(/[^a-zA-Z0-9]/g, "_")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const highlightJson = (json: string) => {
    return json
      .replace(/("(?:policyName|effect|consensus|condition|notes)")/g, '<span class="text-blue-400">$1</span>')
      .replace(/("EFFECT_ALLOW"|"EFFECT_DENY")/g, '<span class="text-green-400">$1</span>')
      .replace(/(:\s*)("(?:[^"\\]|\\.)*")/g, '$1<span class="text-amber-300">$2</span>')
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <CardTitle className="text-lg">JSON Output</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (<><Check className="h-4 w-4 mr-1" />Copied</>) : (<><Copy className="h-4 w-4 mr-1" />Copy</>)}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-lg text-sm font-mono overflow-x-auto min-h-[200px]">
          <code dangerouslySetInnerHTML={{ __html: highlightJson(jsonString) }} />
        </pre>
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">Using this policy:</p>
          <p className="text-xs text-muted-foreground">
            Use this JSON with the Turnkey API&apos;s{" "}
            <a href="https://docs.turnkey.com/api-reference/activities/create-policy" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">create_policy</a>{" "}
            or{" "}
            <a href="https://docs.turnkey.com/api-reference/activities/create-policies" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">create_policies</a>{" "}
            endpoints.{" "}
            <a href="https://docs.turnkey.com/concepts/policies/quickstart" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline">
              View quickstart guide <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
