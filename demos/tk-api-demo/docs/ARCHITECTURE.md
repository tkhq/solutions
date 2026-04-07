# Architecture

## System overview

tk-api-demo is a Next.js application that walks developers through configuring a Turnkey integration step by step. It covers parent org setup, sub-org provisioning, signing, and policy management. Every API call runs live against a real Turnkey org — there is no mock layer. The UI previews each request with inline field annotations before execution, then displays the raw response alongside a copy-ready SDK code snippet. Session state (org IDs, wallet IDs, API user keys) accumulates across steps and is stored in localStorage.

---

## Request flow

```
Browser UI
    │
    │  POST /api/preview   (annotated JSON for display only, no SDK calls)
    │  POST /api/execute   (real SDK call, returns StepResult)
    ▼
Next.js API Routes
(src/app/api/preview/route.ts, src/app/api/execute/route.ts)
    │
    │  buildDisplayRequest(step, state)   — sync, returns annotated object
    │  executeStep(step, state, override) — async, dispatches to execute*()
    ▼
src/lib/executor.ts
    │
    │  parentClient() / subOrgClient() / apiUserClient()
    ▼
@turnkey/sdk-server
    │
    ▼
api.turnkey.com
```

`/api/preview` and `/api/execute` both receive the same `{ scenarioId, stepIndex, sessionState }` body. The same `StepConfig` drives both — preview is synchronous and free; execute performs the actual activity.

---

## The three Turnkey client contexts

All three are defined in `src/lib/turnkey-client.ts` and instantiated per-request (not shared across requests).

| Client | Function | Credentials | Default org |
|--------|----------|-------------|-------------|
| `parentClient()` | Root org operations — `createSubOrganization`, `getWhoami`, parent-level queries | `API_PUBLIC_KEY` / `API_PRIVATE_KEY` from env | `ORGANIZATION_ID` from env |
| `subOrgClient(subOrgId)` | Sub-org operations — `createWallet`, `createPolicy`, signing | Same parent credentials | `subOrgId` passed at call time |
| `apiUserClient(publicKey, privateKey, subOrgId)` | Operations that must be signed by the API user — enforced by policies | Ephemeral P256 keypair generated at `CREATE_API_USER` time | `subOrgId` of the target sub-org |

The parent has root access to every sub-org it creates, so `subOrgClient` reuses the parent's API keys with a different `defaultOrganizationId`. `apiUserClient` uses a separately generated keypair stored in `SessionState.apiUserPrivateKey` — this is what policy `consensus` expressions test against.

When `state.subOrgId` is absent (e.g. on the Interact page targeting the parent org), executor functions fall back to `parentClient()` automatically via the pattern:

```ts
const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
```

---

## The preview vs execution split

`/api/preview` calls `buildDisplayRequest(step, state)` — a synchronous switch over `step.kind` that returns an annotated JSON object. No SDK calls are made. The browser renders this in the JSON tree panel before the user clicks Execute.

`/api/execute` calls `executeStep(step, state, overrideRequest)` — an async switch over `step.kind` that dispatches to a private `executeXxx()` function, makes the real SDK call, and returns a `StepResult` containing `{ success, request, response, updatedState, latencyMs }`.

The `overrideRequest` parameter is the bridge between the two: when the user edits the request JSON in the UI panel and clicks Execute, the edited object is sent as `overrideRequest` and the `executeXxx()` function uses it in place of its default params.

---

## The `annotate()` convention

```ts
export function annotate(value: unknown, comment: string) {
  return { __value: value, __comment: comment }
}
```

Fields returned from `buildDisplayRequest` can be wrapped with `annotate()` to attach a tooltip comment. The JSON tree viewer in the UI detects `{ __value, __comment }` objects and renders the value with a hoverable annotation. Comments are display-only — they are never sent to Turnkey.

Example:
```ts
rootQuorumThreshold: annotate(1, '1 = single key required; raise for multi-sig consensus')
```

---

## Session state threading

`SessionState` is a flat key-value bag (`src/types/scenario.ts`) that accumulates IDs and credentials as steps complete. After each step, `StepResult.updatedState` is merged into the running state object.

