/**
 * Shared runtime types for the step-execution system.
 *
 * These types define the building blocks used by every demo scenario:
 * what operations can be performed (`StepKind`), how they are configured
 * (`StepConfig`), what state accumulates across steps (`SessionState`),
 * and what a single step execution returns (`StepResult`).
 *
 * Scenarios are assembled from `StepConfig` arrays and executed sequentially;
 * each step reads from and writes to a `SessionState` object that is threaded
 * through the entire run.
 */

/**
 * Discriminated union of all Turnkey API operations that can appear as a step
 * in a scenario.  Each member maps 1-to-1 with a Turnkey activity type or
 * query endpoint.  The value is used as a routing key inside the step-executor
 * to select the correct API call.
 */
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

/**
 * Configuration for a single step within a scenario.
 *
 * Steps are purely declarative — they describe what should happen and carry
 * any input data the executor needs.  The executor matches on `kind` to
 * determine which API call to make.
 */
export interface StepConfig {
  /** Which Turnkey operation this step performs. Used as a routing key by the executor. */
  kind: StepKind
  /** Short human-readable label shown in the step list UI. */
  title: string
  /** Longer explanation shown in the step detail panel. */
  description: string
  /**
   * Step-specific input parameters (e.g. `{ type: 'permissive' }` for policy
   * steps, `{ useAllowedAddress: true }` for sign steps).  Typed loosely as
   * `Record<string, unknown>` to avoid widening the `StepConfig` union — each
   * executor branch narrows to the shape it expects at runtime.
   */
  params?: Record<string, unknown>
}

/**
 * A named, ordered collection of steps that forms a complete demo flow.
 */
export interface Scenario {
  /** Unique slug used as a URL segment and lookup key. */
  id: string
  /** Display name shown in the scenario selector. */
  name: string
  /** Short summary shown beneath the scenario title. */
  description: string
  /** Ordered list of steps to execute. */
  steps: StepConfig[]
}

/**
 * Mutable state bag threaded through every step in a scenario run.
 *
 * IDs produced by earlier steps (e.g. `subOrgId` from `CREATE_SUB_ORG`) are
 * stored here and consumed by later steps that declare them as requirements.
 * The executor merges each `StepResult.updatedState` into this object after
 * every successful step.
 *
 * **Security note:** `apiUserPrivateKey` is stored here only for the duration
 * of a demo session so that subsequent steps can sign as the API user.  It is
 * ephemeral and must never be persisted server-side or logged in a production
 * environment.
 */
export interface SessionState {
  /** ID of the sub-organization created during this session. */
  subOrgId?: string
  /** Display name of the sub-organization. */
  subOrganizationName?: string
  /** ID of the HD wallet created inside the sub-org. */
  walletId?: string
  /** Primary Ethereum address derived from the wallet. */
  walletAddress?: string
  /** ID of the API-only user created inside the sub-org. */
  apiUserId?: string
  /** P256 public key of the ephemeral API user key pair. */
  apiUserPublicKey?: string
  /**
   * P256 private key of the ephemeral API user key pair.
   * Ephemeral and demo-only — must never be persisted server-side in production.
   */
  apiUserPrivateKey?: string
  /** ID of the policy created during this session. */
  policyId?: string
  /** Ethereum address added to the signing allowlist by the policy. */
  allowedAddress?: string
  /** ID of the standalone private key created during this session. */
  privateKeyId?: string
  /** ID of the user tag created during this session. */
  userTagId?: string
  /** ID of the private key tag created during this session. */
  privateKeyTagId?: string
  /** ID of an API key created or retrieved during this session. */
  apiKeyId?: string
  /** ID of the root user in the sub-organization. */
  rootUserId?: string
}

/**
 * The return value of executing a single step.
 *
 * Contains the raw request and response for display in the JSON inspector,
 * the updated session state to merge after this step, and metadata such as
 * latency and whether the step was expected to fail.
 */
export interface StepResult {
  /** Whether the API call succeeded (or, for expected failures, whether it failed as intended). */
  success: boolean
  /**
   * When true, a non-success result is treated as the correct outcome.
   * Used for demo steps like "sign to blocked address" that are designed to
   * demonstrate policy rejection — a failure here means the policy is working.
   */
  expectedFailure?: boolean
  /** The exact request payload sent to the Turnkey API, for display in the UI. */
  request: unknown
  /** The raw API response (or error body), for display in the UI. */
  response: unknown
  /** Human-readable error message when `success` is false and `expectedFailure` is not set. */
  error?: string
  /** Round-trip time for the API call in milliseconds. */
  latencyMs?: number
  /** Partial `SessionState` to merge after this step completes. */
  updatedState: SessionState
}
