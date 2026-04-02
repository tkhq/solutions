export type StepKind =
  // ── Create activities ──────────────────────────────────────────
  | 'CREATE_SUB_ORG'
  | 'CREATE_WALLET'
  | 'CREATE_WALLET_ACCOUNTS'
  | 'CREATE_API_USER'
  | 'CREATE_API_KEYS'
  | 'CREATE_PRIVATE_KEY'
  | 'CREATE_POLICY'
  // ── Sign activities ────────────────────────────────────────────
  | 'SIGN_TRANSACTION'
  | 'SIGN_RAW_PAYLOAD'
  | 'SIGN_RAW_PAYLOADS'
  // ── Update activities ──────────────────────────────────────────
  | 'UPDATE_WALLET'
  | 'UPDATE_POLICY'
  | 'UPDATE_USER'
  // ── Delete activities ──────────────────────────────────────────
  | 'DELETE_POLICY'
  | 'DELETE_WALLETS'
  | 'DELETE_USERS'
  // ── Queries ────────────────────────────────────────────────────
  | 'GET_WHO_AM_I'
  | 'GET_WALLET'
  | 'GET_USER'
  | 'GET_POLICY'
  | 'GET_API_KEYS'
  | 'GET_CONFIGS'
  | 'LIST_WALLETS'
  | 'LIST_WALLET_ACCOUNTS'
  | 'LIST_USERS'
  | 'LIST_POLICIES'
  | 'LIST_ACTIVITIES'
  | 'LIST_PRIVATE_KEYS'

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
