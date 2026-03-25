---
name: turnkey-lite
description: Guide a user through the essential Turnkey onboarding flow: create a parent organization, create a wallet, create an API key user, and create a policy allowing that user to transact on the wallet.
---

# Turnkey Lite Onboarding

Your job is to guide the user through four steps to get a Turnkey environment ready for programmatic
signing. Work through each step in order, confirm completion before moving on, and explain the _why_
behind each step so the user understands what they're building.

**Before starting:** Ask the user whether they have already completed any of these steps. If they
have, skip ahead to the first incomplete step — do not repeat work they've done.

If the user has questions about Turnkey policies, the policy language, or available activity
parameters beyond what is covered here, use the `mcp__claude_ai_Turnkey_Docs__search_turnkey` tool
to look up the relevant documentation before answering.

---

## Step 1: Create a Parent Organization

**What this is:** The parent organization is the top-level entity in Turnkey. Everything else —
wallets, users, policies — lives inside it. A human user (the org owner) is created alongside it,
authenticated via passkey.

**This step is manual (web dashboard):**

1. Direct the user to: https://app.turnkey.com/dashboard/auth/initial
2. Tell the user to enter their email address to register.
3. Tell the user to check their email — Turnkey will send a verification link. They should click it
   to verify their address.
4. After verification, tell the user they will be prompted to create a **passkey** as their
   authenticator. Explain that this is the only supported login method for the Turnkey dashboard.
5. Once the passkey is created, the user is logged into their new (empty) parent organization.

**Confirm before continuing:** Ask the user to confirm they can see their Turnkey dashboard and are
logged in. Their org is ready when they can see the main dashboard view.

---

## Step 2: Create a Wallet

**What this is:** A Turnkey wallet is an HD (hierarchical deterministic) wallet — a single seed from
which one or more accounts can be derived. Each account has its own address on a given network.
Creating the wallet here gives the user an on-chain address they can later authorize an API key user
to sign from.

**This step is manual (web dashboard):**

1. Tell the user to navigate to the **Wallets** tab in the dashboard.
2. Tell the user to click the **"+ Create wallet"** button near the top of the (empty) wallet list.
3. Tell the user to enter a **wallet name**.
4. Tell the user to select an **Address type**. Let them know that Ethereum, Solana, and Bitcoin
   appear at the top of the list and will automatically populate the **Curve type**, **Path type**,
   and **Path** fields with the standard defaults for that network. Point them to
   https://docs.turnkey.com/concepts/wallets#address-formats-and-curves for the full list of
   supported types.
5. Tell the user they can optionally click **"+ Create another account"** to derive additional
   accounts from the same seed — this is one of the key benefits of HD wallets.
6. Tell the user to click **"Continue"** to review the Create Wallet action summary.
7. Tell the user to click **"Approve"** if everything looks correct, and explain that they will be
   prompted to authenticate with their passkey. The wallet is only created once the passkey
   credential is submitted — backing out or failing to authenticate cancels the action entirely.

**Confirm before continuing:** Ask the user to confirm the wallet appears in their Wallets tab with
the expected address(es) listed.

---

## Step 3: Create an API Key User

**What this is:** Turnkey users can authenticate via passkey (for humans) or API key (for
machines/services). An API key user is a non-root, non-human user — essentially a service account.
It holds a key pair that code will use to authenticate requests to the Turnkey API. This is what
will eventually be allowed to sign transactions on the wallet created in step 2.

**This step is manual (web dashboard):**

1. Tell the user to navigate to the **Users** tab. Let them know they will see themselves listed as
   the **Root user** — the new user will be a second, non-root entry.
2. Tell the user to click **"+ Create user"** above the user list.
3. Tell the user to set **Access type** to **"API key"**, and to enter a **Name** — something
   functional works well here (e.g. `signing-service`, `backend-worker`).
4. Tell the user to leave the **User tag** field blank — no tags exist yet and it is not needed.
5. Tell the user to click **"Continue"**, then choose to generate the API keys **in-browser**
   (rather than via CLI).
6. Tell the user to click **"Continue"** again. The next screen prompts for an API key **Label** —
   something descriptive of the machine or service that will use it (e.g. `prod-server`,
   `dev-laptop`).
7. Tell the user to click **"Continue"** once more to reach the **Approve** screen. Let them know
   this screen will display their **API public key** and **API private key**, along with a
   **"Download JSON"** button.
8. Tell the user they must **download or securely save both keys now** — the private key will not be
   shown again.
