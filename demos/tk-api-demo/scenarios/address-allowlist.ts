import type { Scenario } from '../src/types/scenario'

export const scenario: Scenario = {
  id: 'address-allowlist',
  name: 'Address Allowlist Policy',
  description:
    'A complete lifecycle demo: create a sub-organization, provision a wallet and an API user, then enforce a signing policy that restricts transactions to a single allowed address.',
  steps: [
    {
      kind: 'CREATE_SUB_ORG',
      title: 'Create Sub-Organization',
      description:
        'Each customer or end-user maps to a sub-organization in Turnkey. This creates an isolated environment with its own wallets, users, and policies — all governed independently.',
    },
    {
      kind: 'CREATE_WALLET',
      title: 'Create Wallet',
      description:
        'Creates an Ethereum HD wallet inside the sub-org. The private key is generated inside Turnkey\'s secure enclave and never leaves — even Turnkey cannot access it directly.',
    },
    {
      kind: 'CREATE_API_USER',
      title: 'Create API User',
      description:
        'Creates a non-human API user within the sub-org. This represents an automated service or backend that will sign transactions programmatically. A fresh P256 key pair is generated for this user.',
    },
    {
      kind: 'CREATE_POLICY',
      title: 'Create Address Allowlist Policy',
      description:
        'Creates a policy that permits the API user to sign transactions only when the destination address matches the allowlisted address. Any other destination will be denied by the policy engine.',
      params: {
        allowedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      },
    },
    {
      kind: 'SIGN_TRANSACTION',
      title: 'Sign to Allowed Address',
      description:
        'The API user requests a signature for a transaction sent to the allowlisted address. The policy condition is satisfied — signing succeeds.',
      params: { useAllowedAddress: true },
    },
    {
      kind: 'SIGN_TRANSACTION',
      title: 'Sign to Blocked Address',
      description:
        'The API user requests a signature for a transaction sent to a different address. The policy condition is not met — Turnkey rejects the request before any signing occurs.',
      params: { useAllowedAddress: false },
    },
  ],
}
