import type { PolicyPreset } from "@/types/policy"

export const policyPresets: PolicyPreset[] = [
  {
    id: "eth-allowlist-address",
    name: "Ethereum: Allow Single Address",
    description: "Allow a user to sign Ethereum transactions to a specific address",
    category: "ethereum",
    docUrl: "https://docs.turnkey.com/concepts/policies/examples/ethereum",
    config: {
      policyName: "Allow ETH transactions to specific address",
      effect: "EFFECT_ALLOW",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      condition: { chain: "ethereum", ethereum: [{ field: "to", operator: "==", value: "<ALLOWED_ADDRESS>" }] },
      notes: "Replace <USER_ID> and <ALLOWED_ADDRESS> with actual values",
    },
  },
  {
    id: "eth-value-limit",
    name: "Ethereum: Value Limit",
    description: "Allow transactions up to a maximum value (in wei)",
    category: "ethereum",
    docUrl: "https://docs.turnkey.com/concepts/policies/examples/ethereum",
    config: {
      policyName: "Allow ETH transactions under value limit",
      effect: "EFFECT_ALLOW",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      condition: { chain: "ethereum", ethereum: [{ field: "value", operator: "<=", value: "1000000000000000000" }] },
      notes: "Allows transactions up to 1 ETH (1e18 wei)",
    },
  },
  {
    id: "eth-chain-specific",
    name: "Ethereum: Specific Chain Only",
    description: "Restrict transactions to a specific chain (e.g., mainnet)",
    category: "ethereum",
    docUrl: "https://docs.turnkey.com/concepts/policies/examples/ethereum",
    config: {
      policyName: "Allow ETH mainnet only",
      effect: "EFFECT_ALLOW",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      condition: { chain: "ethereum", ethereum: [{ field: "chain_id", operator: "==", value: "1" }] },
      notes: "Chain ID 1 = Ethereum Mainnet",
    },
  },
  {
    id: "sol-single-transfer",
    name: "Solana: Single Transfer to Address",
    description: "Allow single SOL transfer to a specific address",
    category: "solana",
    docUrl: "https://docs.turnkey.com/concepts/policies/examples/solana",
    config: {
      policyName: "Allow single SOL transfer to address",
      effect: "EFFECT_ALLOW",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      condition: {
        chain: "solana",
        solana: {
          instructionCount: { operator: "==", value: 1 },
          transferCount: { operator: "==", value: 1 },
          conditions: [{ type: "transfers", quantifier: "all", field: "to", operator: "==", value: "<ALLOWED_ADDRESS>" }],
        },
      },
      notes: "Most restrictive - only allows single transfer transactions",
    },
  },
  {
    id: "sol-allowlist",
    name: "Solana: Allowlist Transfers",
    description: "Allow transfers only to allowlisted addresses",
    category: "solana",
    docUrl: "https://docs.turnkey.com/concepts/policies/examples/solana",
    config: {
      policyName: "Allow SOL transfers to allowlist",
      effect: "EFFECT_ALLOW",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      condition: {
        chain: "solana",
        solana: { conditions: [{ type: "transfers", quantifier: "all", field: "to", operator: "==", value: "<ALLOWED_ADDRESS>" }] },
      },
      notes: "All transfers must go to the allowed address",
    },
  },
  {
    id: "tron-trx-transfer",
    name: "Tron: TRX Transfer",
    description: "Allow TRX transfers to a specific address",
    category: "tron",
    docUrl: "https://docs.turnkey.com/concepts/policies/examples/tron",
    config: {
      policyName: "Allow TRX transfer",
      effect: "EFFECT_ALLOW",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      condition: {
        chain: "tron",
        tron: [
          { contractType: "TransferContract", operator: "==", value: "" },
          { field: "to_address", operator: "==", value: "<ALLOWED_ADDRESS>" },
        ],
      },
      notes: "Allow TRX transfers only to specified address",
    },
  },
  {
    id: "deny-all",
    name: "General: Deny All",
    description: "Explicitly deny all actions for a user",
    category: "general",
    docUrl: "https://docs.turnkey.com/concepts/policies/overview",
    config: {
      policyName: "Deny all actions",
      effect: "EFFECT_DENY",
      consensus: { operator: "any", users: [{ id: "1", userId: "<USER_ID>" }] },
      notes: "Explicitly denies all actions for the specified user",
    },
  },
  {
    id: "multi-user-consensus",
    name: "General: Multi-User Approval",
    description: "Require approval from multiple users",
    category: "general",
    docUrl: "https://docs.turnkey.com/concepts/policies/overview#consensus",
    config: {
      policyName: "Require multi-user approval",
      effect: "EFFECT_ALLOW",
      consensus: {
        operator: "count",
        users: [
          { id: "1", userId: "<USER_ID_1>" },
          { id: "2", userId: "<USER_ID_2>" },
          { id: "3", userId: "<USER_ID_3>" },
        ],
        countThreshold: 2,
      },
      notes: "Requires at least 2 of 3 users to approve",
    },
  },
]

export function getPresetsByCategory(category: string): PolicyPreset[] {
  if (category === "all") return policyPresets
  return policyPresets.filter((p) => p.category === category)
}

export function getPresetById(id: string): PolicyPreset | undefined {
  return policyPresets.find((p) => p.id === id)
}
