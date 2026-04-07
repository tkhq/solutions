import { DEFAULT_ETHEREUM_ACCOUNTS } from '@turnkey/sdk-server'
import { generateP256KeyPair } from '@turnkey/crypto'
import { ethers } from 'ethers'
import type { StepConfig, SessionState, StepResult } from '@/types/scenario'
import { parentClient, subOrgClient, apiUserClient, getParentOrgName, getCachedParentOrgName } from '@/lib/turnkey-client'

function defaultSubOrgName(orgName: string): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yyyy = now.getFullYear()
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')
  return `Demo ${orgName} SubOrg ${mm}/${dd}/${yyyy} ${hh}:${min} #${rand}`
}

// Pre-warm org name cache on module load so the sync preview has it ready
getParentOrgName().catch(() => {})

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

// Returns the policy configuration for a given policy type.
// Used by both buildDisplayRequest and executeCreatePolicy to stay in sync.
function getPolicyConfig(params: { type?: string; allowedAddress?: string }): {
  policyName: string
  effect: 'EFFECT_ALLOW' | 'EFFECT_DENY'
  condition: string
} {
  switch (params.type) {
    case 'permissive':
      return {
        policyName: 'Permissive Signing Policy',
        effect: 'EFFECT_ALLOW',
        condition: 'true',
      }
    case 'sign-only':
      return {
        policyName: 'Sign Operations Only',
        effect: 'EFFECT_ALLOW',
        condition: "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2' || activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
      }
    case 'allow-wallet-creation':
      return {
        policyName: 'Allow Wallet Creation',
        effect: 'EFFECT_ALLOW',
        condition: "activity.resource == 'WALLET' && activity.action == 'CREATE'",
      }
    case 'deny-all-deletes':
      return {
        policyName: 'Deny All Deletions',
        effect: 'EFFECT_DENY',
        condition: "activity.action == 'DELETE'",
      }
    case 'allow-auth':
      return {
        policyName: 'Allow Auth Activity',
        effect: 'EFFECT_ALLOW',
        condition: "activity.resource == 'AUTH' && activity.action == 'CREATE'",
      }
    case 'contract-only':
      return {
        policyName: 'Contract Signing Policy',
        effect: 'EFFECT_ALLOW',
        condition: "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
      }
    default: // address-allowlist
      return {
        policyName: 'Address Allowlist',
        effect: 'EFFECT_ALLOW',
        condition: `eth.tx.to == '${params.allowedAddress?.toLowerCase() ?? '<address>'}'`,
      }
  }
}