9. Tell the user to click **"Approve"** and authenticate with their passkey to complete the action.
   Emphasize that backing out at any point — including after the keys have been displayed on screen
   — results in no action being taken. The user does not exist in Turnkey until passkey approval is
   confirmed.

**Confirm before continuing:** Ask the user to confirm the new API key user appears in the Users
tab, and that they have both the public and private key saved securely.

---

## Step 4: Create a Policy Allowing the API Key User to Transact

**What this is:** By default, a newly created API key user has no permissions. Policies are the
mechanism that grant or restrict what actions users can take. This step is critical — it defines the
security boundary for the API key user, scoping exactly what it is allowed to do. A policy that is
too broad is a security risk; a policy that is too narrow will block legitimate actions.

**This step is manual (web dashboard):**

1. Tell the user to navigate to the **Security** tab in the Turnkey dashboard.
2. Tell the user to find the **Policies** list in the middle of the page (currently empty) and click
   **"+ Create policy"**.
3. Tell the user to fill in the following fields:
   - **Name** — a descriptive label for the policy (e.g. `allow-agent-evm-signing`)
   - **Notes** — optional but recommended; describe what the policy allows and why
   - **Policy JSON** — the CEL-based policy definition (see below)
4. Tell the user to click **"Continue"** and review the parameters.
5. Tell the user to click **"Approve"** and authenticate with their passkey. As with all previous
   steps, exiting or failing to authenticate cancels the action. Once approved, the policy takes
   effect immediately.

### Policy language

Turnkey policies use a JSON structure with a domain-specific language based on CEL (Common
Expression Language). Each policy has three key fields:

- `effect` — either `"EFFECT_ALLOW"` or `"EFFECT_DENY"`
- `consensus` — _who_ must approve (evaluated against the approving user(s))
- `condition` — _what_ action is being permitted (evaluated against the activity being requested)

Full language reference: https://docs.turnkey.com/concepts/policies/language — including a table of
available activity parameters that can be used in `condition` expressions.

Template examples for common use cases:

- Signing control: https://docs.turnkey.com/concepts/policies/examples/signing-control
- Ethereum/EVM: https://docs.turnkey.com/concepts/policies/examples/ethereum
- Solana/SVM: https://docs.turnkey.com/concepts/policies/examples/solana

### Finding User IDs

Most policies target users by their **User ID** — a UUID visible in the **Users** tab by clicking on
a user. For these policies, two IDs are relevant:

- `<AGENT_ID>` — the User ID of the API key user created in step 3
- `<HUMAN_ID>` — the User ID of the Root user (the org owner)

### Example policies

Present these examples to the user and help them select or adapt one based on their use case. Note
that these examples scope permissions by _user identity_ and _transaction properties_. If the user
wants to further restrict signing to a specific wallet, the activity parameters reference at
https://docs.turnkey.com/concepts/policies/language#activity-parameters documents the available
fields — use `mcp__claude_ai_Turnkey_Docs__search_turnkey` to look up the exact syntax if needed.

_Allow an agent to make a specific contract call on EVM mainnet:_

```json
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<AGENT_ID>')",
  "condition": "eth.tx.to == '<CONTRACT_ADDRESS>' && eth.tx.data[0..10] == '<FUNCTION_SELECTOR>' && eth.tx.chain_id == 1"
}
```

_Require both agent and human approval for any signing (dual-control / consensus):_

```json
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<AGENT_ID>') && approvers.any(user, user.id == '<HUMAN_ID>')",
  "condition": "activity.action == 'SIGN'"
}
```

_Allow an agent to delete itself (useful for self-cleanup flows):_

```json
{
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<AGENT_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_DELETE_USERS' && activity.params.user_ids.count() == 1 && '<AGENT_ID>' in activity.params.user_ids"
}
```

You do not need to be a policy expert. Presenting these examples, helping the user substitute their
real IDs, and pointing to the reference docs for anything more advanced is sufficient.

**Confirm before continuing:** Ask the user to confirm the policy appears in the Policies list under
the Security tab.

---

## Done

The user now has a parent organization with a wallet, a non-human API key user, and a policy scoped
to allow that user to sign transactions. This is the minimal viable setup for programmatic signing
with Turnkey.

**A note on pricing:** New organizations start on the **Free** plan, which has usage limits that may
be reached quickly. Two paid tiers are available:

- **Pay as You Go** — usage-based pricing, no monthly commitment
- **Pro** — $99/month, improved limits and variable pricing

For usage at scale, Turnkey offers **Enterprise** tiers with significantly improved terms — the user
should contact Turnkey directly to discuss. Full pricing details at https://www.turnkey.com/pricing
