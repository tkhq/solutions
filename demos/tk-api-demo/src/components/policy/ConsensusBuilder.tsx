"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Plus, Trash2, Users, ExternalLink } from "lucide-react"
import type { ConsensusConfig, UserCondition, TagCondition, CredentialCondition } from "@/types/policy"

interface OrgUser {
  id: string
  name: string
}

interface ConsensusBuilderProps {
  config: ConsensusConfig
  onChange: (config: ConsensusConfig) => void
  orgUsers?: OrgUser[]
}

const operatorOptions = [
  { value: "any", label: "Any user (OR)" },
  { value: "all", label: "All users (AND)" },
  { value: "count", label: "Minimum count" },
  { value: "tag_any", label: "Tag match (any)" },
  { value: "tag_count", label: "Tag match (count)" },
  { value: "credential", label: "Credential-based" },
]

const credentialFieldOptions = [
  { value: "id", label: "Credential ID" },
  { value: "type", label: "Credential Type" },
  { value: "credential_id", label: "Passkey Credential ID" },
  { value: "public_key", label: "Public Key" },
]

const credentialTypeExamples = [
  "CREDENTIAL_TYPE_API_KEY_P256",
  "CREDENTIAL_TYPE_WEBAUTHN_AUTHENTICATOR",
  "CREDENTIAL_TYPE_ENCRYPTED_KEY_PAIR",
  "CREDENTIAL_TYPE_OAUTH_TOKEN",
]

const operatorOptions2 = [
  { value: "==", label: "equals (==)" },
  { value: "!=", label: "not equals (!=)" },
]

