# Turnkey API Demo

An interactive walkthrough of Turnkey's wallet infrastructure and policy engine. Every API call runs live against your real organization — no mocks, no stubs.

## What it does

The app helps you configure a Turnkey integration step by step. You pick a setup path, run each operation in sequence, inspect the actual request and response, and copy the server code you need. Session state (sub-org IDs, wallet IDs, API user keys) is automatically threaded through each step.

### Pages

| Route | Description |
|---|---|
| `/` | Home — choose a setup path or jump to any tool |
| `/setup/recommend` | Answer 4 questions → get a recommended parent + sub-org setup |
| `/setup/parent` | Guided parent org setup (credentials, features, tags, policies, invitations) |
| `/setup/sub-org` | Guided sub-org setup (create org, wallet, policy, API user) |
| `/build` | Custom setup builder — pick any activities and queries, compose your own scenario |
| `/interact` | Run ad-hoc activities/queries against an existing org (parent or sub-org) |
| `/explore` | Visual org hierarchy — parent org, all sub-orgs, wallets, users, and policies |

---

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- A Turnkey account with an API key — [create one at app.turnkey.com](https://app.turnkey.com/dashboard/auth/login)

### Installation

```bash
pnpm install
```

### Environment

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `API_PUBLIC_KEY` | Turnkey dashboard → API Keys (starts with `02` or `03`) |
| `API_PRIVATE_KEY` | Generated alongside the public key at creation time |
| `ORGANIZATION_ID` | Turnkey dashboard → Settings → Organization ID |

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Setup flows

### Recommended setup (`/setup/recommend`)

Answers 4 questions about your app:

1. **App type** — consumer-facing, B2B/SaaS, or internal treasury
2. **Auth model** — social/email login, passkey, or API-only
3. **Signing usage** — transactions, raw payloads, or both
4. **Policy needs** — address allowlists, daily limits, multi-approver quorums

Based on your answers, it generates a tailored parent org + sub-org step list and launches both setup flows pre-configured.

### Parent org setup (`/setup/parent`)

Configures the root of your Turnkey organization:

1. **Verify credentials** — `getWhoAmI` to confirm your API keys work
2. **Set organization name** — `updateOrganizationName`
3. **Enable org features** — `setOrganizationFeature` (e.g. email auth)
4. **Create user tag** — classify users (e.g. `end-user`, `admin`)
5. **Create private key tag** — classify keys (e.g. `hot-wallet`, `cold-storage`)
6. **Create org policy** — top-level signing permission policy
7. **Invite team members** — `createInvitations` (supports `+alias` tips for multi-env reuse)
8. **Update root quorum** (optional) — require multiple approvers for root-level actions

State saved to `localStorage` as `tk-parent-org-state` for the sub-org flow to consume.

### Sub-org setup (`/setup/sub-org`)

Creates an isolated org for one end user:

1. **Create sub-organization** — `createSubOrganization` (you retain root access during setup)
2. **Create wallet** — `createWallet` (Ethereum HD wallet, private key never leaves the enclave)
3. **Create policy** — scoped signing policy referencing tags from parent org setup
4. **Create API user** — `createApiOnlyUsers` with an ephemeral P256 key pair for server-side access

### Custom builder (`/build`)

Compose any combination of activities and queries from the full catalog. The builder shows which items are unlocked based on what previous steps produce — for example, `Create Wallet Accounts` only becomes available after `Create Wallet` is in the list. Launches via `/setup/custom/parent` or `/setup/custom/sub-org`.

### Interact (`/interact`)

Run operations against an **existing** org without going through setup. Use this to:

- Query or modify a sub-org you already configured
- Test individual API calls against a live org
- Explore what different activities do against real data

**How it works:**

1. Select a target — pick a sub-org from your fetched list, choose your parent org, or enter an org ID manually
2. `subOrgId` (and `walletId` if a wallet exists) are pre-seeded into session state — all dependent catalog items unlock immediately
3. Build a scenario from the catalog exactly like the custom builder
4. Click **Run Scenario** — launches SetupClient with the pre-seeded state, bypassing any stored session

---

## Session state

Each step can produce state that subsequent steps consume:

| Key | Produced by |
|---|---|
| `subOrgId` | Create Sub-Organization |
| `walletId` / `walletAddress` | Create Wallet |
| `apiUserId` / `apiUserPublicKey` / `apiUserPrivateKey` | Create API User |
| `policyId` | Create Policy |
| `privateKeyId` | Create Private Key |
| `userTagId` / `privateKeyTagId` | Create User Tag / Create Private Key Tag |
| `apiKeyId` | Create API Keys |
| `rootUserId` | Get Who Am I / Create Sub-Organization |

Session is persisted to `localStorage` (key: `tk-session-parent` or `tk-session-sub-org`) after every step. You can resume a session across browser refreshes. A "Session State" sidebar lets you copy any ID with one click. Completed steps can be replayed to inspect their stored request/response.

---

## Step runner features

Each step in the setup flow includes:

- **Request preview** — annotated JSON showing exactly what will be sent (with inline comments explaining each field)
- **Code snippet** — copy-ready `@turnkey/sdk-server` code for the step
- **Edit mode** — modify the request JSON before executing
- **Skip** — enter an existing ID to skip a step (useful if you already ran it)
- **Destructive warnings** — steps that delete or alter quorum require explicit confirmation before running
- **Step replay** — click any completed step to review its stored request and response
- **Session state inspector** — collapsible sidebar showing all accumulated IDs with copy buttons
- **Reset** — clears session state and localStorage to start fresh

---

## Org Explorer (`/explore`)

Fetches your full org hierarchy and renders it as an interactive graph:

- **Parent org node** — name, user count, policy count, tags
- **Sub-org nodes** — connected by Bezier curves; click to select
- **Detail panel** — wallets, users, policies (expandable to show condition/consensus expressions)
- **Delete sub-org** — with `deleteWithoutExport` confirmation checkbox
- **Turnkey Dashboard link** — jump to `app.turnkey.com` to see changes live

Up to 24 sub-orgs are fetched in parallel using `Promise.allSettled` — partial failures don't block the rest.

---

## API routes

| Route | Method | Description |
|---|---|---|
| `/api/preview` | POST | Build annotated request JSON for a given step (server-side, no execution) |
| `/api/execute` | POST | Execute a step and return the Turnkey response |
| `/api/org-map` | GET | Fetch parent org + up to 24 sub-orgs for the explorer and interact page |
| `/api/delete-sub-org` | POST | Delete a sub-organization (`deleteSubOrganization`) |
| `/api/scenarios` | GET | List available built-in scenarios |

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Turnkey SDK | `@turnkey/sdk-server` v5 |
| Signing | `ethers` v6 (EIP-1559 transaction construction) |
| Runtime | Node.js (API routes run server-side with your API keys) |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Home
│   ├── setup/
│   │   ├── recommend/            # Setup recommendation wizard
│   │   ├── parent/               # Guided parent org flow
│   │   ├── sub-org/              # Guided sub-org flow
│   │   ├── custom/               # Custom build runner (parent + sub-org)
│   │   └── SetupClient.tsx       # Shared step runner component
│   ├── build/                    # Custom scenario builder
│   ├── interact/
│   │   ├── page.tsx              # Org selector + catalog builder
│   │   └── run/                  # Runs SetupClient against existing org
│   ├── explore/                  # Org hierarchy visualizer
│   └── api/
│       ├── preview/              # Build request preview
│       ├── execute/              # Execute a step
│       ├── org-map/              # Fetch org hierarchy
│       ├── delete-sub-org/       # Delete a sub-org
│       └── scenarios/            # List scenarios
├── lib/
│   ├── executor.ts               # All Turnkey SDK calls + request builders
│   ├── catalog.ts                # Full activity/query catalog with dependency graph
│   └── setup-flows.ts            # Guided flow step lists + SDK method map
└── types/
    └── scenario.ts               # StepKind, StepConfig, SessionState, StepResult
```

---

## How API calls work

All Turnkey calls run server-side in Next.js API routes. The browser never sees your API private key.

```
Browser → POST /api/execute → executor.ts → @turnkey/sdk-server → api.turnkey.com
```

`executor.ts` handles two concerns for each step kind:

1. **`buildDisplayRequest`** — constructs the annotated request object for the UI preview (may include `{ __value, __comment }` wrappers for inline field hints)
2. **`execute*`** — calls the actual SDK method and returns a `StepResult` with `{ success, request, response, updatedState }`

Clients are scoped per call:
- Parent org operations use `parentClient()` (targets `ORGANIZATION_ID`)
- Sub-org operations use `subOrgClient(state.subOrgId)` (targets the sub-org)
- When `subOrgId` is absent, operations fall back to `parentClient()` automatically — which is how the Interact page targets the parent org without any special-casing
