/**
 * Policy type definitions — two-layer model.
 *
 * Layer 1 — UI representation: `PolicyConfig` is the structured, field-by-field
 * form that the policy builder component works with.  It keeps chain conditions,
 * activity conditions, and consensus rules in typed, composable sub-objects.
 *
 * Layer 2 — API representation: `TurnkeyPolicy` is what the Turnkey
 * `createPolicy` / `updatePolicy` API actually accepts — the `consensus` and
 * `condition` fields are compiled down to CEL expression strings.
 *
 * The compilation step is performed by `buildPolicy()` in `src/lib/policy-builder.ts`.
 * Nothing outside that module should need to construct `TurnkeyPolicy` manually.
 */

/**
 * Whether the policy grants or denies the matched operations.
 * - `"EFFECT_ALLOW"` — permit matching activities.
 * - `"EFFECT_DENY"`  — block matching activities (takes precedence over allow policies).
 */
export type PolicyEffect = "EFFECT_ALLOW" | "EFFECT_DENY"

export type ChainType = "ethereum" | "solana" | "tron" | "bitcoin"

/**
 * Determines how approvers are evaluated in the consensus expression.
 *
 * - `"any"`       — at least one of the listed users must approve.
 * - `"all"`       — every listed user must approve.
 * - `"count"`     — a numeric threshold of matching approvers must be reached.
 * - `"tag_any"`   — at least one approver with the specified tag must approve.
 * - `"tag_count"` — a threshold number of approvers bearing the tag must approve.
 * - `"credential"` — approval is gated on a specific authenticator credential attribute.
 */
export type ConsensusOperator =
  | "any"
  | "all"
  | "count"
  | "tag_any"
  | "tag_count"
  | "credential"

export interface UserCondition {
  id: string
  userId: string
}

export interface TagCondition {
  id: string
  tagId: string
}

export interface CredentialCondition {
  id: string
  field: "id" | "type" | "credential_id" | "public_key"
  operator: "==" | "!="
  value: string
}

/**
 * Structured representation of a consensus (approver) rule.
 *
 * The `operator` field selects which CEL template is generated:
 * - `"any"` / `"all"` / `"count"` operate on explicit `users` membership.
 * - `"tag_any"` / `"tag_count"` operate on user tag membership via `tags`.
 * - `"credential"` matches on a specific authenticator attribute via `credentials`.
 *
 * Fields irrelevant to the chosen operator are ignored during compilation.
 */
export interface ConsensusConfig {
  operator: ConsensusOperator
  /** Explicit user IDs checked for `any`, `all`, and `count` operators. */
  users: UserCondition[]
  /** Minimum number of approvers required when `operator` is `"count"` or `"tag_count"`. */
  countThreshold?: number
  /** Tag IDs checked for `tag_any` and `tag_count` operators. */
  tags?: TagCondition[]
  /** Minimum number of tag-bearing approvers for `tag_count`. */
  tagCountThreshold?: number
  /** Credential conditions checked for `credential` operator. */
  credentials?: CredentialCondition[]
  /** Whether `"any"` or `"all"` credentials must match when operator is `"credential"`. */
  credentialQuantifier?: "any" | "all"
}

// Ethereum condition types
export interface EthereumCondition {
  field: "to" | "value" | "chain_id" | "gas" | "gas_price" | "data"
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "startsWith"
  value: string
}

// Solana condition types
export type SolanaTransferField = "to" | "from" | "amount"
export type SolanaQuantifier = "all" | "any" | "count"

export interface SolanaTransferCondition {
  type: "transfers" | "spl_transfers"
  quantifier: SolanaQuantifier
  field: SolanaTransferField
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string
  countValue?: number
}

export interface SolanaInstructionCondition {
  quantifier: SolanaQuantifier
  field: "program_key" | "count"
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string
}

export interface SolanaConditionConfig {
  conditions: (SolanaTransferCondition | SolanaInstructionCondition)[]
  instructionCount?: { operator: "==" | ">" | "<" | ">=" | "<="; value: number }
  transferCount?: { operator: "==" | ">" | "<" | ">=" | "<="; value: number }
}

// Tron condition types
export type TronContractType =
  | "TransferContract"
  | "TriggerSmartContract"
  | "DelegateResourceContract"
  | "UnDelegateResourceContract"
  | "FreezeBalanceV2Contract"
  | "UnfreezeBalanceV2Contract"
  | "AccountPermissionUpdateContract"

export interface TronCondition {
  contractType?: TronContractType
  field?: "owner_address" | "to_address" | "amount" | "contract_address"
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string
}

// Bitcoin condition types
export interface BitcoinOutputCondition {
  id: string
  quantifier: "all" | "any"
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string
}

export interface BitcoinConditionConfig {
  outputConditions: BitcoinOutputCondition[]
}

// Activity condition types
export interface ActivityCondition {
  field: "type" | "resource" | "action"
  operator: "==" | "!="
  value: string
}

// Signing resource condition types
export type SigningResourceType = "wallet" | "wallet_account" | "private_key"

export interface SigningResourceCondition {
  id: string
  resourceType: SigningResourceType
  field: string
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string
}

/**
 * Structured representation of the `condition` portion of a policy.
 *
 * Conditions are independent sections that get compiled and joined by
 * `conditionJoin`.  At most one chain section (`ethereum`, `solana`, `tron`,
 * or `bitcoin`) should be provided per config.  The `activity` and
 * `signingResource` sections are chain-agnostic and can be combined freely.
 *
 * **Escape hatch:** if `rawCondition` is set, all structured builder logic is
 * bypassed and the string is passed directly to the API as the CEL expression.
 * Use this for condition shapes not yet supported by the structured builders.
 */
export interface ConditionConfig {
  conditionJoin?: "&&" | "||"
  // Network/chain section (optional)
  chain?: ChainType
  ethereum?: EthereumCondition[]
  solana?: SolanaConditionConfig
  tron?: TronCondition[]
  bitcoin?: BitcoinConditionConfig
  // Activity section (optional, independent of chain)
  activity?: ActivityCondition[]
  // Signing resource section (optional, independent of chain)
  signingResource?: SigningResourceCondition[]
  /**
   * Raw CEL expression string.  When present, all structured builder logic is
   * skipped and this value is passed to the API verbatim.  Useful for advanced
   * or unsupported condition patterns.
   */
  rawCondition?: string
}

export interface PolicyConfig {
  policyName: string
  effect: PolicyEffect
  consensus?: ConsensusConfig
  condition?: ConditionConfig
  notes?: string
}

/**
 * The wire format sent to the Turnkey `createPolicy` / `updatePolicy` API.
 *
 * Unlike `PolicyConfig`, the `consensus` and `condition` fields here are
 * already-compiled CEL expression strings rather than structured objects.
 * Instances of this type are produced exclusively by `buildPolicy()` in
 * `src/lib/policy-builder.ts` and should not be constructed manually.
 */
export interface TurnkeyPolicy {
  policyName: string
  effect: PolicyEffect
  /** Compiled CEL consensus expression (e.g. `"approvers.any(user, user.id == '...')"`) */
  consensus?: string
  /** Compiled CEL condition expression (e.g. `"eth.tx.to == '0x...'"`) */
  condition?: string
  notes?: string
}

export interface PolicyPreset {
  id: string
  name: string
  description: string
  category: "ethereum" | "solana" | "tron" | "general"
  config: PolicyConfig
  docUrl?: string
}