// Builds the human-readable request shown in the UI — used both as a preview
// before execution and as the logged request after execution.
export function buildDisplayRequest(step: StepConfig, state: SessionState): unknown {
  switch (step.kind) {
    case 'CREATE_SUB_ORG':
      return {
        organizationId: annotate(process.env.ORGANIZATION_ID ?? '<organizationId>', 'your root org — sub-orgs are always created under the parent'),
        subOrganizationName: annotate(state.subOrganizationName ?? defaultSubOrgName(getCachedParentOrgName() ?? 'YourOrg'), 'unique per end user — e.g. their user ID, email, or UUID'),
        rootUsers: [
          {
            userName: annotate('Server Admin', 'label for this root user — visible in your Turnkey dashboard'),
            apiKeys: [
              {
                apiKeyName: annotate('Server Admin Key', 'name for your server-side key — helps identify it later'),
                publicKey: annotate(process.env.API_PUBLIC_KEY, 'your P256 public key from API_PUBLIC_KEY in .env — grants root access to this sub-org'),
                curveType: annotate('API_KEY_CURVE_P256', 'always P256 for server API keys'),
              },
            ],
            authenticators: annotate([], 'passkey authenticators — leave empty for API-key-only server access'),
            oauthProviders: annotate([], 'OIDC/OAuth providers — add if using social login or JWTs'),
          },
        ],
        rootQuorumThreshold: annotate(1, '1 = single key required to approve; raise for multi-sig consensus'),
      }

    case 'CREATE_WALLET': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        walletName: annotate('Main Wallet', 'e.g. "Main Wallet", "Trading Wallet", "Hot Wallet"'),
        accounts: [{
          curve: annotate('CURVE_SECP256K1', 'CURVE_SECP256K1 for Ethereum/EVM/Bitcoin — CURVE_ED25519 for Solana/Near'),
          pathFormat: annotate('PATH_FORMAT_BIP32', 'BIP32 for HD wallets — standard across all chains'),
          path: annotate("m/44'/60'/0'/0/0", "BIP44 path — 60 = Ethereum cointype; increment last index for additional accounts (0, 1, 2...)"),
          addressFormat: annotate('ADDRESS_FORMAT_ETHEREUM', 'options: ADDRESS_FORMAT_ETHEREUM, ADDRESS_FORMAT_SOLANA, ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH, ADDRESS_FORMAT_COSMOS, etc.'),
        }],
      }
    }

    case 'CREATE_API_USER':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from create sub-org step'),
        apiOnlyUsers: [
          {
            userName: annotate('Server API User', 'label for this user — visible in your dashboard'),
            userTags: annotate([], 'optional — apply tag IDs from parent org setup e.g. ["<userTagId>"]'),
            apiKeys: [
              {
                apiKeyName: annotate('Server Key', 'name for this API key — helps identify it in the dashboard'),
                publicKey: state.apiUserPublicKey ?? annotate('<generated P256 public key>', 'auto-generated P256 key — do not change, the private key is stored in session'),
              },
            ],
          },
        ],
      }

    case 'CREATE_POLICY': {
      const params = step.params as { type?: string; allowedAddress?: string }
      const { policyName, effect, condition } = getPolicyConfig(params)
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        policyName: annotate(policyName, 'name this clearly — it appears in your Turnkey dashboard'),
        effect: annotate(effect, 'EFFECT_ALLOW to permit the action, EFFECT_DENY to block it'),
        consensus: annotate(
          `approvers.any(user, user.id == '${state.apiUserId ?? '<apiUserId>'}')`,
          'who must approve — supports user.id, user.tags, user.groups; use "true" to auto-approve'
        ),
        condition: annotate(condition, 'when this policy applies — "true" = always; or restrict by activity type, chain, address, etc.'),
        notes: annotate('Allow all signing activity', 'describe what this policy does — for your own reference'),
      }
    }

    case 'SIGN_TRANSACTION': {
      const params = step.params as { useAllowedAddress?: boolean; type?: string }

      if (params.type === 'deploy') {
        return {
          organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
          signWith: state.walletAddress ?? annotate('<walletAddress>', 'deployer address from wallet step'),
          type: 'TRANSACTION_TYPE_ETHEREUM',
          transaction: {
            to: annotate(null, 'null = contract deployment — no recipient, Ethereum will assign a contract address'),
            data: annotate('0x6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358', 'compiled contract bytecode — replace with the output of your Solidity/Vyper compiler'),
            value: annotate('0', 'ETH to send with deployment — usually 0 unless the constructor is payable'),
            type: 'EIP-1559',
            chainId: 1,
            gasLimit: annotate(500000, 'deployment uses more gas than a simple transfer — estimate via eth_estimateGas'),
          },
        }
      }

      if (params.type === 'contract-call') {
        const contractAddress = state.allowedAddress ?? '0x6B175474E89094C44Da98b954EedeAC495271d0F'
        return {
          organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
          signWith: state.walletAddress ?? annotate('<walletAddress>', 'from wallet step'),
          type: 'TRANSACTION_TYPE_ETHEREUM',
          transaction: {
            to: annotate(contractAddress, 'deployed contract address — the target of this call'),
            data: annotate('0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa9604500000000000000000000000000000000000000000000000de0b6b3a7640000', 'ABI-encoded transfer(address,uint256) — 0xa9059cbb is the function selector; replace data with your own encoded calldata'),
            value: annotate('0', 'ETH value — 0 for non-payable functions'),
            type: 'EIP-1559',
            chainId: 1,
          },
        }
      }

      const useAllowedAddress = params.useAllowedAddress ?? false
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

    case 'SIGN_RAW_PAYLOAD': {
      const message = 'Hello from the Turnkey API!'
      const payloadHex = ethers.keccak256(ethers.toUtf8Bytes(message)).slice(2)
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        signWith: state.walletAddress ?? annotate('<walletAddress>', 'from step 2'),
        payload: annotate(payloadHex, 'keccak256("Hello from the Turnkey API!")'),
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: annotate('HASH_FUNCTION_NO_OP', 'payload is already hashed'),
      }
    }

    case 'GET_WHO_AM_I':
      return {
        organizationId: annotate(process.env.ORGANIZATION_ID ?? '<organizationId>', 'your root organization ID — from ORGANIZATION_ID in your .env'),
      }

    case 'LIST_WALLETS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'GET_WALLET':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        walletId: state.walletId ?? annotate('<walletId>', 'from create wallet step'),
      }

    case 'LIST_USERS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'LIST_POLICIES':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'DELETE_POLICY':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        policyId: state.policyId ?? annotate('<policyId>', 'from create policy step'),
      }

    case 'CREATE_PRIVATE_KEY':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        privateKeys: [{
          privateKeyName: 'Demo Private Key',
          curve: 'CURVE_SECP256K1',
          addressFormats: ['ADDRESS_FORMAT_ETHEREUM'],
          privateKeyTags: [],
        }],
      }

    case 'CREATE_WALLET_ACCOUNTS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        walletId: state.walletId ?? annotate('<walletId>', 'from create wallet step'),
        accounts: [{
          curve: 'CURVE_SECP256K1',
          pathFormat: 'PATH_FORMAT_BIP32',
          path: annotate("m/44'/60'/0'/0/1", 'second Ethereum account index'),
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
        }],
      }

    case 'CREATE_API_KEYS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        userId: state.apiUserId ?? annotate('<apiUserId>', 'from create API user step'),
        apiKeys: [{
          apiKeyName: 'Additional API Key',
          publicKey: annotate('<generated P256 public key>', 'ephemeral, generated at runtime'),
          curveType: 'API_KEY_CURVE_P256',
        }],
      }

    case 'DELETE_WALLETS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        walletIds: [state.walletId ?? annotate('<walletId>', 'from create wallet step')],
        deleteWithoutExport: true,
      }

    case 'DELETE_USERS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        userIds: [state.apiUserId ?? annotate('<apiUserId>', 'from create API user step')],
      }

    case 'UPDATE_WALLET':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        walletId: state.walletId ?? annotate('<walletId>', 'from create wallet step'),
        walletName: 'Demo Wallet (updated)',
      }

    case 'UPDATE_POLICY': {
      const policyCondition = "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2' || activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'"
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        policyId: state.policyId ?? annotate('<policyId>', 'from create policy step'),
        policyName: 'Updated Policy',
        policyCondition,
        policyConsensus: `approvers.any(user, user.id == '${state.apiUserId ?? annotate('<apiUserId>', 'from step 3')}')`,
        policyEffect: 'EFFECT_ALLOW',
        policyNotes: '',
      }
    }

    case 'UPDATE_USER':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        userId: state.apiUserId ?? annotate('<apiUserId>', 'from create API user step'),
        userName: 'Demo API User (renamed)',
        userTagIds: [],
      }

    case 'SIGN_RAW_PAYLOADS': {
      const msgs = ['Payload 1: Hello from Turnkey', 'Payload 2: Batch signing demo']
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        signWith: state.walletAddress ?? annotate('<walletAddress>', 'from step 2'),
        payloads: msgs.map((msg) =>
          annotate(ethers.keccak256(ethers.toUtf8Bytes(msg)).slice(2), `keccak256("${msg}")`)
        ),
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: 'HASH_FUNCTION_NO_OP',
      }
    }

    case 'LIST_WALLET_ACCOUNTS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        walletId: state.walletId ?? annotate('<walletId>', 'from create wallet step'),
      }

    case 'LIST_ACTIVITIES':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'LIST_PRIVATE_KEYS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'GET_USER':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        userId: state.apiUserId ?? annotate('<apiUserId>', 'from create API user step'),
      }

    case 'GET_POLICY':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        policyId: state.policyId ?? annotate('<policyId>', 'from create policy step'),
      }

    case 'GET_API_KEYS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'GET_CONFIGS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'CREATE_USER_TAG': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        userTagName: annotate('end-user', 'e.g. "end-user", "admin", "trader", "read-only" — tag names appear in policy expressions'),
        userIds: annotate([], 'optional — assign existing users to this tag now, or leave empty and apply later'),
      }
    }

    case 'CREATE_PRIVATE_KEY_TAG': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        privateKeyTagName: annotate('hot-wallet', 'e.g. "hot-wallet", "cold-storage", "trading", "custody" — used in policy conditions'),
        privateKeyIds: annotate([], 'optional — tag existing private keys now, or leave empty and apply later'),
      }
    }

    case 'CREATE_POLICIES':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        policies: [{
          policyName: 'Demo Policy (bulk)',
          effect: 'EFFECT_ALLOW',
          consensus: `approvers.any(user, user.id == '${state.apiUserId ?? annotate('<apiUserId>', 'from step 3')}')`,
          condition: 'true',
          notes: 'Created via Turnkey API demo',
        }],
      }

    case 'CREATE_INVITATIONS': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        invitations: [{
          receiverUserName: annotate('New Team Member', 'display name for the invited user'),
          receiverUserEmail: annotate('teammate@yourcompany.com', 'email for the invitation — tip: use aliases like teammate+dev@yourcompany.com or teammate+prod@yourcompany.com to reuse the same email across environments'),
          receiverUserTags: annotate([], 'optional — apply tag IDs to control permissions e.g. ["<userTagId>"]'),
          accessType: annotate('ACCESS_TYPE_WEB', 'one of: ACCESS_TYPE_WEB, ACCESS_TYPE_API, ACCESS_TYPE_ALL'),
          senderUserId: state.rootUserId ?? annotate('<rootUserId>', 'root user ID — captured automatically from Verify Credentials step'),
        }],
      }
    }

    case 'DELETE_PRIVATE_KEYS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        privateKeyIds: [state.privateKeyId ?? annotate('<privateKeyId>', 'from create private key step')],
        deleteWithoutExport: true,
      }

    case 'DELETE_API_KEYS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        apiKeyIds: [state.apiKeyId ?? annotate('<apiKeyId>', 'from create API keys step')],
      }

    case 'DELETE_USER_TAGS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        userTagIds: [state.userTagId ?? annotate('<userTagId>', 'from create user tag step')],
      }

    case 'DELETE_PRIVATE_KEY_TAGS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        privateKeyTagIds: [state.privateKeyTagId ?? annotate('<privateKeyTagId>', 'from create private key tag step')],
      }

    case 'DELETE_POLICIES':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        policyIds: [state.policyId ?? annotate('<policyId>', 'from create policy step')],
      }

    case 'UPDATE_ROOT_QUORUM':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        threshold: 1,
        userIds: [state.apiUserId ?? annotate('<apiUserId>', 'from create API user step')],
      }

    case 'UPDATE_ORGANIZATION_NAME': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        organizationName: annotate('My App Wallets', 'e.g. "Acme Wallets", "Trading Desk", "My DeFi App" — visible in your dashboard'),
      }
    }

    case 'SET_ORG_FEATURE': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        name: annotate('FEATURE_NAME_EMAIL_AUTH', 'options: FEATURE_NAME_EMAIL_AUTH, FEATURE_NAME_EMAIL_RECOVERY, FEATURE_NAME_OTP_EMAIL_AUTH, FEATURE_NAME_ROOT_USER_EMAIL_RECOVERY, FEATURE_NAME_WEBAUTHN_ORIGINS, FEATURE_NAME_WEBHOOK, FEATURE_NAME_SMS_AUTH, FEATURE_NAME_AUTH_PROXY, FEATURE_NAME_SOLANA_RENT_PREFUND_ENABLED'),
      }
    }

    case 'REMOVE_ORG_FEATURE': {
      const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID
      return {
        organizationId: annotate(orgId ?? '<organizationId>', state.subOrgId ? 'sub-org ID' : 'your root organization ID'),
        name: annotate('FEATURE_NAME_EMAIL_AUTH', 'options: FEATURE_NAME_EMAIL_AUTH, FEATURE_NAME_EMAIL_RECOVERY, FEATURE_NAME_OTP_EMAIL_AUTH, FEATURE_NAME_ROOT_USER_EMAIL_RECOVERY, FEATURE_NAME_WEBAUTHN_ORIGINS, FEATURE_NAME_WEBHOOK, FEATURE_NAME_SMS_AUTH, FEATURE_NAME_AUTH_PROXY, FEATURE_NAME_SOLANA_RENT_PREFUND_ENABLED'),
      }
    }

    case 'GET_PRIVATE_KEY':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        privateKeyId: state.privateKeyId ?? annotate('<privateKeyId>', 'from create private key step'),
      }

    case 'GET_AUTHENTICATORS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
        userId: state.apiUserId ?? annotate('<apiUserId>', 'from create API user step'),
      }

    case 'GET_SUB_ORGS':
      return {
        organizationId: annotate(process.env.ORGANIZATION_ID ?? '<organizationId>', 'parent org'),
        filterType: annotate('EMAIL', 'one of: EMAIL, PHONE_NUMBER, OIDC_TOKEN, OAUTH_CLAIM'),
        filterValue: annotate('user@example.com', 'value to filter by'),
      }

    case 'GET_VERIFIED_SUB_ORGS':
      return {
        organizationId: annotate(process.env.ORGANIZATION_ID ?? '<organizationId>', 'parent org'),
        filterType: annotate('EMAIL', 'one of: EMAIL, PHONE_NUMBER, OIDC_TOKEN, OAUTH_CLAIM'),
        filterValue: annotate('user@example.com', 'value to filter by'),
      }

    case 'LIST_USER_TAGS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'LIST_PRIVATE_KEY_TAGS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    case 'LIST_SUPPORTED_ASSETS':
      return {
        organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from step 1'),
      }

    default:
      return {}
  }
}