**Persistence:** State is serialized to localStorage under the key `tk-session-{flowId}`. The `flowId` is `"parent"` for the parent org flow and `"sub-org"` for the sub-org flow. The app re-hydrates this on page load so sessions survive refreshes.

**Parent → sub-org seeding:** The parent org flow saves its final state to `tk-parent-org-state`. When the sub-org flow initializes, it reads that key and merges any relevant values (e.g. `userTagId`, `privateKeyTagId`) into the sub-org session so tag IDs from parent setup are available to policy creation steps.

---

## The catalog dependency graph

Every entry in `CATALOG` (`src/lib/catalog.ts`) declares:

- `requires` — `SessionState` keys that must be present before this step can run
- `provides` — `SessionState` keys this step produces on success

The build page and interact page use `computeAvailableState(steps, seed)` to compute the union of all keys provided by the steps already in the scenario, then pass that to `isAvailable(item, currentSteps, seed)` to determine whether each catalog item's "Add" button is enabled. `getMissingKeys(item, available)` surfaces specific dependency hints, and `getProvidersForKey(key)` suggests which steps to add first.

---

## Directory structure

```
src/
├── app/
│   ├── page.tsx                        # Home — links to all setup paths
│   ├── setup/
│   │   ├── recommend/                  # 4-question setup recommendation wizard
│   │   ├── parent/                     # Guided parent org flow (uses parentOrgSteps)
│   │   ├── sub-org/                    # Guided sub-org flow (uses subOrgSteps)
│   │   ├── custom/                     # Runs a custom-built scenario (parent or sub-org)
│   │   ├── policies/                   # Policy Manager scenario
│   │   └── SetupClient.tsx             # Shared step-runner component used by all flows
│   ├── build/                          # Catalog browser + custom scenario composer
│   ├── interact/
│   │   ├── page.tsx                    # Org selector and catalog builder
│   │   └── run/                        # Executes SetupClient against a pre-seeded org
│   ├── explore/                        # Visual org hierarchy graph
│   └── api/
│       ├── preview/route.ts            # POST — returns buildDisplayRequest output
│       ├── execute/route.ts            # POST — runs executeStep, returns StepResult
│       ├── org-map/route.ts            # GET  — fetches parent + all sub-orgs in parallel
│       ├── delete-sub-org/route.ts     # POST — deleteSubOrganization
│       └── scenarios/route.ts          # GET  — lists built-in scenario definitions
├── components/
│   └── policy/
│       ├── PolicyBuilder.tsx           # Top-level policy editor (consensus + condition)
│       ├── ConsensusBuilder.tsx        # Builds ConsensusConfig via form UI
│       ├── ConditionBuilder.tsx        # Dispatches to chain-specific sub-builders
│       ├── PolicyPresets.tsx           # Renders policyPresets list with one-click apply
│       ├── JsonOutput.tsx              # Displays compiled TurnkeyPolicy JSON
│       └── chains/
│           ├── EthereumConditions.tsx  # eth.tx.* condition form
│           ├── SolanaConditions.tsx    # solana.tx.* condition form
│           ├── TronConditions.tsx      # tron.tx.* condition form
│           ├── BitcoinConditions.tsx   # bitcoin.tx.outputs.* condition form
│           ├── ActivityConditions.tsx  # activity.type/resource/action condition form
│           └── SigningResourceConditions.tsx  # wallet/wallet_account/private_key form
├── lib/
│   ├── executor.ts                     # buildDisplayRequest + all execute*() functions
│   ├── catalog.ts                      # CATALOG array + dependency graph utilities
│   ├── setup-flows.ts                  # parentOrgSteps, subOrgSteps, SDK_METHODS map
│   ├── policy-builder.ts               # PolicyConfig → TurnkeyPolicy compiler
│   ├── presets.ts                      # policyPresets array
│   └── scenarios.ts                    # Built-in Scenario definitions
└── types/
    ├── scenario.ts                     # StepKind, StepConfig, SessionState, StepResult
    └── policy.ts                       # PolicyConfig, TurnkeyPolicy, ConsensusConfig, etc.
```
