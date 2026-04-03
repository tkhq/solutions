export type StepKind =
  // ── Create activities ──────────────────────────────────────────
  | 'CREATE_SUB_ORG'
  | 'CREATE_WALLET'
  | 'CREATE_WALLET_ACCOUNTS'
  | 'CREATE_API_USER'
  | 'CREATE_API_KEYS'
  | 'CREATE_PRIVATE_KEY'
  | 'CREATE_POLICY'
  | 'CREATE_USER_TAG'
  | 'CREATE_PRIVATE_KEY_TAG'
  | 'CREATE_POLICIES'
  | 'CREATE_INVITATIONS'
  // ── Sign activities ────────────────────────────────────────────
  | 'SIGN_TRANSACTION'
  | 'SIGN_RAW_PAYLOAD'
  | 'SIGN_RAW_PAYLOADS'
  // ── Update activities ──────────────────────────────────────────
  | 'UPDATE_WALLET'
  | 'UPDATE_POLICY'
  | 'UPDATE_USER'
  | 'UPDATE_ROOT_QUORUM'
  | 'UPDATE_ORGANIZATION_NAME'
  | 'SET_ORG_FEATURE'
  | 'REMOVE_ORG_FEATURE'
  // ── Delete activities ──────────────────────────────────────────
  | 'DELETE_POLICY'
  | 'DELETE_WALLETS'
  | 'DELETE_USERS'
  | 'DELETE_PRIVATE_KEYS'
  | 'DELETE_API_KEYS'
  | 'DELETE_USER_TAGS'
  | 'DELETE_PRIVATE_KEY_TAGS'
  | 'DELETE_POLICIES'
  // ── Queries ────────────────────────────────────────────────────
  | 'GET_WHO_AM_I'
  | 'GET_WALLET'
  | 'GET_USER'
  | 'GET_POLICY'
  | 'GET_API_KEYS'
  | 'GET_CONFIGS'
  | 'GET_PRIVATE_KEY'
  | 'GET_AUTHENTICATORS'
  | 'GET_SUB_ORGS'
  | 'GET_VERIFIED_SUB_ORGS'
  | 'LIST_WALLETS'
  | 'LIST_WALLET_ACCOUNTS'
  | 'LIST_USERS'
  | 'LIST_POLICIES'
  | 'LIST_ACTIVITIES'
  | 'LIST_PRIVATE_KEYS'
  | 'LIST_USER_TAGS'
  | 'LIST_PRIVATE_KEY_TAGS'
  | 'LIST_SUPPORTED_ASSETS'

export interface StepConfig {
  kind: StepKind
  title: string
  description: string
  params?: Record<string, unknown>
}

export interface Scenario {
  id: string
  name: string
  description: string
  steps: StepConfig[]
}

export interface SessionState {
  subOrgId?: string
  subOrganizationName?: string
  walletId?: string
  walletAddress?: string
  apiUserId?: string
  apiUserPublicKey?: string
  apiUserPrivateKey?: string
  policyId?: string
  allowedAddress?: string
  privateKeyId?: string
  userTagId?: string
  privateKeyTagId?: string
  apiKeyId?: string
  rootUserId?: string
}

export interface StepResult {
  success: boolean
  expectedFailure?: boolean
  request: unknown
  response: unknown
  error?: string
  latencyMs?: number
  updatedState: SessionState
}