export async function executeStep(
  step: StepConfig,
  state: SessionState,
  overrideRequest?: Record<string, unknown>
): Promise<StepResult> {
  const ov = overrideRequest
  switch (step.kind) {
    case 'CREATE_SUB_ORG':
      return executeCreateSubOrg(step, state, ov)
    case 'CREATE_WALLET':
      return executeCreateWallet(step, state, ov)
    case 'CREATE_API_USER':
      return executeCreateApiUser(step, state, ov)
    case 'CREATE_POLICY':
      return executeCreatePolicy(step, state, step.params as { type?: string; allowedAddress?: string }, ov)
    case 'SIGN_TRANSACTION':
      return executeSignTransaction(step, state, step.params as { useAllowedAddress?: boolean; type?: string }, ov)
    case 'SIGN_RAW_PAYLOAD':
      return executeSignRawPayload(step, state, ov)
    case 'GET_WHO_AM_I':
      return executeGetWhoAmI(step, state, ov)
    case 'LIST_WALLETS':
      return executeListWallets(step, state, ov)
    case 'GET_WALLET':
      return executeGetWallet(step, state, ov)
    case 'LIST_USERS':
      return executeListUsers(step, state, ov)
    case 'LIST_POLICIES':
      return executeListPolicies(step, state, ov)
    case 'DELETE_POLICY':
      return executeDeletePolicy(step, state, ov)
    case 'CREATE_PRIVATE_KEY':
      return executeCreatePrivateKey(step, state, ov)
    case 'CREATE_WALLET_ACCOUNTS':
      return executeCreateWalletAccounts(step, state, ov)
    case 'CREATE_API_KEYS':
      return executeCreateApiKeys(step, state, ov)
    case 'DELETE_WALLETS':
      return executeDeleteWallets(step, state, ov)
    case 'DELETE_USERS':
      return executeDeleteUsers(step, state, ov)
    case 'UPDATE_WALLET':
      return executeUpdateWallet(step, state, ov)
    case 'UPDATE_POLICY':
      return executeUpdatePolicy(step, state, ov)
    case 'UPDATE_USER':
      return executeUpdateUser(step, state, ov)
    case 'SIGN_RAW_PAYLOADS':
      return executeSignRawPayloads(step, state, ov)
    case 'LIST_WALLET_ACCOUNTS':
      return executeListWalletAccounts(step, state, ov)
    case 'LIST_ACTIVITIES':
      return executeListActivities(step, state, ov)
    case 'LIST_PRIVATE_KEYS':
      return executeListPrivateKeys(step, state, ov)
    case 'GET_USER':
      return executeGetUser(step, state, ov)
    case 'GET_POLICY':
      return executeGetPolicy(step, state, ov)
    case 'GET_API_KEYS':
      return executeGetApiKeys(step, state, ov)
    case 'GET_CONFIGS':
      return executeGetConfigs(step, state, ov)
    case 'CREATE_USER_TAG':
      return executeCreateUserTag(step, state, ov)
    case 'CREATE_PRIVATE_KEY_TAG':
      return executeCreatePrivateKeyTag(step, state, ov)
    case 'CREATE_POLICIES':
      return executeCreatePolicies(step, state, ov)
    case 'CREATE_INVITATIONS':
      return executeCreateInvitations(step, state, ov)
    case 'DELETE_PRIVATE_KEYS':
      return executeDeletePrivateKeys(step, state, ov)
    case 'DELETE_API_KEYS':
      return executeDeleteApiKeys(step, state, ov)
    case 'DELETE_USER_TAGS':
      return executeDeleteUserTags(step, state, ov)
    case 'DELETE_PRIVATE_KEY_TAGS':
      return executeDeletePrivateKeyTags(step, state, ov)
    case 'DELETE_POLICIES':
      return executeDeletePolicies(step, state, ov)
    case 'UPDATE_ROOT_QUORUM':
      return executeUpdateRootQuorum(step, state, ov)
    case 'UPDATE_ORGANIZATION_NAME':
      return executeUpdateOrganizationName(step, state, ov)
    case 'SET_ORG_FEATURE':
      return executeSetOrgFeature(step, state, ov)
    case 'REMOVE_ORG_FEATURE':
      return executeRemoveOrgFeature(step, state, ov)
    case 'GET_PRIVATE_KEY':
      return executeGetPrivateKey(step, state, ov)
    case 'GET_AUTHENTICATORS':
      return executeGetAuthenticators(step, state, ov)
    case 'GET_SUB_ORGS':
      return executeGetSubOrgs(step, state, ov)
    case 'GET_VERIFIED_SUB_ORGS':
      return executeGetVerifiedSubOrgs(step, state, ov)
    case 'LIST_USER_TAGS':
      return executeListUserTags(step, state, ov)
    case 'LIST_PRIVATE_KEY_TAGS':
      return executeListPrivateKeyTags(step, state, ov)
    case 'LIST_SUPPORTED_ASSETS':
      return executeListSupportedAssets(step, state, ov)
    default:
      throw new Error(`Unknown step kind: ${(step as StepConfig).kind}`)
  }
}

