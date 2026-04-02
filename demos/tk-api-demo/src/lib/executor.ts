import { Turnkey, DEFAULT_ETHEREUM_ACCOUNTS } from '@turnkey/sdk-server'
import { generateP256KeyPair } from '@turnkey/crypto'
import { ethers } from 'ethers'
import type { StepConfig, SessionState, StepResult } from '@/types/scenario'

function parentClient() {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  }).apiClient()
}

function subOrgClient(subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: subOrgId,
  }).apiClient()
}

function apiUserClient(publicKey: string, privateKey: string, subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
    defaultOrganizationId: subOrgId,
  }).apiClient()
}

const STRIP_KEYS = new Set([
  'votes', 'fingerprint', 'canApprove', 'canReject', 'createdAt', 'updatedAt', 'appProofs',
])

// Returns a structured JSON-renderable object from a caught error so it can be
// displayed through JsonTree in the response panel rather than as raw text.
function formatError(error: unknown): unknown {
  if (error !== null && typeof error === 'object' && 'details' in error) {
    const e = error as { code?: number; message?: string; details: unknown }
    const message = (e.message ?? '').replace(/ \(Details:.*?\)$/s, '')
    const result: Record<string, unknown> = { code: e.code, message }
    if (e.details) result.details = trimResponse(e.details)
    return result
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

function trimResponse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(trimResponse)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !STRIP_KEYS.has(k))
        .map(([k, v]) => [k, trimResponse(v)])
    )
  }
  return value
}

// Wraps a value with a display comment rendered inline in the UI request panel.
// Only affects display — the comment is never sent to Turnkey.
export function annotate(value: unknown, comment: string) {
  return { __value: value, __comment: comment }
}

// Builds the human-readable request shown in the UI — used both as a preview
// before execution and as the logged request after execution.
export function buildDisplayRequest(step: StepConfig, state: SessionState): unknown {
  switch (step.kind) {
    case 'CREATE_SUB_ORG':
      return {
        organizationId: annotate(
          state.subOrgId ? process.env.ORGANIZATION_ID : process.env.ORGANIZATION_ID,
          'parent org'
        ),
        subOrganizationName: state.subOrganizationName ?? 'Demo Sub-Org <timestamp>',
        rootUsers: [
          {
            userName: 'Sub-Org Admin',
            apiKeys: [
              {
                apiKeyName: 'Server Admin Key',
                publicKey: process.env.API_PUBLIC_KEY,
                curveType: 'API_KEY_CURVE_P256',
              },
            ],
            authenticators: [],
            oauthProviders: [],
          },
        ],
        rootQuorumThreshold: 1,
      }

    case 'CREATE_WALLET':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        walletName: 'Demo Wallet',
        accounts: DEFAULT_ETHEREUM_ACCOUNTS,
      }

    case 'CREATE_API_USER':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        apiOnlyUsers: [
          {
            userName: 'Demo API User',
            userTags: [],
            apiKeys: [
              {
                apiKeyName: 'Demo API Key',
                publicKey: state.apiUserPublicKey ?? annotate('<generated P256 public key>', 'ephemeral, generated at runtime'),
              },
            ],
          },
        ],
      }

    case 'CREATE_POLICY': {
      const { allowedAddress } = step.params as { allowedAddress: string }
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        policyName: 'Address Allowlist',
        effect: 'EFFECT_ALLOW',
        consensus: `approvers.any(user, user.id == '${state.apiUserId ?? annotate('<apiUserId>', 'from step 3')}')`,
        condition: `eth.tx.to == '${allowedAddress.toLowerCase()}'`,
      }
    }

    case 'SIGN_TRANSACTION': {
      const { useAllowedAddress } = step.params as { useAllowedAddress: boolean }
      const targetAddress = useAllowedAddress
        ? (state.allowedAddress ?? annotate('<allowedAddress>', 'from policy'))
        : '0x000000000000000000000000000000000000dEaD'
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        signWith: state.walletAddress ?? annotate('<walletAddress>', 'from step 2'),
        type: 'TRANSACTION_TYPE_ETHEREUM',
        transaction: {
          to: targetAddress,
          value: '0.001 ETH',
          type: 'EIP-1559',
          chainId: 1,
          note: useAllowedAddress
            ? 'destination is on the allowlist'
            : 'destination is NOT on the allowlist',
        },
      }
    }

    default:
      return {}
  }
}

export async function executeStep(
  step: StepConfig,
  state: SessionState
): Promise<StepResult> {
  switch (step.kind) {
    case 'CREATE_SUB_ORG':
      return executeCreateSubOrg(step, state)
    case 'CREATE_WALLET':
      return executeCreateWallet(step, state)
    case 'CREATE_API_USER':
      return executeCreateApiUser(step, state)
    case 'CREATE_POLICY':
      return executeCreatePolicy(step, state, step.params as { allowedAddress: string })
    case 'SIGN_TRANSACTION':
      return executeSignTransaction(step, state, step.params as { useAllowedAddress: boolean })
    default:
      throw new Error(`Unknown step kind: ${(step as StepConfig).kind}`)
  }
}

