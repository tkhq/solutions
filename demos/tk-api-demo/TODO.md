# Improvement Backlog

Roughly ordered by impact within each section.

---

## Policy

### GUI Policy Constructor
Replace the current preset dropdown with a visual policy builder. The builder should compose a valid Turnkey policy expression from structured inputs rather than requiring the developer to write condition strings by hand.

**Condition builder**
- Resource/action pickers: `activity.resource` (WALLET, AUTH, PRIVATE_KEY, POLICY, USER, …) + `activity.action` (CREATE, UPDATE, DELETE, SIGN)
- `activity.type` picker — full enum of activity type strings (ACTIVITY_TYPE_SIGN_TRANSACTION_V2, etc.)
- Ethereum-specific fields: `eth.tx.to`, `eth.tx.value`, `eth.tx.gasLimit`, `eth.tx.data` with an operator picker (==, !=, >, <, in)
- Tag-based conditions: `user.tags` contains `<tagId>`, `privateKey.tags` contains `<tagId>` — with a dropdown sourced from previously created tags in session state
- Logical combinators: AND / OR / NOT between clauses, with visual grouping
- "Always" shortcut (renders `true`)

**Consensus builder**
- Approver picker: any user by ID, users with a given tag, "any user"
- Threshold slider for M-of-N (renders `approvers.count(user, ...) >= N`)
- Auto-populate API user from session state

**Effect toggle** — ALLOW / DENY with a red/green indicator

**Live preview** — shows the assembled condition and consensus strings updating as inputs change, exactly as they will be sent to Turnkey

**Where it goes** — accessible from any CREATE_POLICY or UPDATE_POLICY step as an alternative to hand-editing the request JSON. Renders inside the request panel when the step kind is a policy operation.

---

### Policy bugs to fix

- **`allow-all` type falls through to address-allowlist** — `getPolicyConfig` has no `allow-all` case; it hits the default branch and creates `eth.tx.to == '<address>'` instead of `true`. The recommender generates this type for "Allow all signing / no restrictions" answers. Fix: add an explicit `allow-all` case (same as `permissive`).

- **Policy note is hardcoded** — the `notes` field always reads "Allow all signing activity" regardless of the policy type (e.g. a DENY policy gets this note). Derive the note from the policy name or make it editable.

- **Empty consensus when no API user** — when a policy is created in a parent-org context before any API user exists, `state.apiUserId` is undefined and the consensus expression becomes `approvers.any(user, user.id == '')`. This policy is permanently unmatched. Add a warning in the UI when `apiUserId` is absent during a CREATE_POLICY step.

- **UPDATE_POLICY always uses sign-only condition** — the update executor hardwires the new condition to the sign-only expression. It should offer the same policy type picker as create.

---

### Missing policy presets

- **Value limit** — `eth.tx.value < <threshold>` (EFFECT_ALLOW)
- **Tag-based signing** — `user.tags.contains('<tagId>')` — show how user/key tags created in parent setup feed into sub-org policies
- **Time-windowed** — if Turnkey supports time expressions, show an example
- **Quorum / M-of-N** — `approvers.count(user, user.tags.contains('<tagId>')) >= 2` — demonstrate multi-approver scenarios

---

## Step Runner (SetupClient)

- **Show latency** — `latencyMs` is computed in `/api/execute` and returned in the result but never displayed. Show it next to each completed step (e.g. "✓ 342 ms" in the step list sidebar).

- **Export session trace** — "Download as JSON" button that saves all step requests, responses, and session state as a single file. Useful for debugging and sharing integration traces.

- **Better code generation** — the "Code" tab shows a single SDK call. Add a "Generate file" option that produces a complete, runnable Node.js script for all completed steps, including imports, client setup from env vars, and sequential execution.

- **Copy as curl** — secondary option in the Code tab showing the equivalent `curl` call for each step.

- **Step timing in sidebar** — after a step completes, show its latency next to the status icon in the step list.

---

## Catalog & Executor

### Missing operations (high value)

- **`EXPORT_WALLET` / `EXPORT_PRIVATE_KEY`** — Key export is a primary use case for custody migration and user self-custody handoff. Add executor support and catalog items for both. The export flow is async and requires a target public key; the display should explain the enclave-to-enclave encrypted export model.

- **`IMPORT_WALLET` / `IMPORT_PRIVATE_KEY`** — Companion to export. Allows bringing externally generated keys into Turnkey's enclave.

- **`APPROVE_ACTIVITY` / `REJECT_ACTIVITY`** — Multi-approver quorum is a core Turnkey feature but currently impossible to demonstrate end-to-end. To show this: (1) create a quorum policy requiring 2 approvals, (2) initiate an activity, (3) show it as PENDING, (4) approve it with a second key. The executor could simulate this with the root key approving.

- **`GET_ACTIVITY`** (single) — Only `LIST_ACTIVITIES` is in the catalog. Add the singular fetch.

### Wallet chain variants

- **Solana wallet creation** — add a `create-wallet-solana` catalog item that uses `CURVE_ED25519` + `ADDRESS_FORMAT_SOLANA` + the Solana derivation path (`m/44'/501'/0'/0'`). Currently, selecting "Solana" in the recommender creates an Ethereum wallet.

