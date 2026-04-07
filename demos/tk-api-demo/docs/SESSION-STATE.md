# Session State

## Reference table

| Key | Type | Produced by | Consumed by | Notes |
|-----|------|-------------|-------------|-------|
| `subOrgId` | `string` | `CREATE_SUB_ORG` | `CREATE_WALLET`, `CREATE_WALLET_ACCOUNTS`, `CREATE_API_USER`, `CREATE_API_KEYS`, `CREATE_PRIVATE_KEY`, `CREATE_POLICY`, `CREATE_USER_TAG`, `CREATE_PRIVATE_KEY_TAG`, `CREATE_POLICIES`, `CREATE_INVITATIONS`, `SIGN_*`, `UPDATE_*`, `DELETE_*`, all queries | Primary scope key; nearly every step requires it |
| `subOrganizationName` | `string` | Set from UI input before `CREATE_SUB_ORG` | `CREATE_SUB_ORG` (display request) | Display only; not stored by Turnkey |
| `walletId` | `string` | `CREATE_WALLET` | `CREATE_WALLET_ACCOUNTS`, `UPDATE_WALLET`, `DELETE_WALLETS`, `GET_WALLET`, `LIST_WALLET_ACCOUNTS` | HD wallet ID within the sub-org |
| `walletAddress` | `string` | `CREATE_WALLET` | `SIGN_TRANSACTION`, `SIGN_RAW_PAYLOAD`, `SIGN_RAW_PAYLOADS` | Primary Ethereum address (index 0) |
| `apiUserId` | `string` | `CREATE_API_USER` | `CREATE_API_KEYS`, `CREATE_INVITATIONS`, `CREATE_POLICY` (consensus expression), `UPDATE_POLICY`, `UPDATE_USER`, `DELETE_USERS`, `GET_USER`, `GET_AUTHENTICATORS` | Non-human user whose key pair signs policy-gated requests |
| `apiUserPublicKey` | `string` | `CREATE_API_USER` | `CREATE_API_USER` (display request), `SIGN_*` steps that use `apiUserClient` | P256 public key hex |
| `apiUserPrivateKey` | `string` | `CREATE_API_USER` | `apiUserClient()` factory in signing steps | **Ephemeral and demo-only** — see warning below |
| `policyId` | `string` | `CREATE_POLICY`, `CREATE_POLICIES` | `UPDATE_POLICY`, `DELETE_POLICY`, `DELETE_POLICIES`, `GET_POLICY` | ID of the most recently created policy |
| `allowedAddress` | `string` | `CREATE_POLICY` (allowlist variant) | `SIGN_TRANSACTION` (allowed path) | Ethereum address in the policy condition; used to construct the allowed signing transaction |
| `privateKeyId` | `string` | `CREATE_PRIVATE_KEY` | `DELETE_PRIVATE_KEYS`, `GET_PRIVATE_KEY` | Standalone (non-HD) private key ID |
| `userTagId` | `string` | `CREATE_USER_TAG` | `DELETE_USER_TAGS`, seeded into sub-org flow via `tk-parent-org-state` | Tag for classifying users in policies |
| `privateKeyTagId` | `string` | `CREATE_PRIVATE_KEY_TAG` | `DELETE_PRIVATE_KEY_TAGS`, seeded into sub-org flow | Tag for classifying private keys in policies |
| `apiKeyId` | `string` | `CREATE_API_KEYS` | `DELETE_API_KEYS` | Additional API key added to the API user |
| `rootUserId` | `string` | `CREATE_SUB_ORG`, `GET_WHO_AM_I` | `UPDATE_ROOT_QUORUM` | Root user of the sub-org or parent org |

---

## Persistence

State is persisted to `localStorage` after every successful step. The storage key is `tk-session-{flowId}`:

| Flow | localStorage key |
|------|-----------------|
| Parent org setup (`/setup/parent`) | `tk-session-parent` |
| Sub-org setup (`/setup/sub-org`) | `tk-session-sub-org` |
| Custom parent builder | `tk-session-parent` |
| Custom sub-org builder | `tk-session-sub-org` |

On page load, `SetupClient` reads the stored state and re-hydrates `sessionState`. Steps that were already completed are shown as such and their stored request/response is available for replay.

The Reset button in the step runner clears both the React state and the corresponding `localStorage` key.

---

## Parent → sub-org state seeding

When the parent org flow completes, it writes its final `SessionState` to `localStorage` under `tk-parent-org-state`.

When the sub-org flow initializes, it reads `tk-parent-org-state` and merges any relevant keys into the initial sub-org session state. This is how `userTagId` and `privateKeyTagId` — created in the parent org flow — are available to sub-org policy creation steps without requiring the user to copy them manually.

The seeding is one-directional and one-time: the sub-org flow reads from `tk-parent-org-state` at startup; it does not write back to it.

---

## The `apiUserPrivateKey` warning

`SessionState.apiUserPrivateKey` holds the P256 private key of the API user created during `CREATE_API_USER`. It is stored in the session so that subsequent steps can call `apiUserClient(publicKey, privateKey, subOrgId)` to sign requests as that user — which is required for any step protected by a policy `consensus` expression.

This key exists in memory and localStorage for the duration of the demo session only. It must never be:
- Persisted server-side in any production system
- Logged to any logging infrastructure
- Transmitted outside the application

In production, the private key would either be stored in a secrets manager or never leave the server process that generated it. The in-browser storage here is a deliberate trade-off for demo convenience.

---

## The Skip feature

Every step in `SetupClient` has a Skip option. Clicking Skip reveals input fields for each key in `STEP_PRODUCES[step.kind]` (defined in `src/app/setup/SetupClient.tsx`). Entering values and confirming creates a synthetic `StepResult` marked as success with `request: null` and a `response` noting the step was skipped manually.

The injected values are merged into `sessionState` exactly as they would be after a real execution, so all subsequent steps that `require` those keys become available.

Use Skip when:
- You already ran a step in a previous session and want to resume from a known ID.
- You want to target a specific existing resource (e.g. a wallet you created outside this tool).
- A step is failing and you want to continue testing downstream steps with a known-good ID.
