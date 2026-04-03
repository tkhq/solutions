'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { StepConfig } from '@/types/scenario'

// ── Catalog definition ─────────────────────────────────────────────────────

interface CatalogItem {
  id: string
  kind: StepConfig['kind']
  title: string
  description: string
  params?: Record<string, unknown>
  category: 'activity' | 'query'
  apiCall: string
  docs: string
  requires: string[]
  provides: string[]
}

const CATALOG: CatalogItem[] = [
  // ── Create ──────────────────────────────────────────────────────
  {
    id: 'create-sub-org',
    kind: 'CREATE_SUB_ORG',
    title: 'Create Sub-Organization',
    description: 'Create an isolated org with its own wallets, users, and policies.',
    category: 'activity',
    apiCall: 'create_sub_organization',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-sub-organization',
    requires: [],
    provides: ['subOrgId'],
  },
  {
    id: 'create-wallet',
    kind: 'CREATE_WALLET',
    title: 'Create Wallet',
    description: 'Create an Ethereum HD wallet. The private key never leaves the enclave.',
    category: 'activity',
    apiCall: 'create_wallet',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-wallet',
    requires: ['subOrgId'],
    provides: ['walletId', 'walletAddress'],
  },
  {
    id: 'create-wallet-accounts',
    kind: 'CREATE_WALLET_ACCOUNTS',
    title: 'Create Wallet Accounts',
    description: 'Derive an additional Ethereum account (index 1) on the existing wallet.',
    category: 'activity',
    apiCall: 'create_wallet_accounts',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-wallet-accounts',
    requires: ['subOrgId', 'walletId'],
    provides: [],
  },
  {
    id: 'create-private-key',
    kind: 'CREATE_PRIVATE_KEY',
    title: 'Create Private Key',
    description: 'Create a standalone SECP256K1 private key (not HD wallet-derived).',
    category: 'activity',
    apiCall: 'create_private_keys',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-private-keys',
    requires: ['subOrgId'],
    provides: ['privateKeyId'],
  },
  {
    id: 'create-api-user',
    kind: 'CREATE_API_USER',
    title: 'Create API User',
    description: 'Create a non-human API user with an ephemeral P256 key pair for programmatic signing.',
    category: 'activity',
    apiCall: 'create_api_only_users',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-api-only-users',
    requires: ['subOrgId'],
    provides: ['apiUserId', 'apiUserPublicKey', 'apiUserPrivateKey'],
  },
  {
    id: 'create-api-keys',
    kind: 'CREATE_API_KEYS',
    title: 'Create API Keys',
    description: 'Add an additional API key to the existing API user.',
    category: 'activity',
    apiCall: 'create_api_keys',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-api-keys',
    requires: ['subOrgId', 'apiUserId'],
    provides: [],
  },
  {
    id: 'create-invitations',
    kind: 'CREATE_INVITATIONS',
    title: 'Create Invitations',
    description: 'Invite a user to join an existing organization by email.',
    category: 'activity',
    apiCall: 'create_invitations',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-invitations',
    requires: ['subOrgId', 'apiUserId'],
    provides: [],
  },
  // ── Policies ────────────────────────────────────────────────────
  {
    id: 'create-policy-allowlist',
    kind: 'CREATE_POLICY',
    title: 'Policy: Address Allowlist',
    description: "Allow signing only to a specific Ethereum address. Condition: eth.tx.to == '<address>'",
    params: { allowedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
    category: 'activity',
    apiCall: 'create_policy',
    docs: 'https://docs.turnkey.com/concepts/policies/examples/access-control',
    requires: ['subOrgId', 'apiUserId'],
    provides: ['policyId', 'allowedAddress'],
  },
  {
    id: 'create-policy-permissive',
    kind: 'CREATE_POLICY',
    title: 'Policy: Allow All (Permissive)',
    description: 'Grant unrestricted signing permission. Condition: true',
    params: { type: 'permissive' },
    category: 'activity',
    apiCall: 'create_policy',
    docs: 'https://docs.turnkey.com/concepts/policies/examples/access-control',
    requires: ['subOrgId', 'apiUserId'],
    provides: ['policyId'],
  },
  {
    id: 'create-policy-sign-only',
    kind: 'CREATE_POLICY',
    title: 'Policy: Sign Operations Only',
    description: 'Restrict the API user to sign_transaction and sign_raw_payload only.',
    params: { type: 'sign-only' },
    category: 'activity',
    apiCall: 'create_policy',
    docs: 'https://docs.turnkey.com/concepts/policies/examples/access-control',
    requires: ['subOrgId', 'apiUserId'],
    provides: ['policyId'],
  },
  {
    id: 'create-policy-allow-wallet-creation',
    kind: 'CREATE_POLICY',
    title: 'Policy: Allow Wallet Creation',
    description: "Allow the API user to create wallets. Condition: activity.resource == 'WALLET' && activity.action == 'CREATE'",
    params: { type: 'allow-wallet-creation' },
    category: 'activity',
    apiCall: 'create_policy',
    docs: 'https://docs.turnkey.com/concepts/policies/examples/access-control',
    requires: ['subOrgId', 'apiUserId'],
    provides: ['policyId'],
  },
  {
    id: 'create-policy-deny-all-deletes',
    kind: 'CREATE_POLICY',
    title: 'Policy: Deny All Deletions',
    description: "Block any delete activity. Condition: activity.action == 'DELETE' (effect: DENY)",
    params: { type: 'deny-all-deletes' },
    category: 'activity',
    apiCall: 'create_policy',
    docs: 'https://docs.turnkey.com/concepts/policies/examples/access-control',
    requires: ['subOrgId', 'apiUserId'],
    provides: ['policyId'],
  },
  {
    id: 'create-policy-allow-auth',
    kind: 'CREATE_POLICY',
    title: 'Policy: Allow Auth Activity',
    description: "Permit the API user to initiate authentication. Condition: activity.resource == 'AUTH' && activity.action == 'CREATE'",
    params: { type: 'allow-auth' },
    category: 'activity',
    apiCall: 'create_policy',
    docs: 'https://docs.turnkey.com/concepts/policies/examples/access-control',
    requires: ['subOrgId', 'apiUserId'],
    provides: ['policyId'],
  },
  {
    id: 'create-user-tag',
    kind: 'CREATE_USER_TAG',
    title: 'Create User Tag',
    description: 'Create a tag that can be applied to users for grouping and policy targeting.',
    category: 'activity',
    apiCall: 'create_user_tag',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-user-tag',
    requires: ['subOrgId'],
    provides: ['userTagId'],
  },
  {
    id: 'create-private-key-tag',
    kind: 'CREATE_PRIVATE_KEY_TAG',
    title: 'Create Private Key Tag',
    description: 'Create a tag for grouping private keys, useful for policy enforcement.',
    category: 'activity',
    apiCall: 'create_private_key_tag',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-private-key-tag',
    requires: ['subOrgId'],
    provides: ['privateKeyTagId'],
  },
  {
    id: 'create-policies',
    kind: 'CREATE_POLICIES',
    title: 'Create Policies (Bulk)',
    description: 'Create multiple policies in a single activity.',
    category: 'activity',
    apiCall: 'create_policies',
    docs: 'https://docs.turnkey.com/api-reference/activities/create-policies',
    requires: ['subOrgId'],
    provides: ['policyId'],
  },
  // ── Sign ────────────────────────────────────────────────────────
  {
    id: 'sign-tx-allowed',
    kind: 'SIGN_TRANSACTION',
    title: 'Sign Transaction (Allowed Address)',
    description: 'Sign an EIP-1559 transaction to the allowlisted address — policy permits it.',
    params: { useAllowedAddress: true },
    category: 'activity',
    apiCall: 'sign_transaction',
    docs: 'https://docs.turnkey.com/api-reference/activities/sign-transaction',
    requires: ['subOrgId', 'walletAddress', 'apiUserPublicKey', 'policyId', 'allowedAddress'],
    provides: [],
  },
  {
    id: 'sign-tx-blocked',
    kind: 'SIGN_TRANSACTION',
    title: 'Sign Transaction (Blocked Address)',
    description: 'Attempt to sign to a non-allowlisted address — policy rejects it (expected failure).',
    params: { useAllowedAddress: false },
    category: 'activity',
    apiCall: 'sign_transaction',
    docs: 'https://docs.turnkey.com/api-reference/activities/sign-transaction',
    requires: ['subOrgId', 'walletAddress', 'apiUserPublicKey', 'policyId'],
    provides: [],
  },
  {
    id: 'sign-raw-payload',
    kind: 'SIGN_RAW_PAYLOAD',
    title: 'Sign Raw Payload',
    description: 'Sign an arbitrary message hash. Returns raw ECDSA components (r, s, v).',
    category: 'activity',
    apiCall: 'sign_raw_payload',
    docs: 'https://docs.turnkey.com/api-reference/activities/sign-raw-payload',
    requires: ['subOrgId', 'walletAddress', 'apiUserPublicKey', 'policyId'],
    provides: [],
  },
  {
    id: 'sign-raw-payloads',
    kind: 'SIGN_RAW_PAYLOADS',
    title: 'Sign Raw Payloads (Batch)',
    description: 'Sign multiple message hashes in a single request.',
    category: 'activity',
    apiCall: 'sign_raw_payloads',
    docs: 'https://docs.turnkey.com/api-reference/activities/sign-raw-payloads',
    requires: ['subOrgId', 'walletAddress', 'apiUserPublicKey', 'policyId'],
    provides: [],
  },
  {
    id: 'update-root-quorum',
    kind: 'UPDATE_ROOT_QUORUM',
    title: 'Update Root Quorum',
    description: 'Change the root quorum threshold and user set for the sub-organization.',
    category: 'activity',
    apiCall: 'update_root_quorum',
    docs: 'https://docs.turnkey.com/api-reference/activities/update-root-quorum',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'update-organization-name',
    kind: 'UPDATE_ORGANIZATION_NAME',
    title: 'Update Organization Name',
    description: 'Rename the sub-organization.',
    category: 'activity',
    apiCall: 'update_organization_name',
    docs: 'https://docs.turnkey.com/api-reference/activities/update-organization-name',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'set-org-feature',
    kind: 'SET_ORG_FEATURE',
    title: 'Set Organization Feature',
    description: 'Enable a feature flag on the sub-organization.',
    category: 'activity',
    apiCall: 'set_organization_feature',
    docs: 'https://docs.turnkey.com/api-reference/activities/set-organization-feature',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'remove-org-feature',
    kind: 'REMOVE_ORG_FEATURE',
    title: 'Remove Organization Feature',
    description: 'Disable a feature flag on the sub-organization.',
    category: 'activity',
    apiCall: 'remove_organization_feature',
    docs: 'https://docs.turnkey.com/api-reference/activities/remove-organization-feature',
    requires: ['subOrgId'],
    provides: [],
  },
  // ── Update ──────────────────────────────────────────────────────
  {
    id: 'update-wallet',
    kind: 'UPDATE_WALLET',
    title: 'Update Wallet',
    description: 'Rename the wallet.',
    category: 'activity',
    apiCall: 'update_wallet',
    docs: 'https://docs.turnkey.com/api-reference/activities/update-wallet',
    requires: ['subOrgId', 'walletId'],
    provides: [],
  },
  {
    id: 'update-policy',
    kind: 'UPDATE_POLICY',
    title: 'Update Policy',
    description: 'Replace the policy condition with a sign-only restriction.',
    category: 'activity',
    apiCall: 'update_policy',
    docs: 'https://docs.turnkey.com/api-reference/activities/update-policy',
    requires: ['subOrgId', 'policyId', 'apiUserId'],
    provides: [],
  },
  {
    id: 'update-user',
    kind: 'UPDATE_USER',
    title: 'Update User',
    description: 'Rename the API user.',
    category: 'activity',
    apiCall: 'update_user',
    docs: 'https://docs.turnkey.com/api-reference/activities/update-user',
    requires: ['subOrgId', 'apiUserId'],
    provides: [],
  },
  // ── Delete ──────────────────────────────────────────────────────
  {
    id: 'delete-private-keys',
    kind: 'DELETE_PRIVATE_KEYS',
    title: 'Delete Private Keys',
    description: 'Permanently delete one or more private keys from the sub-organization.',
    category: 'activity',
    apiCall: 'delete_private_keys',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-private-keys',
    requires: ['subOrgId', 'privateKeyId'],
    provides: [],
  },
  {
    id: 'delete-api-keys',
    kind: 'DELETE_API_KEYS',
    title: 'Delete API Keys',
    description: 'Delete one or more API keys from the sub-organization.',
    category: 'activity',
    apiCall: 'delete_api_keys',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-api-keys',
    requires: ['subOrgId', 'apiKeyId'],
    provides: [],
  },
  {
    id: 'delete-user-tags',
    kind: 'DELETE_USER_TAGS',
    title: 'Delete User Tags',
    description: 'Delete one or more user tags from the sub-organization.',
    category: 'activity',
    apiCall: 'delete_user_tags',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-user-tags',
    requires: ['subOrgId', 'userTagId'],
    provides: [],
  },
  {
    id: 'delete-private-key-tags',
    kind: 'DELETE_PRIVATE_KEY_TAGS',
    title: 'Delete Private Key Tags',
    description: 'Delete one or more private key tags from the sub-organization.',
    category: 'activity',
    apiCall: 'delete_private_key_tags',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-private-key-tags',
    requires: ['subOrgId', 'privateKeyTagId'],
    provides: [],
  },
  {
    id: 'delete-policies',
    kind: 'DELETE_POLICIES',
    title: 'Delete Policies (Bulk)',
    description: 'Delete multiple policies in a single activity.',
    category: 'activity',
    apiCall: 'delete_policies',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-policies',
    requires: ['subOrgId', 'policyId'],
    provides: [],
  },
  {
    id: 'delete-policy',
    kind: 'DELETE_POLICY',
    title: 'Delete Policy',
    description: 'Remove a policy. Subsequent signing by the API user will be denied.',
    category: 'activity',
    apiCall: 'delete_policy',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-policy',
    requires: ['subOrgId', 'policyId'],
    provides: [],
  },
  {
    id: 'delete-wallets',
    kind: 'DELETE_WALLETS',
    title: 'Delete Wallets',
    description: 'Permanently delete the wallet and all its accounts (deleteWithoutExport: true).',
    category: 'activity',
    apiCall: 'delete_wallets',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-wallets',
    requires: ['subOrgId', 'walletId'],
    provides: [],
  },
  {
    id: 'delete-users',
    kind: 'DELETE_USERS',
    title: 'Delete Users',
    description: 'Delete the API user from the sub-org.',
    category: 'activity',
    apiCall: 'delete_users',
    docs: 'https://docs.turnkey.com/api-reference/activities/delete-users',
    requires: ['subOrgId', 'apiUserId'],
    provides: [],
  },
  // ── Queries ─────────────────────────────────────────────────────
  {
    id: 'get-who-am-i',
    kind: 'GET_WHO_AM_I',
    title: 'Who Am I',
    description: "Returns the calling user's identity — org ID, user ID, and username.",
    category: 'query',
    apiCall: 'get_whoami',
    docs: 'https://docs.turnkey.com/api-reference/queries/who-am-i',
    requires: [],
    provides: [],
  },
  {
    id: 'list-wallets',
    kind: 'LIST_WALLETS',
    title: 'List Wallets',
    description: 'Fetch all wallets in the sub-org.',
    category: 'query',
    apiCall: 'get_wallets',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-wallets',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'get-wallet',
    kind: 'GET_WALLET',
    title: 'Get Wallet',
    description: 'Fetch metadata for the wallet created in a previous step.',
    category: 'query',
    apiCall: 'get_wallet',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-wallet',
    requires: ['subOrgId', 'walletId'],
    provides: [],
  },
  {
    id: 'list-wallet-accounts',
    kind: 'LIST_WALLET_ACCOUNTS',
    title: 'List Wallet Accounts',
    description: 'Fetch all accounts (addresses) derived from the wallet.',
    category: 'query',
    apiCall: 'get_wallet_accounts',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-wallets-accounts',
    requires: ['subOrgId', 'walletId'],
    provides: [],
  },
  {
    id: 'list-private-keys',
    kind: 'LIST_PRIVATE_KEYS',
    title: 'List Private Keys',
    description: 'Return all standalone private keys in the sub-org.',
    category: 'query',
    apiCall: 'get_private_keys',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-private-keys',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'list-users',
    kind: 'LIST_USERS',
    title: 'List Users',
    description: 'Return all users in the sub-org.',
    category: 'query',
    apiCall: 'get_users',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-users',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'get-user',
    kind: 'GET_USER',
    title: 'Get User',
    description: 'Fetch details for the API user created in a previous step.',
    category: 'query',
    apiCall: 'get_user',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-user',
    requires: ['subOrgId', 'apiUserId'],
    provides: [],
  },
  {
    id: 'get-api-keys',
    kind: 'GET_API_KEYS',
    title: 'Get API Keys',
    description: 'Return all API keys registered in the sub-org.',
    category: 'query',
    apiCall: 'get_api_keys',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-api-keys',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'list-policies',
    kind: 'LIST_POLICIES',
    title: 'List Policies',
    description: 'Return all policies in the sub-org.',
    category: 'query',
    apiCall: 'get_policies',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-policies',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'get-policy',
    kind: 'GET_POLICY',
    title: 'Get Policy',
    description: 'Fetch the full details of the policy created in a previous step.',
    category: 'query',
    apiCall: 'get_policy',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-policy',
    requires: ['subOrgId', 'policyId'],
    provides: [],
  },
  {
    id: 'list-activities',
    kind: 'LIST_ACTIVITIES',
    title: 'List Activities',
    description: 'Return recent activities (signed requests) in the sub-org.',
    category: 'query',
    apiCall: 'get_activities',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-activities',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'get-configs',
    kind: 'GET_CONFIGS',
    title: 'Get Org Configs',
    description: 'Fetch the configuration and feature flags for the sub-organization.',
    category: 'query',
    apiCall: 'get_configs',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-configs',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'get-private-key',
    kind: 'GET_PRIVATE_KEY',
    title: 'Get Private Key',
    description: 'Fetch details of a specific private key.',
    category: 'query',
    apiCall: 'get_private_key',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-private-key',
    requires: ['subOrgId', 'privateKeyId'],
    provides: [],
  },
  {
    id: 'get-authenticators',
    kind: 'GET_AUTHENTICATORS',
    title: 'Get Authenticators',
    description: 'List all authenticators registered for a user.',
    category: 'query',
    apiCall: 'get_authenticators',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-authenticators',
    requires: ['subOrgId', 'apiUserId'],
    provides: [],
  },
  {
    id: 'get-sub-orgs',
    kind: 'GET_SUB_ORGS',
    title: 'Get Sub-Organizations',
    description: 'List all sub-organization IDs under the parent organization.',
    category: 'query',
    apiCall: 'get_sub_org_ids',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-sub-organizations',
    requires: [],
    provides: [],
  },
  {
    id: 'get-verified-sub-orgs',
    kind: 'GET_VERIFIED_SUB_ORGS',
    title: 'Get Verified Sub-Organizations',
    description: 'List verified sub-organization IDs under the parent organization.',
    category: 'query',
    apiCall: 'get_verified_sub_org_ids',
    docs: 'https://docs.turnkey.com/api-reference/queries/get-verified-sub-organizations',
    requires: [],
    provides: [],
  },
  {
    id: 'list-user-tags',
    kind: 'LIST_USER_TAGS',
    title: 'List User Tags',
    description: 'Return all user tags in the sub-organization.',
    category: 'query',
    apiCall: 'list_user_tags',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-user-tags',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'list-private-key-tags',
    kind: 'LIST_PRIVATE_KEY_TAGS',
    title: 'List Private Key Tags',
    description: 'Return all private key tags in the sub-organization.',
    category: 'query',
    apiCall: 'list_private_key_tags',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-private-key-tags',
    requires: ['subOrgId'],
    provides: [],
  },
  {
    id: 'list-supported-assets',
    kind: 'LIST_SUPPORTED_ASSETS',
    title: 'List Supported Assets',
    description: 'Return all supported assets and chains.',
    category: 'query',
    apiCall: 'list_supported_assets',
    docs: 'https://docs.turnkey.com/api-reference/queries/list-supported-assets',
    requires: ['subOrgId'],
    provides: [],
  },
]

const ACTIVITIES = CATALOG.filter((c) => c.category === 'activity')
const QUERIES = CATALOG.filter((c) => c.category === 'query')

// State keys that each catalog item provides, accumulated in order
function computeAvailableState(steps: CatalogItem[]): Set<string> {
  const available = new Set<string>()
  for (const step of steps) {
    for (const p of step.provides) available.add(p)
  }
  return available
}

function isAvailable(item: CatalogItem, currentSteps: CatalogItem[]): boolean {
  const available = computeAvailableState(currentSteps)
  return item.requires.every((r) => available.has(r))
}

// ── Build page ─────────────────────────────────────────────────────────────

export default function BuildPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flow = (searchParams.get('flow') ?? 'sub-org') as 'parent' | 'sub-org'
  const flowLabel = flow === 'parent' ? 'Parent Org' : 'Sub-Org'
  const [selectedSteps, setSelectedSteps] = useState<CatalogItem[]>([])

  const addStep = (item: CatalogItem) => {
    setSelectedSteps((prev) => [...prev, item])
  }

  const removeStep = (index: number) => {
    setSelectedSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    const next = [...selectedSteps]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setSelectedSteps(next)
  }

  const launch = () => {
    const steps: StepConfig[] = selectedSteps.map((item) => ({
      kind: item.kind,
      title: item.title,
      description: item.description,
      params: item.params,
    }))
    sessionStorage.setItem(`custom-setup-${flow}`, JSON.stringify(steps))
    router.push(`/setup/custom/${flow}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-black.svg" alt="Turnkey" height={20} className="dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-white.svg" alt="Turnkey" height={20} className="hidden dark:block" />
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-6"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Setup
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Custom {flowLabel} Setup</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Pick operations from the catalog to compose a custom setup. Steps run in order and share session state between them.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-8 items-start">
        {/* Left: Catalog */}
        <div>
          <CatalogSection title="Activities" items={ACTIVITIES} selectedSteps={selectedSteps} onAdd={addStep} />
          <div className="mt-6">
            <CatalogSection title="Queries" items={QUERIES} selectedSteps={selectedSteps} onAdd={addStep} />
          </div>
        </div>

        {/* Right: Builder */}
        <div className="sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Your Scenario
              {selectedSteps.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                  {selectedSteps.length} step{selectedSteps.length !== 1 ? 's' : ''}
                </span>
              )}
            </h2>
            {selectedSteps.length > 0 && (
              <button
                onClick={() => setSelectedSteps([])}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {selectedSteps.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-10 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-600">
                Add steps from the catalog to build your scenario.
              </p>
              <p className="text-xs text-gray-300 dark:text-gray-700 mt-1">
                Start with <span className="font-medium">Create Sub-Organization</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedSteps.map((item, i) => (
                <div
                  key={`${item.id}-${i}`}
                  className="flex items-start gap-3 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-950"
                >
                  <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{item.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">{item.apiCall}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveStep(i, -1)}
                      disabled={i === 0}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStep(i, 1)}
                      disabled={i === selectedSteps.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeStep(i)}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={launch}
            disabled={selectedSteps.length === 0}
            className="mt-5 w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {selectedSteps.length === 0 ? 'Add steps to launch' : `Launch ${flowLabel} Setup (${selectedSteps.length} steps) →`}
          </button>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-900 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-black.svg" alt="Secured by Turnkey" height={18} className="dark:hidden opacity-40" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/secured-by-white.svg" alt="Secured by Turnkey" height={18} className="hidden dark:block opacity-30" />
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CatalogSection({
  title,
  items,
  selectedSteps,
  onAdd,
}: {
  title: string
  items: CatalogItem[]
  selectedSteps: CatalogItem[]
  onAdd: (item: CatalogItem) => void
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const available = isAvailable(item, selectedSteps)
          return (
            <div
              key={item.id}
              className={`border rounded-lg p-3 transition-colors ${
                available
                  ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950'
                  : 'border-gray-100 dark:border-gray-900 bg-gray-50 dark:bg-gray-950/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium leading-snug ${available ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.title}
                    </span>
                    <a
                      href={item.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-px rounded text-[10px] hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                      {item.apiCall} ↗
                    </a>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
                  {item.requires.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">needs:</span>
                      {item.requires.map((r) => (
                        <span
                          key={r}
                          className={`text-[10px] px-1 py-px rounded font-mono ${
                            computeAvailableState(selectedSteps).has(r)
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => available && onAdd(item)}
                  disabled={!available}
                  className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                >
                  Add
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
