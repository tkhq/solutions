/**
 * Policy compilation pipeline: `PolicyConfig` → `buildPolicy()` → `TurnkeyPolicy`.
 *
 * The Turnkey API expects `consensus` and `condition` to be CEL expression
 * strings (e.g. `"approvers.any(user, user.id == '...')"` or
 * `"eth.tx.to == '0x...'"`) rather than structured objects.  This module is
 * responsible for that compilation step.
 *
 * Entry point: call `buildPolicy(config)` with a `PolicyConfig` object (as
 * produced by the visual policy builder UI) to get back a `TurnkeyPolicy` ready
 * to pass directly to the `createPolicy` or `updatePolicy` API calls.
 *
 * `formatPolicyJson` is a thin convenience wrapper for displaying the compiled
 * policy in the JSON inspector panel.
 */
import type {
  PolicyConfig,
  TurnkeyPolicy,
  ConsensusConfig,
  ConditionConfig,
  EthereumCondition,
  SolanaConditionConfig,
  TronCondition,
  ActivityCondition,
  BitcoinConditionConfig,
  SigningResourceCondition,
} from "@/types/policy"

const BOOLEAN_FIELDS = new Set(["imported", "exported"])
const NUMERIC_ETH_FIELDS = new Set(["value", "gas", "gas_price", "chain_id"])

/**
 * Compiles a `ConsensusConfig` into a CEL approver expression string.
 *
 * The generated expression is suitable for the `consensus` field of a
 * `TurnkeyPolicy`.  Returns an empty string if the config produces no
 * meaningful expression (e.g. `operator: "any"` with an empty user list),
 * which `buildPolicy` treats as "omit the field".
 *
 * @param config - Structured consensus configuration from the policy builder UI.
 * @returns        CEL expression string, or `""` if no expression can be built.
 */
export function buildConsensusExpression(config: ConsensusConfig): string {
  switch (config.operator) {
    case "any":
    case "all":
    case "count": {
      if (config.users.length === 0) {
        if (config.operator === "count") {
          return `approvers.count() >= ${config.countThreshold || 1}`
        }
        return ""
      }
      const userConditions = config.users
        .map((u) => `user.id == '${u.userId}'`)
        .join(" || ")
      if (config.operator === "any") {
        return `approvers.any(user, ${userConditions})`
      }
      if (config.operator === "all") {
        return `approvers.all(user, ${userConditions})`
      }
      return `approvers.count(user, ${userConditions}) >= ${config.countThreshold || 1}`
    }

    case "tag_any": {
      const tags = config.tags || []
      if (tags.length === 0) return ""
      return tags
        .map((t) => `approvers.any(user, user.tags.contains('${t.tagId}'))`)
        .join(" && ")
    }

    case "tag_count": {
      const tags = config.tags || []
      if (tags.length === 0) return ""
      const threshold = config.tagCountThreshold || 2
      return tags
        .map(
          (t) =>
            `approvers.filter(user, user.tags.contains('${t.tagId}')).count() >= ${threshold}`
        )
        .join(" && ")
    }

    case "credential": {
      const creds = config.credentials || []
      if (creds.length === 0) return ""
      const quantifier = config.credentialQuantifier || "any"
      const innerConditions = creds
        .map((c) => `credential.${c.field} ${c.operator} '${c.value}'`)
        .join(" || ")
      return `credentials.${quantifier}(credential, ${innerConditions})`
    }

    default:
      return ""
  }
}

function buildEthereumCondition(conditions: EthereumCondition[], join: string): string {
  if (conditions.length === 0) return ""
  return conditions
    .map((c) => {
      const field = `eth.tx.${c.field}`
      if (c.operator === "startsWith") {
        return `${field}.startsWith('${c.value}')`
      }
      const formattedValue = NUMERIC_ETH_FIELDS.has(c.field) ? c.value : `'${c.value}'`
      return `${field} ${c.operator} ${formattedValue}`
    })
    .join(` ${join} `)
}

function buildSolanaCondition(config: SolanaConditionConfig, join: string): string {
  const parts: string[] = []

  if (config.instructionCount) {
    parts.push(
      `solana.tx.instructions.count() ${config.instructionCount.operator} ${config.instructionCount.value}`
    )
  }

  if (config.transferCount) {
    parts.push(
      `solana.tx.transfers.count() ${config.transferCount.operator} ${config.transferCount.value}`
    )
  }

  for (const condition of config.conditions) {
    if ("type" in condition) {
      const txField =
        condition.type === "transfers" ? "solana.tx.transfers" : "solana.tx.spl_transfers"
      const innerCondition = `transfer.${condition.field} ${condition.operator} '${condition.value}'`
      switch (condition.quantifier) {
        case "all":
          parts.push(`${txField}.all(transfer, ${innerCondition})`)
          break
        case "any":
          parts.push(`${txField}.any(transfer, ${innerCondition})`)
          break
        case "count":
          parts.push(
            `${txField}.count(transfer, ${innerCondition}) >= ${condition.countValue || 1}`
          )
          break
      }
    } else {
      if (condition.field === "count") {
        parts.push(
          `solana.tx.instructions.count() ${condition.operator} ${condition.value}`
        )
      } else {
        const innerCondition = `i.${condition.field} ${condition.operator} '${condition.value}'`
        switch (condition.quantifier) {
          case "all":
            parts.push(`solana.tx.instructions.all(i, ${innerCondition})`)
            break
          case "any":
            parts.push(`solana.tx.instructions.any(i, ${innerCondition})`)
            break
        }
      }
    }
  }

  return parts.join(` ${join} `)
}

