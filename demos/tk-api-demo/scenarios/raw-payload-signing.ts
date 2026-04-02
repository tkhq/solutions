import type { Scenario } from '../src/types/scenario'

export const scenario: Scenario = {
  id: 'raw-payload-signing',
  name: 'Raw Payload Signing',
  description:
    'Create a sub-org, wallet, and API user, then sign an arbitrary message payload using Turnkey\'s raw signing API — no transaction structure required.',
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
        'Creates an Ethereum HD wallet inside the sub-org. The private key is generated and stored inside Turnkey\'s secure enclave and never leaves — even Turnkey cannot access it directly.',
    },
    {
      kind: 'CREATE_API_USER',
      title: 'Create API User',
      description:
        'Creates a non-human API user within the sub-org. This represents an automated service or backend that will sign payloads programmatically. A fresh P256 key pair is generated for this user.',
    },
    {
      kind: 'CREATE_POLICY',
      title: 'Create Permissive Signing Policy',
      description:
        'Creates a policy that grants the API user permission to sign any payload. The condition is set to \'true\', which matches all signing requests — no address or transaction restrictions apply.',
      params: { type: 'permissive' },
    },
    {
      kind: 'SIGN_RAW_PAYLOAD',
      title: 'Sign Raw Payload',
      description:
        'Signs an arbitrary message hash using the wallet\'s private key. Turnkey accepts any hex-encoded payload and returns the raw ECDSA signature components (r, s, v). No blockchain transaction is constructed.',
    },
  ],
}