async function executeCreateSubOrg(step: StepConfig, state: SessionState): Promise<StepResult> {
  const client = parentClient()
  const subOrganizationName = `demo sub-org ${new Date().toISOString()}`

  const requestParams = {
    organizationId: process.env.ORGANIZATION_ID!,
    subOrganizationName,
    rootUsers: [
      {
        userName: 'sub-org admin',
        apiKeys: [
          {
            apiKeyName: 'server admin key',
            publicKey: process.env.API_PUBLIC_KEY!,
            curveType: 'API_KEY_CURVE_P256' as const,
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
  }

  try {
    const response = await client.createSubOrganization(requestParams)
    const updatedState = { ...state, subOrgId: response.subOrganizationId, subOrganizationName }
    return {
      success: true,
      request: buildDisplayRequest(step, updatedState),
      response: trimResponse(response),
      updatedState,
    }
  } catch (error) {
    return {
      success: false,
      request: buildDisplayRequest(step, state),
      response: formatError(error),
      updatedState: state,
    }
  }
}

async function executeCreateWallet(step: StepConfig, state: SessionState): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)

  const requestParams = {
    organizationId: state.subOrgId!,
    walletName: 'Demo Wallet',
    accounts: DEFAULT_ETHEREUM_ACCOUNTS,
  }

  try {
    const response = await client.createWallet(requestParams)
    const updatedState = {
      ...state,
      walletId: response.walletId,
      walletAddress: response.addresses[0],
    }
    return {
      success: true,
      request: buildDisplayRequest(step, updatedState),
      response: trimResponse(response),
      updatedState,
    }
  } catch (error) {
    return {
      success: false,
      request: buildDisplayRequest(step, state),
      response: formatError(error),
      updatedState: state,
    }
  }
}

async function executeCreateApiUser(step: StepConfig, state: SessionState): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const { privateKey, publicKey } = generateP256KeyPair()

  const requestParams = {
    organizationId: state.subOrgId!,
    apiOnlyUsers: [
      {
        userName: 'Demo API User',
        userTags: [],
        apiKeys: [
          {
            apiKeyName: 'Demo API Key',
            publicKey: publicKey,
          },
        ],
      },
    ],
  }

  try {
    const response = await client.createApiOnlyUsers(requestParams)
    const updatedState = {
      ...state,
      apiUserId: response.userIds[0],
      apiUserPublicKey: publicKey,
      apiUserPrivateKey: privateKey,
    }
    return {
      success: true,
      request: buildDisplayRequest(step, updatedState),
      response: trimResponse(response),
      updatedState,
    }
  } catch (error) {
    return {
      success: false,
      request: buildDisplayRequest(step, state),
      response: formatError(error),
      updatedState: state,
    }
  }
}

async function executeCreatePolicy(
  step: StepConfig,
  state: SessionState,
  params: { allowedAddress: string }
): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const { allowedAddress } = params

  const requestParams = {
    organizationId: state.subOrgId!,
    policyName: 'Address Allowlist',
    effect: 'EFFECT_ALLOW' as const,
    consensus: `approvers.any(user, user.id == '${state.apiUserId}')`,
    condition: `eth.tx.to == '${allowedAddress.toLowerCase()}'`,
    notes: '',
  }

  try {
    const response = await client.createPolicy(requestParams)
    const updatedState = { ...state, policyId: response.policyId, allowedAddress }
    return {
      success: true,
      request: buildDisplayRequest(step, updatedState),
      response: trimResponse(response),
      updatedState,
    }
  } catch (error) {
    return {
      success: false,
      request: buildDisplayRequest(step, state),
      response: formatError(error),
      updatedState: state,
    }
  }
}

async function executeSignTransaction(
  step: StepConfig,
  state: SessionState,
  params: { useAllowedAddress: boolean }
): Promise<StepResult> {
  const targetAddress = params.useAllowedAddress
    ? state.allowedAddress!
    : '0x000000000000000000000000000000000000dEaD'

  const tx = new ethers.Transaction()
  tx.to = targetAddress
  tx.value = ethers.parseEther('0.001')
  tx.gasLimit = 21000n
  tx.maxFeePerGas = ethers.parseUnits('50', 'gwei')
  tx.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei')
  tx.nonce = 0
  tx.chainId = 1n
  tx.type = 2

  const unsignedTransaction = tx.unsignedSerialized.slice(2) // strip 0x

  const client = apiUserClient(
    state.apiUserPublicKey!,
    state.apiUserPrivateKey!,
    state.subOrgId!
  )

  const expectedFailure = !params.useAllowedAddress

  try {
    const response = await client.signTransaction({
      organizationId: state.subOrgId!,
      signWith: state.walletAddress!,
      unsignedTransaction,
      type: 'TRANSACTION_TYPE_ETHEREUM',
    })
    return {
      success: true,
      expectedFailure,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: state,
    }
  } catch (error) {
    return {
      success: false,
      expectedFailure,
      request: buildDisplayRequest(step, state),
      response: formatError(error),
      updatedState: state,
    }
  }
}