function buildTronCondition(conditions: TronCondition[], join: string): string {
  if (conditions.length === 0) return ""
  return conditions
    .map((c) => {
      const base = "tron.tx.contract[0]"
      if (c.contractType && !c.field) {
        return `${base}.type == '${c.contractType}'`
      }
      if (c.field) {
        const fieldPath = `${base}.${c.field}`
        const isNumeric = c.field === "amount"
        const formattedValue = isNumeric ? c.value : `'${c.value}'`
        return `${fieldPath} ${c.operator} ${formattedValue}`
      }
      return ""
    })
    .filter(Boolean)
    .join(` ${join} `)
}

function buildBitcoinCondition(config: BitcoinConditionConfig, join: string): string {
  const { outputConditions } = config
  if (outputConditions.length === 0) return ""
  return outputConditions
    .map(
      (c) =>
        `bitcoin.tx.outputs.${c.quantifier}(output, output.value ${c.operator} ${c.value})`
    )
    .join(` ${join} `)
}

function buildActivityCondition(conditions: ActivityCondition[], join: string): string {
  if (conditions.length === 0) return ""
  return conditions
    .map((c) => `activity.${c.field} ${c.operator} '${c.value}'`)
    .join(` ${join} `)
}

function buildSigningResourceCondition(conditions: SigningResourceCondition[], join: string): string {
  if (conditions.length === 0) return ""
  return conditions
    .map((c) => {
      const isBool = BOOLEAN_FIELDS.has(c.field)
      const formattedValue = isBool ? c.value : `'${c.value}'`
      return `${c.resourceType}.${c.field} ${c.operator} ${formattedValue}`
    })
    .join(` ${join} `)
}

/**
 * Compiles a `ConditionConfig` into a CEL condition expression string.
 *
 * Dispatches to chain-specific sub-builders (`buildEthereumCondition`,
 * `buildSolanaCondition`, etc.) and chain-agnostic sub-builders
 * (`buildActivityCondition`, `buildSigningResourceCondition`), then joins all
 * non-empty parts with `conditionJoin` (defaulting to `"&&"`).
 *
 * If `config.rawCondition` is set the entire builder is bypassed and the raw
 * string is returned unchanged — useful for condition shapes not supported by
 * the structured sub-builders.
 *
 * @param config - Structured condition configuration from the policy builder UI.
 * @returns        CEL expression string, or `""` if no conditions are configured.
 */
export function buildConditionExpression(config: ConditionConfig): string {
  if (config.rawCondition) {
    return config.rawCondition
  }

  const join = config.conditionJoin || "&&"
  const parts: string[] = []

  if (config.chain) {
    let chainExpr = ""
    switch (config.chain) {
      case "ethereum":
        chainExpr = config.ethereum ? buildEthereumCondition(config.ethereum, join) : ""
        break
      case "solana":
        chainExpr = config.solana ? buildSolanaCondition(config.solana, join) : ""
        break
      case "tron":
        chainExpr = config.tron ? buildTronCondition(config.tron, join) : ""
        break
      case "bitcoin":
        chainExpr = config.bitcoin ? buildBitcoinCondition(config.bitcoin, join) : ""
        break
    }
    if (chainExpr) parts.push(chainExpr)
  }

  if (config.activity && config.activity.length > 0) {
    const activityExpr = buildActivityCondition(config.activity, join)
    if (activityExpr) parts.push(activityExpr)
  }

  if (config.signingResource && config.signingResource.length > 0) {
    const resourceExpr = buildSigningResourceCondition(config.signingResource, join)
    if (resourceExpr) parts.push(resourceExpr)
  }

  return parts.join(` ${join} `)
}

/**
 * Compiles a `PolicyConfig` into a `TurnkeyPolicy` ready for the API.
 *
 * This is the primary entry point of the compilation pipeline:
 * 1. Copies `policyName` and `effect` verbatim.
 * 2. Calls `buildConsensusExpression` and attaches the result only if non-empty.
 * 3. Calls `buildConditionExpression` and attaches the result only if non-empty.
 * 4. Passes `notes` through if provided.
 *
 * The returned object can be spread directly into a `createPolicy` or
 * `updatePolicy` API call body.
 *
 * @param config - Structured policy configuration from the policy builder UI.
 * @returns        Wire-format `TurnkeyPolicy` with compiled CEL expression strings.
 */
export function buildPolicy(config: PolicyConfig): TurnkeyPolicy {
  const policy: TurnkeyPolicy = {
    policyName: config.policyName || "Unnamed Policy",
    effect: config.effect,
  }

  if (config.consensus) {
    const consensusExpr = buildConsensusExpression(config.consensus)
    if (consensusExpr) policy.consensus = consensusExpr
  }

  if (config.condition) {
    const conditionExpr = buildConditionExpression(config.condition)
    if (conditionExpr) policy.condition = conditionExpr
  }

  if (config.notes) policy.notes = config.notes

  return policy
}

/**
 * Serializes a compiled `TurnkeyPolicy` to a pretty-printed JSON string.
 *
 * Used by the JSON inspector panel in the policy builder UI to display the
 * exact payload that would be sent to the API.
 *
 * @param policy - A compiled `TurnkeyPolicy` (typically produced by `buildPolicy`).
 * @returns        Two-space indented JSON string.
 */
export function formatPolicyJson(policy: TurnkeyPolicy): string {
  return JSON.stringify(policy, null, 2)
}
