import type { Scenario } from '../src/types/scenario'

export const scenario: Scenario = {
  id: 'wallet-inspection',
  name: 'Wallet Inspection',
  description:
    'Create a sub-organization and wallet, then explore Turnkey\'s read API — listing wallets, fetching wallet details, and listing the users in the org.',
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
      kind: 'LIST_WALLETS',
      title: 'List Wallets',
      description:
        'Queries all wallets in the sub-organization. This is a read-only call — no activity is created. Useful for surfacing wallet inventory to users or building dashboard UIs.',
    },
    {
      kind: 'GET_WALLET',
      title: 'Get Wallet',
      description:
        'Fetches detailed metadata for the specific wallet created in step 2, including its name, accounts, and configuration. Shows how to retrieve a single resource by ID.',
    },
    {
      kind: 'LIST_USERS',
      title: 'List Users',
      description:
        'Returns all users in the sub-org — including the root admin added at creation time. Demonstrates the user management query API.',
    },
  ],
}
