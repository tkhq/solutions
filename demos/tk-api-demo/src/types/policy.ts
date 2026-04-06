export type PolicyEffect = "EFFECT_ALLOW" | "EFFECT_DENY"

export type ChainType = "ethereum" | "solana" | "tron" | "bitcoin"

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

export interface ConsensusConfig {
  operator: ConsensusOperator
  users: UserCondition[]
  countThreshold?: number
  tags?: TagCondition[]
  tagCountThreshold?: number
  credentials?: CredentialCondition[]
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
  rawCondition?: string
}

export interface PolicyConfig {
  policyName: string
  effect: PolicyEffect
  consensus?: ConsensusConfig
  condition?: ConditionConfig
  notes?: string
}

export interface TurnkeyPolicy {
  policyName: string
  effect: PolicyEffect
  consensus?: string
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