async function executeCreateSubOrg(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = parentClient()
  const orgName = await getParentOrgName()
  const subOrganizationName = (override?.subOrganizationName as string | undefined) ?? defaultSubOrgName(orgName)

  const defaultParams = {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestParams = (override as any) ?? defaultParams

  try {
    const response = await client.createSubOrganization(requestParams)
    const updatedState = { ...state, subOrgId: response.subOrganizationId, subOrganizationName, rootUserId: response.rootUserIds?.[0] }
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

async function executeCreateWallet(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()

  const defaultParams = {
    organizationId: orgId,
    walletName: 'Demo Wallet',
    accounts: DEFAULT_ETHEREUM_ACCOUNTS,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestParams = (override as any) ?? defaultParams

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

async function executeCreateApiUser(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // Always generate a fresh key pair — the private key must match the public key sent to Turnkey
  // so that subsequent signing steps work. We inject publicKey into the override if present.
  const { privateKey, publicKey } = generateP256KeyPair()

  const defaultParams = {
    organizationId: state.subOrgId!,
    apiOnlyUsers: [
      {
        userName: 'Demo API User',
        userTags: [],
        apiKeys: [{ apiKeyName: 'Demo API Key', publicKey }],
      },
    ],
  }

  let requestParams = defaultParams
  if (override) {
    const ovUsers = (override.apiOnlyUsers as Array<Record<string, unknown>> | undefined) ?? []
    const ovUser = ovUsers[0] ?? {}
    const ovKeys = (ovUser.apiKeys as Array<Record<string, unknown>> | undefined) ?? []
    const ovKey = ovKeys[0] ?? {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestParams = {
      ...defaultParams,
      ...(override as any),
      apiOnlyUsers: [{
        ...defaultParams.apiOnlyUsers[0],
        ...ovUser,
        apiKeys: [{ ...defaultParams.apiOnlyUsers[0].apiKeys[0], ...ovKey, publicKey }],
      }],
    }
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
  params: { type?: string; allowedAddress?: string },
  override?: Record<string, unknown>
): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const { policyName, effect, condition } = getPolicyConfig(params)
  const { allowedAddress } = params

  const defaultParams = {
    organizationId: orgId,
    policyName,
    effect: effect as 'EFFECT_ALLOW' | 'EFFECT_DENY',
    consensus: `approvers.any(user, user.id == '${state.apiUserId ?? ''}')`,
    condition,
    notes: 'Allow all signing activity',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestParams = (override as any) ?? defaultParams

  try {
    const response = await client.createPolicy(requestParams)
    const updatedState = {
      ...state,
      policyId: response.policyId,
      ...(allowedAddress ? { allowedAddress } : {}),
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

async function executeSignTransaction(
  step: StepConfig,
  state: SessionState,
  params: { useAllowedAddress?: boolean; type?: string },
  override?: Record<string, unknown>
): Promise<StepResult> {
  const client = apiUserClient(
    state.apiUserPublicKey!,
    state.apiUserPrivateKey!,
    state.subOrgId!
  )

  if (params.type === 'deploy') {
    const tx = new ethers.Transaction()
    tx.to = null
    // Minimal EVM bytecode — a no-op contract. Replace with your compiled artifact in production.
    tx.data = '0x6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358'
    tx.value = 0n
    tx.gasLimit = (override?.gasLimit ? BigInt(override.gasLimit as number) : 500_000n)
    tx.maxFeePerGas = ethers.parseUnits('50', 'gwei')
    tx.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei')
    tx.nonce = 0
    tx.chainId = override?.chainId ? BigInt(override.chainId as number) : 1n
    tx.type = 2

    try {
      const response = await client.signTransaction({
        organizationId: (override?.organizationId as string | undefined) ?? state.subOrgId!,
        signWith: (override?.signWith as string | undefined) ?? state.walletAddress!,
        unsignedTransaction: tx.unsignedSerialized.slice(2),
        type: 'TRANSACTION_TYPE_ETHEREUM',
      })
      return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
    } catch (error) {
      return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
    }
  }

  if (params.type === 'contract-call') {
    const iface = new ethers.Interface(['function transfer(address,uint256)'])
    const calldata = iface.encodeFunctionData('transfer', [
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      ethers.parseEther('1'),
    ])

    const tx = new ethers.Transaction()
    // Use allowedAddress from state if present (e.g. set by an address-allowlist policy step),
    // otherwise fall back to the DAI token contract on mainnet as a realistic demo target.
    tx.to = (override?.to as string | undefined)
      ?? state.allowedAddress
      ?? '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    tx.data = (override?.data as string | undefined) ?? calldata
    tx.value = 0n
    tx.gasLimit = 100_000n
    tx.maxFeePerGas = ethers.parseUnits('50', 'gwei')
    tx.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei')
    tx.nonce = 0
    tx.chainId = override?.chainId ? BigInt(override.chainId as number) : 1n
    tx.type = 2

    try {
      const response = await client.signTransaction({
        organizationId: (override?.organizationId as string | undefined) ?? state.subOrgId!,
        signWith: (override?.signWith as string | undefined) ?? state.walletAddress!,
        unsignedTransaction: tx.unsignedSerialized.slice(2),
        type: 'TRANSACTION_TYPE_ETHEREUM',
      })
      return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
    } catch (error) {
      return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
    }
  }

  // Standard EIP-1559 transfer (allowlist check demo)
  const useAllowedAddress = params.useAllowedAddress ?? false
  const targetAddress = useAllowedAddress
    ? state.allowedAddress!
    : '0x000000000000000000000000000000000000dEaD'

  const tx = new ethers.Transaction()
  tx.to = (override?.to as string | undefined) ?? targetAddress
  tx.value = ethers.parseEther((override?.value as string | undefined) ?? '0.001')
  tx.gasLimit = 21000n
  tx.maxFeePerGas = ethers.parseUnits('50', 'gwei')
  tx.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei')
  tx.nonce = 0
  tx.chainId = override?.chainId ? BigInt(override.chainId as number) : 1n
  tx.type = 2

  const unsignedTransaction = tx.unsignedSerialized.slice(2)
  const expectedFailure = !useAllowedAddress

  try {
    const response = await client.signTransaction({
      organizationId: (override?.organizationId as string | undefined) ?? state.subOrgId!,
      signWith: (override?.signWith as string | undefined) ?? state.walletAddress!,
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

async function executeSignRawPayload(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const message = 'Hello from the Turnkey API!'
  const defaultPayload = ethers.keccak256(ethers.toUtf8Bytes(message)).slice(2) // hex without 0x

  const client = apiUserClient(
    state.apiUserPublicKey!,
    state.apiUserPrivateKey!,
    state.subOrgId!
  )

  const defaultParams = {
    organizationId: state.subOrgId!,
    signWith: state.walletAddress!,
    payload: defaultPayload,
    encoding: 'PAYLOAD_ENCODING_HEXADECIMAL' as const,
    hashFunction: 'HASH_FUNCTION_NO_OP' as const,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestParams = (override as any) ?? defaultParams

  try {
    const response = await client.signRawPayload(requestParams)
    return {
      success: true,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: state,
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

async function executeGetWhoAmI(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = parentClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: process.env.ORGANIZATION_ID! }
  try {
    const response = await client.getWhoami(params)
    // Capture the root user ID for use in downstream steps (e.g. CREATE_INVITATIONS)
    const updatedState: SessionState = {
      ...state,
      rootUserId: state.rootUserId ?? response.userId,
    }
    return {
      success: true,
      request: buildDisplayRequest(step, state),
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

async function executeListWallets(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getWallets(params)
    return {
      success: true,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: state,
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

async function executeGetWallet(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, walletId: state.walletId! }
  try {
    const response = await client.getWallet(params)
    return {
      success: true,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: state,
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

async function executeListUsers(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getUsers(params)
    return {
      success: true,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: state,
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

async function executeListPolicies(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getPolicies(params)
    return {
      success: true,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: state,
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

async function executeDeletePolicy(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, policyId: state.policyId! }
  try {
    const response = await client.deletePolicy(params)
    const updatedState = { ...state, policyId: undefined }
    return {
      success: true,
      request: buildDisplayRequest(step, state),
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

async function executeCreatePrivateKey(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    privateKeys: [{
      privateKeyName: 'Demo Private Key',
      curve: 'CURVE_SECP256K1',
      addressFormats: ['ADDRESS_FORMAT_ETHEREUM'],
      privateKeyTags: [],
    }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createPrivateKeys(params)
    const updatedState = { ...state, privateKeyId: response.privateKeys?.[0]?.privateKeyId }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeCreateWalletAccounts(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    walletId: state.walletId!,
    accounts: [{
      curve: 'CURVE_SECP256K1',
      pathFormat: 'PATH_FORMAT_BIP32',
      path: "m/44'/60'/0'/0/1",
      addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
    }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createWalletAccounts(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeCreateApiKeys(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const { privateKey: _priv, publicKey } = generateP256KeyPair()
  const defaultParams = {
    organizationId: state.subOrgId!,
    userId: state.apiUserId!,
    apiKeys: [{ apiKeyName: 'Additional API Key', publicKey, curveType: 'API_KEY_CURVE_P256' }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createApiKeys(params)
    const updatedState = { ...state, apiKeyId: response.apiKeyIds?.[0] }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeleteWallets(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    walletIds: [state.walletId!],
    deleteWithoutExport: true,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.deleteWallets(params)
    const updatedState = { ...state, walletId: undefined, walletAddress: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeleteUsers(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, userIds: [state.apiUserId!] }
  try {
    const response = await client.deleteUsers(params)
    const updatedState = { ...state, apiUserId: undefined, apiUserPublicKey: undefined, apiUserPrivateKey: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeUpdateWallet(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    walletId: state.walletId!,
    walletName: 'Demo Wallet (updated)',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.updateWallet(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeUpdatePolicy(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    policyId: state.policyId!,
    policyName: 'Updated Policy',
    policyCondition: "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2' || activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
    policyConsensus: `approvers.any(user, user.id == '${state.apiUserId}')`,
    policyEffect: 'EFFECT_ALLOW' as const,
    policyNotes: '',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.updatePolicy(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeUpdateUser(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    userId: state.apiUserId!,
    userName: 'Demo API User (renamed)',
    userTagIds: [],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.updateUser(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeSignRawPayloads(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const messages = ['Payload 1: Hello from Turnkey', 'Payload 2: Batch signing demo']
  const defaultPayloads = messages.map((msg) => ethers.keccak256(ethers.toUtf8Bytes(msg)).slice(2))
  const client = apiUserClient(state.apiUserPublicKey!, state.apiUserPrivateKey!, state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    signWith: state.walletAddress!,
    payloads: defaultPayloads,
    encoding: 'PAYLOAD_ENCODING_HEXADECIMAL' as const,
    hashFunction: 'HASH_FUNCTION_NO_OP' as const,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.signRawPayloads(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeListWalletAccounts(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, walletId: state.walletId! }
  try {
    const response = await client.getWalletAccounts(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeListActivities(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getActivities(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeListPrivateKeys(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getPrivateKeys(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetUser(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, userId: state.apiUserId! }
  try {
    const response = await client.getUser(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetPolicy(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, policyId: state.policyId! }
  try {
    const response = await client.getPolicy(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetApiKeys(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getApiKeys(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetConfigs(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getOrganizationConfigs(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeCreateUserTag(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const defaultParams = {
    organizationId: orgId,
    userTagName: 'end-user',
    userIds: [],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createUserTag(params)
    const updatedState = { ...state, userTagId: response.userTagId }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeCreatePrivateKeyTag(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const defaultParams = {
    organizationId: orgId,
    privateKeyTagName: 'hot-wallet',
    privateKeyIds: [],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createPrivateKeyTag(params)
    const updatedState = { ...state, privateKeyTagId: response.privateKeyTagId }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeCreatePolicies(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    policies: [{
      policyName: 'Demo Policy (bulk)',
      effect: 'EFFECT_ALLOW' as const,
      consensus: `approvers.any(user, user.id == '${state.apiUserId}')`,
      condition: 'true',
      notes: 'Created via Turnkey API demo',
    }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createPolicies(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeCreateInvitations(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const defaultParams = {
    organizationId: orgId,
    invitations: [{
      receiverUserName: 'Demo User',
      receiverUserEmail: 'demo@example.com',
      receiverUserTags: [],
      accessType: 'ACCESS_TYPE_WEB' as const,
      senderUserId: state.rootUserId!,
    }],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.createInvitations(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeletePrivateKeys(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    privateKeyIds: [state.privateKeyId!],
    deleteWithoutExport: true,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.deletePrivateKeys(params)
    const updatedState = { ...state, privateKeyId: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeleteApiKeys(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    apiKeyIds: [state.apiKeyId!],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.deleteApiKeys(params)
    const updatedState = { ...state, apiKeyId: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeleteUserTags(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    userTagIds: [state.userTagId!],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.deleteUserTags(params)
    const updatedState = { ...state, userTagId: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeletePrivateKeyTags(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    privateKeyTagIds: [state.privateKeyTagId!],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.deletePrivateKeyTags(params)
    const updatedState = { ...state, privateKeyTagId: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeDeletePolicies(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    policyIds: [state.policyId!],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.deletePolicies(params)
    const updatedState = { ...state, policyId: undefined }
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeUpdateRootQuorum(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  const defaultParams = {
    organizationId: state.subOrgId!,
    threshold: 1,
    userIds: [state.apiUserId!],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.updateRootQuorum(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeUpdateOrganizationName(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const defaultParams = {
    organizationId: orgId,
    organizationName: 'My App Wallets',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.updateOrganizationName(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeSetOrgFeature(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const defaultParams = {
    organizationId: orgId,
    name: 'FEATURE_NAME_EMAIL_AUTH',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.setOrganizationFeature(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeRemoveOrgFeature(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const orgId = state.subOrgId ?? process.env.ORGANIZATION_ID!
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  const defaultParams = {
    organizationId: orgId,
    name: 'FEATURE_NAME_EMAIL_AUTH',
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? defaultParams
  try {
    const response = await client.removeOrganizationFeature(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetPrivateKey(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, privateKeyId: state.privateKeyId! }
  try {
    const response = await client.getPrivateKey(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetAuthenticators(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId!, userId: state.apiUserId! }
  try {
    const response = await client.getAuthenticators(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetSubOrgs(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = parentClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: process.env.ORGANIZATION_ID!, filterType: 'EMAIL', filterValue: 'user@example.com' }
  try {
    const response = await client.getSubOrgIds(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeGetVerifiedSubOrgs(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = parentClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: process.env.ORGANIZATION_ID!, filterType: 'EMAIL', filterValue: 'user@example.com' }
  try {
    const response = await client.getVerifiedSubOrgIds(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeListUserTags(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.listUserTags(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeListPrivateKeyTags(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.listPrivateKeyTags(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}

async function executeListSupportedAssets(step: StepConfig, state: SessionState, override?: Record<string, unknown>): Promise<StepResult> {
  const client = subOrgClient(state.subOrgId!)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.listSupportedAssets(params)
    return { success: true, request: buildDisplayRequest(step, state), response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state), response: formatError(error), updatedState: state }
  }
}
