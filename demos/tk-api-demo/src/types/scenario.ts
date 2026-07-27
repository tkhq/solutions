export type StepKind =
  | 'CREATE_SUB_ORG'
  | 'CREATE_WALLET'
  | 'CREATE_API_USER'
  | 'CREATE_POLICY'
  | 'SIGN_TRANSACTION'

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

export type StepStatus = 'pending' | 'running' | 'success' | 'expected-failure' | 'error'

export interface StepState {
  status: StepStatus
  result?: StepResult
}