export function ConsensusBuilder({ config, onChange, orgUsers }: ConsensusBuilderProps) {
  const addUser = () => {
    const newUser: UserCondition = { id: crypto.randomUUID(), userId: "" }
    onChange({ ...config, users: [...config.users, newUser] })
  }
  const updateUser = (id: string, userId: string) => {
    onChange({ ...config, users: config.users.map((u) => (u.id === id ? { ...u, userId } : u)) })
  }
  const removeUser = (id: string) => {
    onChange({ ...config, users: config.users.filter((u) => u.id !== id) })
  }

  const addTag = () => {
    const newTag: TagCondition = { id: crypto.randomUUID(), tagId: "" }
    onChange({ ...config, tags: [...(config.tags || []), newTag] })
  }
  const updateTag = (id: string, tagId: string) => {
    onChange({ ...config, tags: (config.tags || []).map((t) => (t.id === id ? { ...t, tagId } : t)) })
  }
  const removeTag = (id: string) => {
    onChange({ ...config, tags: (config.tags || []).filter((t) => t.id !== id) })
  }

  const addCredential = () => {
    const newCred: CredentialCondition = { id: crypto.randomUUID(), field: "type", operator: "==", value: "" }
    onChange({ ...config, credentials: [...(config.credentials || []), newCred] })
  }
  const updateCredential = (id: string, field: keyof CredentialCondition, value: string) => {
    onChange({ ...config, credentials: (config.credentials || []).map((c) => c.id === id ? { ...c, [field]: value } : c) })
  }
  const removeCredential = (id: string) => {
    onChange({ ...config, credentials: (config.credentials || []).filter((c) => c.id !== id) })
  }

  const updateOperator = (operator: string) => {
    onChange({ ...config, operator: operator as ConsensusConfig["operator"] })
  }

  const isUserMode = ["any", "all", "count"].includes(config.operator)
  const isTagMode = ["tag_any", "tag_count"].includes(config.operator)
  const isCredentialMode = config.operator === "credential"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <Label className="text-lg font-semibold">Consensus (Who can act)</Label>
        </div>
        <a href="https://docs.turnkey.com/concepts/policies/overview#consensus" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <p className="text-sm text-muted-foreground">
        Define which users or credentials are allowed to perform actions under this policy.{" "}
        <a href="https://docs.turnkey.com/concepts/policies/overview#consensus" target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline">Learn about consensus</a>
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Label className="text-xs">Operator</Label>
          <Select options={operatorOptions} value={config.operator} onChange={(e) => updateOperator(e.target.value)} />
        </div>
        {config.operator === "count" && (
          <div className="w-32">
            <Label className="text-xs">Minimum Required</Label>
            <Input type="number" min={1} value={config.countThreshold || 1}
              onChange={(e) => onChange({ ...config, countThreshold: parseInt(e.target.value) || 1 })} />
          </div>
        )}
        {config.operator === "tag_count" && (
          <div className="w-36">
            <Label className="text-xs">Minimum Required</Label>
            <Input type="number" min={1} value={config.tagCountThreshold || 2}
              onChange={(e) => onChange({ ...config, tagCountThreshold: parseInt(e.target.value) || 2 })} />
          </div>
        )}
        {isCredentialMode && (
          <div className="w-36">
            <Label className="text-xs">Quantifier</Label>
            <Select options={[{ value: "any", label: "any" }, { value: "all", label: "all" }]}
              value={config.credentialQuantifier || "any"}
              onChange={(e) => onChange({ ...config, credentialQuantifier: e.target.value as "any" | "all" })} />
          </div>
        )}
      </div>

      {/* User-based */}
      {isUserMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Users</Label>
            <Button type="button" variant="outline" size="sm" onClick={addUser}>
              <Plus className="h-4 w-4 mr-1" /> Add User
            </Button>
          </div>
          {config.users.length === 0 && config.operator === "count" && (
            <p className="text-sm text-muted-foreground italic p-3 border rounded-lg bg-muted/30">
              No users specified — will generate{" "}
              <code className="text-xs bg-background px-1 rounded">
                approvers.count() &gt;= {config.countThreshold || 1}
              </code>{" "}(any approvers).
            </p>
          )}
          {config.users.length === 0 && config.operator !== "count" && (
            <p className="text-sm text-muted-foreground italic p-3 border rounded-lg bg-muted/30">
              No users added. Add at least one user to define who can act.
            </p>
          )}
          {config.users.map((user) => (
            <div key={user.id} className="flex items-center gap-2">
              <div className="flex-1">
                {orgUsers && orgUsers.length > 0 ? (
                  <Select
                    options={[
                      { value: '', label: 'Select a user…' },
                      ...orgUsers.map((u) => ({
                        value: u.id,
                        label: u.name !== u.id
                          ? `${u.name} (${u.id.slice(0, 8)}…)`
                          : u.id,
                      })),
                    ]}
                    value={user.userId}
                    onChange={(e) => updateUser(user.id, e.target.value)}
                  />
                ) : (
                  <Input placeholder="Enter User ID (UUID)" value={user.userId}
                    onChange={(e) => updateUser(user.id, e.target.value)} />
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeUser(user.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Tag-based */}
      {isTagMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">User Tag IDs</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                <a href="https://docs.turnkey.com/concepts/policies/examples/access-control#require-two-users-with-a-specific-tag-to-add-policies"
                  target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1">
                  Tag examples <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addTag}>
              <Plus className="h-4 w-4 mr-1" /> Add Tag
            </Button>
          </div>
          {(config.tags || []).length === 0 && (
            <p className="text-sm text-muted-foreground italic p-3 border rounded-lg bg-muted/30">
              Add at least one tag ID to match against.
            </p>
          )}
          {(config.tags || []).map((tag) => (
            <div key={tag.id} className="flex items-center gap-2">
              <div className="flex-1">
                <Input placeholder="Enter User Tag ID" value={tag.tagId}
                  onChange={(e) => updateTag(tag.id, e.target.value)} />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeTag(tag.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Credential-based */}
      {isCredentialMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Credential Conditions</Label>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCredential}>
              <Plus className="h-4 w-4 mr-1" /> Add Condition
            </Button>
          </div>
          {(config.credentials || []).length === 0 && (
            <p className="text-sm text-muted-foreground italic p-3 border rounded-lg bg-muted/30">
              Add at least one credential condition.
            </p>
          )}
          {(config.credentials || []).map((cred, index) => (
            <div key={cred.id} className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Condition {index + 1}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCredential(cred.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Field</Label>
                  <Select options={credentialFieldOptions} value={cred.field}
                    onChange={(e) => updateCredential(cred.id, "field", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select options={operatorOptions2} value={cred.operator}
                    onChange={(e) => updateCredential(cred.id, "operator", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input placeholder={cred.field === "type" ? "CREDENTIAL_TYPE_..." : "Enter value"}
                    value={cred.value} onChange={(e) => updateCredential(cred.id, "value", e.target.value)}
                    list={`cred-types-${cred.id}`} />
                  {cred.field === "type" && (
                    <datalist id={`cred-types-${cred.id}`}>
                      {credentialTypeExamples.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expression preview */}
      {(isUserMode ? config.users.length > 0 || config.operator === "count"
        : isTagMode ? (config.tags || []).length > 0
        : (config.credentials || []).length > 0) && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <span className="font-medium">Generated expression: </span>
          <code className="text-xs bg-background px-1 py-0.5 rounded break-all">
            {config.operator === "any" && config.users.length > 0 && "approvers.any(user, ...)"}
            {config.operator === "all" && config.users.length > 0 && "approvers.all(user, ...)"}
            {config.operator === "count" && config.users.length === 0 && `approvers.count() >= ${config.countThreshold || 1}`}
            {config.operator === "count" && config.users.length > 0 && `approvers.count(user, ...) >= ${config.countThreshold || 1}`}
            {config.operator === "tag_any" && (config.tags || []).length > 0 && `approvers.any(user, user.tags.contains('...'))`}
            {config.operator === "tag_count" && (config.tags || []).length > 0 && `approvers.filter(user, user.tags.contains('...')).count() >= ${config.tagCountThreshold || 2}`}
            {config.operator === "credential" && (config.credentials || []).length > 0 && `credentials.${config.credentialQuantifier || "any"}(credential, ...)`}
          </code>
        </div>
      )}
    </div>
  )
}
