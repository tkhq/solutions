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

export function formatPolicyJson(policy: TurnkeyPolicy): string {
  return JSON.stringify(policy, null, 2)
}
