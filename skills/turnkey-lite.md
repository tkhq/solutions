---
name: turnkey-lite
description:
  "Guide a user through the essential Turnkey onboarding flow: create a parent organization, issue
  root user API credentials, then programmatically create a wallet, a signing agent user, and a
  scoped policy."
---

# Turnkey Lite Onboarding

This skill provisions a minimal but complete Turnkey environment for programmatic signing. Two
distinct agents are involved throughout:

- **Provisioning agent** — you. You will guide the user through two manual steps, then use the
  credentials obtained to execute the remaining steps via the Turnkey API on the user's behalf.
- **Signing agent** — the bounded, non-human API key user you will create in step 4. This is the
  entity that will ultimately be permitted to sign transactions, scoped by the policy you create in
  step 5.

Work through each step in order. For the two manual steps, confirm completion before proceeding. For
the API steps, execute the call, confirm the result, and surface any relevant IDs to the user before
moving on.

**Before starting:** Ask the user whether they have already completed any of these steps. If they
have, skip ahead to the first incomplete step.

If you have questions about Turnkey API calls, SDK usage, or policy language beyond what is covered
here, use the `mcp__claude_ai_Turnkey_Docs__search_turnkey` tool to look up the relevant
documentation before proceeding.

---

## Step 1: Create a Parent Organization

**What this is:** The parent organization is the top-level entity in Turnkey. Everything else —
wallets, users, policies — lives inside it. A human user (the org owner) is created alongside it,
authenticated via passkey.

**This step is manual (web dashboard):**

1. Direct the user to: https://app.turnkey.com/dashboard/auth/initial
2. Tell the user to enter their email address to register.
3. Tell the user to check their email — Turnkey will send a verification link to click.
4. After verification, tell the user they will be prompted to create a **passkey** as their
   authenticator. This is the only supported login method for the Turnkey dashboard.
5. Once the passkey is created, the user is logged into their new (empty) parent organization.

**Confirm before continuing:** Ask the user to confirm they can see their Turnkey dashboard and are
logged in.

---

## Step 2: Issue API Credentials to the Root User

**What this is:** Before you (the provisioning agent) can make any Turnkey API calls, the root user
needs an API key pair associated with their account. This is the last manual step — once these
credentials are in your hands, the remainder of the flow can be executed programmatically.

**This step is manual (web dashboard):**

1. Tell the user to navigate to the **Users** tab. They will see themselves as the sole **Root
   user**.
2. Tell the user to click on their Root user entry, which opens a screen showing their
   **Authenticators** and **API keys**. The API keys list will be empty.
3. Tell the user to click **"+ Create API key"** and follow these steps:
   - Choose to generate the API keys **in-browser** (not via CLI)
   - Enter a **Label** for the key — something descriptive of its purpose (e.g.
     `provisioning-agent`, `setup-key`)
   - Clicking **"Continue"** will display the **API public key** and **API private key**, along with
     a **"Download JSON"** button
   - Tell the user to **download or securely save both keys now** — the private key will not be
     shown again
   - Tell the user to click **"Approve"** and authenticate with their passkey to complete the
     action. The key is not registered until passkey approval is confirmed — backing out at any
     point, even after the keys have been displayed, results in no action being taken
4. Tell the user to also retrieve their **Org ID**, which is visible by clicking on the **"Root
   user"** tab in the top-right corner of the dashboard.
5. Do not ask the user to paste credentials into the chat — these are sensitive values that should
   not appear in the conversation transcript. Instead:
   - Check whether a `.env` file already exists in the working directory
   - If it does, check whether `API_PUBLIC_KEY`, `API_PRIVATE_KEY`, and `ORGANIZATION_ID` are
     already present. Add any that are missing as empty placeholders.
   - If no `.env` exists, create one with the following placeholder format:
     ```
     API_PUBLIC_KEY=
     API_PRIVATE_KEY=
     ORGANIZATION_ID=
     ```
   - Check whether `.env` is listed in `.gitignore`. If not, add it.
   - Ask the user to open the `.env` file, fill in the three values, and save it.
6. Once the user confirms the values are in place, read the file yourself and parse the credentials.

**Confirm before continuing:** Confirm you have successfully read all three values from the `.env`
file and can initialize a Turnkey API client.

---

## Step 3: Create a Wallet

**What this is:** A Turnkey wallet is an HD (hierarchical deterministic) wallet — a single seed from
which one or more accounts can be derived. Each account is defined by its address type, curve, and
derivation path. Notably, the same account can be used across any chain that shares those
parameters. You will create this wallet on the user's behalf using the credentials from step 2.

**You (the provisioning agent) will execute this step via the Turnkey API:**

1. Ask the user what address type they want — this determines the curve and derivation path, and
   therefore which chains the account is compatible with. Ethereum (EVM), Solana, and Bitcoin are
   the most common starting points, each with well-established defaults. Remind the user that an
   Ethereum-type account is compatible with all EVM chains, not just mainnet. The full list of
   supported address types is at
   https://docs.turnkey.com/concepts/wallets#address-formats-and-curves
2. Ask the user for a wallet name.
3. Initialize a Turnkey API client using the credentials from step 2 (`@turnkey/sdk-server` is the
   recommended package:
   `new Turnkey({ apiBaseUrl, apiPublicKey, apiPrivateKey, defaultOrganizationId }).apiClient()`).
4. Call `createWallet()` with the wallet name and appropriate account parameters for the chosen
   network.
5. Capture the **wallet ID** from the response — you will reference it when helping the user scope
   their policy in step 5.

**Confirm before continuing:** Surface the wallet ID and the derived account address(es) to the
user. Confirm they match expectations. The user can also verify by navigating to the **Wallets** tab
in the dashboard, where the new wallet and its accounts should now appear.

