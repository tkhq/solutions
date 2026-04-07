# Policy Builder

## Two-layer model

The policy system uses two distinct representations:

**Layer 1 — `PolicyConfig`** (`src/types/policy.ts`): Structured TypeScript objects that the visual builder works with. Consensus rules, chain conditions, and activity restrictions are each typed sub-objects. The UI reads and writes this format.

**Layer 2 — `TurnkeyPolicy`** (`src/types/policy.ts`): The wire format the API accepts. The `consensus` and `condition` fields are CEL expression strings rather than objects. Nothing outside `policy-builder.ts` should construct this manually.

The compilation step is `buildPolicy(config: PolicyConfig): TurnkeyPolicy` in `src/lib/policy-builder.ts`. It calls `buildConsensusExpression()` and `buildConditionExpression()` internally, omitting fields that compile to empty strings.

---

## Consensus operators

The `ConsensusConfig.operator` field selects which CEL template is generated for the `consensus` field.

| Operator | What it requires | Generated expression |
|----------|-----------------|----------------------|
| `any` | At least one of the listed users approves | `approvers.any(user, user.id == 'uid1' \|\| user.id == 'uid2')` |
| `all` | Every listed user approves | `approvers.all(user, user.id == 'uid1' \|\| user.id == 'uid2')` |
| `count` | A numeric threshold of the listed users approve | `approvers.count(user, user.id == 'uid1') >= 2` |
| `tag_any` | At least one user bearing the specified tag approves (per tag) | `approvers.any(user, user.tags.contains('tagId'))` |
| `tag_count` | At least N users bearing the tag approve | `approvers.filter(user, user.tags.contains('tagId')).count() >= 2` |
| `credential` | Approval is gated on an authenticator credential attribute | `credentials.any(credential, credential.id == 'credId')` |

For `any`, `all`, and `count` with an empty `users` list, the `count` operator falls back to `approvers.count() >= threshold` and the others produce an empty string (field is omitted).

---

## Condition config

`ConditionConfig` (`src/types/policy.ts`) is the structured form of the policy `condition` field. Independent sections are compiled and joined by `conditionJoin` (defaults to `&&`).

**`chain`** — selects which chain-specific sub-builder runs. At most one chain section should be set per config:
- `"ethereum"` → reads `config.ethereum[]` of `EthereumCondition`, generates `eth.tx.<field> <op> <value>`
- `"solana"` → reads `config.solana` (`SolanaConditionConfig`), generates `solana.tx.transfers.*`, `solana.tx.instructions.*`
- `"tron"` → reads `config.tron[]` of `TronCondition`, generates `tron.tx.contract[0].*`
- `"bitcoin"` → reads `config.bitcoin.outputConditions[]`, generates `bitcoin.tx.outputs.<quantifier>(output, output.value <op> <value>)`

**`activity`** — chain-agnostic. Array of `ActivityCondition` on `type`, `resource`, or `action` fields. Generates `activity.<field> <op> '<value>'`. Can be combined with a chain section.

**`signingResource`** — chain-agnostic. Array of `SigningResourceCondition` on `wallet`, `wallet_account`, or `private_key` fields. Boolean fields (`imported`, `exported`) are rendered without quotes.

**`conditionJoin`** — `"&&"` (default) or `"||"`. Applied uniformly across all section parts.

**`rawCondition`** — escape hatch. When set, all builder logic is bypassed and the string is passed to the API verbatim. Use for condition patterns the structured builders don't cover.

Example — address allowlist with activity restriction:
```ts
{
  conditionJoin: "&&",
  chain: "ethereum",
  ethereum: [{ field: "to", operator: "==", value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }],
  activity: [{ field: "type", operator: "==", value: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2" }],
}
// → "eth.tx.to == '0xd8...' && activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'"
```

---

## Adding a new chain

To add support for a new chain (e.g. Cosmos):

**1. `src/types/policy.ts`** — add the chain type and condition interface:
```ts
export type ChainType = "ethereum" | "solana" | "tron" | "bitcoin" | "cosmos"

export interface CosmosCondition {
  field: "sender" | "recipient" | "amount"
  operator: "==" | "!=" | ">" | "<" | ">=" | "<="
  value: string
}
```

Add `cosmos?: CosmosCondition[]` to `ConditionConfig`.

**2. `src/lib/policy-builder.ts`** — add a builder function and a case in `buildConditionExpression`:
```ts
function buildCosmosCondition(conditions: CosmosCondition[], join: string): string {
  return conditions
    .map((c) => `cosmos.tx.${c.field} ${c.operator} '${c.value}'`)
    .join(` ${join} `)
}

// Inside buildConditionExpression(), in the chain switch:
case "cosmos":
  chainExpr = config.cosmos ? buildCosmosCondition(config.cosmos, join) : ""
  break
```

**3. `src/components/policy/chains/CosmosConditions.tsx`** — create the form component following the same pattern as `EthereumConditions.tsx`. It should accept `conditions: CosmosCondition[]` and `onChange` props.

**4. `src/components/policy/ConditionBuilder.tsx`** — import the new component and add a conditional render:
```tsx
import { CosmosConditions } from "@/components/policy/chains/CosmosConditions"

// In the JSX, after the existing chain blocks:
{config.chain === "cosmos" && (
  <CosmosConditions conditions={config.cosmos || []}
    onChange={(c: CosmosCondition[]) => onChange({ ...config, cosmos: c })} />
)}
```

Also add `"cosmos"` to the chain selector dropdown options in `ConditionBuilder.tsx`.

---

## Presets

`src/lib/presets.ts` exports `policyPresets: PolicyPreset[]`. Each entry is a `PolicyConfig` with metadata (`id`, `name`, `description`, `category`, optional `docUrl`). Categories are `"ethereum"`, `"solana"`, `"tron"`, or `"general"`.

`src/components/policy/PolicyPresets.tsx` renders the list grouped by category. Clicking a preset calls `onApply(preset.config)`, which sets the policy builder's state to the preset's `PolicyConfig` — everything compiles from there as normal.

To add a new preset, append an entry to the `policyPresets` array in `src/lib/presets.ts`. No UI changes needed.