- **Bitcoin wallet creation** — `create-wallet-bitcoin` with `ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH`.

- **Multi-chain wallet** — a single `CREATE_WALLET` call with accounts for multiple chains at once.

### Signing chain variants

- **Solana transaction signing** — `TRANSACTION_TYPE_SOLANA` signing path in the executor. Construct a minimal Solana transfer transaction using `@solana/web3.js` and sign it.

- **Bitcoin PSBT signing** — `TRANSACTION_TYPE_BITCOIN` signing path.

---

## Recommend Wizard

- **Fix the flow for multi-chain answers** — selecting "Solana only" or "Bitcoin only" produces identical setup steps as EVM. The wallet creation and signing demo steps should reflect the chosen chain.

- **DeFi / on-chain protocol answer** — the "smart contract management" app type was added but the signing restriction question ("What signing restrictions do you want to start with?") doesn't have a contract-specific option like "Allow only calls to known contracts." Add an `allowlist` variant that specifically creates an address-allowlist policy scoped to a contract address.

- **Show why each step is recommended** — the `reason` field on each step is computed but not rendered in the results view. Show it as a tooltip or expandable note so developers understand the rationale.

- **Restore answers** — if the user navigates back from results to questions, their previous answers should be pre-selected.

---

## Org Explorer

### Layout & Navigation

- **Fixed right sidebar** — the biggest friction point: clicking a node requires scrolling down to see the detail panel. Move it to a persistent right sidebar (`w-96`, slide-in on selection) so the tree stays fully visible while browsing details. Layout becomes tree (70%) + sidebar (30%).

- **Keyboard navigation** — arrow keys to move between nodes, `Escape` to deselect, `Enter` to expand/collapse wallet accounts.

- **Search / filter bar** — text input above the tree that filters nodes by name or ID. Highlight matches with a colored ring rather than hiding non-matches so the tree structure stays visible. High value once sub-org count exceeds ~8.

### Node Information

- **Hover preview tooltip** — show wallet count, user count, and policy count on hover without requiring a click. Data is already available from the org-map fetch.

- **Status badges on cards** — small badge counts on each sub-org card (e.g. `3 wallets · 2 policies`). Colored dot indicators: green = has wallets, amber = has pending activity.

- **Wallet accounts** — sub-org wallet detail shows `walletId` but not the derived accounts/addresses. Add a "Load accounts" expansion that fetches `getWalletAccounts` for the selected wallet.

### Detail Panel Actions

- **Click-to-interact** — add an "Interact →" button in the sub-org detail panel that pre-populates the interact page with that sub-org's ID and known wallet IDs, skipping the org selector step.

- **Copy org/wallet IDs** — inline copy buttons on every ID shown in detail panels (currently only the session state sidebar has copy buttons).

- **Activity feed** — add a collapsible "Recent Activities" section in the sub-org detail panel (calls `getActivities` with limit 10). Answers the common debugging question "what happened in this org recently?" without leaving the page.

- **Delete via context menu** — move the delete action to a `⋯` overflow button on hover instead of a button always visible in the detail panel. Reduces visual noise and accidental clicks.

### Tree & Empty States

- **Pagination for sub-orgs** — the explorer fetches up to 24 sub-orgs. Add a "Load more" control when `totalSubOrgs > fetchedSubOrgCount`.

- **Empty state with CTA** — when there are no sub-orgs, replace the empty tree area with a centered prompt linking to the recommender or build page.

---

## Interact Page

- **Wallet selector** — when a sub-org has multiple wallets, Interact seeds only the first one. Add a dropdown to pick which wallet (and which account address) to use as the `walletAddress` seed.

- **Pre-populate more state** — beyond `subOrgId` and `walletId`, attempt to seed `apiUserId` from the sub-org's user list (the first non-root API user) so signing steps unlock without running CREATE_API_USER.

- **Save scenarios** — allow naming and saving a built scenario to `localStorage` so it can be reloaded without rebuilding from scratch.

---

## Developer Experience

- **Environment validator at startup** — a `/api/health` endpoint (or a banner on the home page) that calls `getWhoAmI` on mount and reports whether credentials are valid. Show a clear error state (missing env var, wrong key, wrong org ID) before the user tries to run any step.

- **Shareable scenario links** — encode a scenario as a URL-safe base64 query param so it can be bookmarked and shared. The catalog's `CatalogItem` array is small enough for this.

- **Orphaned demo pages** — `/demo/address-allowlist`, `/demo/wallet-inspection`, `/demo/raw-payload-signing` are fully functional but unreachable from navigation. Either link them from the home page under a "Guided Demos" section or remove them.

- **Dark/light mode persistence** — verify the `next-themes` setup persists the user's preference across page navigations (should work, but worth checking for flash-of-unstyled-content on first load).

- **Mobile layout** — SetupClient's two-column request/response layout breaks on narrow screens. The sidebar also collapses poorly. Low priority for a developer tool but worth a responsive pass.