---

## Step 4: Create the Signing Agent

**What this is:** The signing agent is a non-root, non-human user — a service account that your code
will use to authenticate signing requests to the Turnkey API. It authenticates via an API key pair
that you will generate and manage. This is a distinct entity from you (the provisioning agent) and
will be granted only the permissions defined in step 5.

**You (the provisioning agent) will execute this step via the Turnkey API:**

1. Generate a new P-256 key pair for the signing agent. Using `@turnkey/crypto`:
   `generateP256KeyPair()` returns `{ privateKey, compressedPublicKey }`. The `compressedPublicKey`
   is what you will register with Turnkey; the `privateKey` is what the signing agent will use at
   runtime.
2. Ask the user for a name for the signing agent (e.g. `signing-agent`, `tx-signer`), and a label
   for its API key (e.g. the name of the service or machine that will use it).
3. Call the Turnkey API to create a new user with API key access, supplying the signing agent's name
   and the `compressedPublicKey` as its credential. Use
   `mcp__claude_ai_Turnkey_Docs__search_turnkey` to confirm the exact method and parameters if
   needed.
4. Capture the **signing agent's user ID** from the response — you will need it for the policy in
   step 5.
5. The signing agent's **private key** must be stored securely and made available to whatever
   service will use it at runtime. Surface it to the user now and ensure they save it. It cannot be
   retrieved from Turnkey later.

**Confirm before continuing:** Surface the signing agent's user ID and public key to the user.
Confirm the private key has been saved securely. The user can also verify by navigating to the
**Users** tab in the dashboard, where the signing agent should now appear alongside the root user.

---

## Step 5: Create a Policy for the Signing Agent

**What this is:** By default, the signing agent has no permissions. Policies are the mechanism that
grants rights to act. This step is critical — it defines the security boundary, scoping exactly what
the signing agent is and is not allowed to do. A policy that is too broad is a security risk; one
that is too narrow will silently block legitimate actions.

**You (the provisioning agent) will execute this step via the Turnkey API:**

1. Present the example policies below to the user and help them select or adapt one based on their
   use case.
2. Substitute the real values for all placeholders (the signing agent's user ID from step 4, the
   wallet ID from step 3, and any contract/chain specifics the user provides).
3. Call the Turnkey API to create the policy with the chosen `effect`, `consensus`, and `condition`.
   Use `mcp__claude_ai_Turnkey_Docs__search_turnkey` to confirm the exact method and parameters if
   needed.
4. Confirm the policy was created and is listed in the user's organization.

### Policy language

Turnkey policies use a JSON structure with a DSL based on CEL (Common Expression Language). Each
policy has three key fields:

- `effect` — either `"EFFECT_ALLOW"` or `"EFFECT_DENY"`
- `consensus` — _who_ must approve (evaluated against the approving user(s))
- `condition` — _what_ action is being permitted (evaluated against the activity being requested)

Full language reference: https://docs.turnkey.com/concepts/policies/language

Template examples for common use cases:

- Signing control: https://docs.turnkey.com/concepts/policies/examples/signing-control
- Ethereum/EVM: https://docs.turnkey.com/concepts/policies/examples/ethereum
- Solana/SVM: https://docs.turnkey.com/concepts/policies/examples/solana

### Placeholder reference

- `<SIGNING_AGENT_ID>` — the signing agent's user ID, captured in step 4
- `<ROOT_USER_ID>` — the root user's ID, visible in the Users tab
- `<WALLET_ID>` — the wallet ID captured in step 3 (use this to scope policies to a specific wallet
  if the policy language supports it — look up `activity parameters` via
  `mcp__claude_ai_Turnkey_Docs__search_turnkey` for the exact field name)

### Example policies

_Allow the signing agent to make a specific contract call on EVM mainnet:_

```json
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<SIGNING_AGENT_ID>')",
  "condition": "eth.tx.to == '<CONTRACT_ADDRESS>' && eth.tx.data[0..10] == '<FUNCTION_SELECTOR>' && eth.tx.chain_id == 1"
}
```

_Require both signing agent and root user approval for any signing (dual-control):_

```json
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<SIGNING_AGENT_ID>') && approvers.any(user, user.id == '<ROOT_USER_ID>')",
  "condition": "activity.action == 'SIGN'"
}
```

_Allow the signing agent to delete itself (useful for self-cleanup flows):_

```json
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<SIGNING_AGENT_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_DELETE_USERS' && activity.params.user_ids.count() == 1 && '<SIGNING_AGENT_ID>' in activity.params.user_ids"
}
```

You do not need to be a policy expert. Presenting these examples, substituting the user's real IDs,
and pointing to the reference docs for anything more advanced is sufficient.

**Confirm before continuing:** Confirm the policy was created successfully and review the final
configuration with the user. The user can also verify by navigating to the **Security** tab in the
dashboard, where the new policy should appear in the Policies list.

---

## Done

The user now has:

- A **parent organization** with themselves as root user
- A **wallet** with one or more derived accounts on their chosen network
- A **signing agent** — a non-human API key user with its own key pair
- A **policy** scoped to define exactly what the signing agent is permitted to do

This is the minimal viable setup for programmatic signing with Turnkey. The signing agent's private
key and the organization ID are what downstream code will need to authenticate and submit signing
requests.

**A note on pricing:** New organizations start on the **Free** plan, which has usage limits that may
be reached quickly. Two paid tiers are available:

- **Pay as You Go** — usage-based pricing, no monthly commitment
- **Pro** — $99/month, improved limits and variable pricing

For usage at scale, Turnkey offers **Enterprise** tiers with significantly improved terms — the user
should contact Turnkey directly. Full pricing details at https://www.turnkey.com/pricing
