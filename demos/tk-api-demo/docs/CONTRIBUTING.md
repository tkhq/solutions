# Contributing

## Prerequisites

- Node.js 20+
- pnpm
- A Turnkey sandbox account with an API key pair — create one at [app.turnkey.com](https://app.turnkey.com/dashboard/auth/login)

---

## Local setup

```bash
cp .env.example .env
```

Fill in the three required variables:

| Variable | Where to find it |
|----------|-----------------|
| `API_PUBLIC_KEY` | Turnkey dashboard → API Keys (starts with `02` or `03`) |
| `API_PRIVATE_KEY` | Generated alongside the public key at creation time |
| `ORGANIZATION_ID` | Turnkey dashboard → Settings → Organization ID |

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## All calls are live

There is no mock layer. Every step that runs `executeStep()` makes a real API call to `api.turnkey.com` against the org in your `.env`. Use a sandbox org. Sub-orgs created during demo sessions are real resources that persist until deleted.

The `/explore` page shows your full org hierarchy and includes a delete button for sub-orgs. Use it to clean up after testing.

---

## Coding conventions

### Use `annotate()` for all request preview fields

Every field in a `buildDisplayRequest` case should be wrapped with `annotate(value, comment)` to give it a tooltip in the UI. The comment should explain what the field does and what values are valid — not just restate the field name.

```ts
// good
walletName: annotate('Main Wallet', 'e.g. "Main Wallet", "Trading Wallet", "Hot Wallet"')

// bad — no annotation
walletName: 'Main Wallet'
```

### Follow the `executeXxx(step, state, override?)` function pattern

Every execute function has exactly the same signature. The `override` parameter must be checked first — it is the entire mechanism the editable request panel uses. Do not selectively merge override fields; either use it entirely or use the defaults:

```ts
const params = (override as any) ?? { ...defaultParams }
```

Always call `trimResponse()` on success and `formatError()` on failure. Always include `request: buildDisplayRequest(step, state)` in both branches so the request panel is populated regardless of outcome.

### Keep catalog entries declarative

`src/lib/catalog.ts` is data only. The `CatalogItem` shape has no callbacks, no conditional logic, and no imports from executor or SDK. If behavior needs to vary based on params, put that in `executor.ts` and pass the relevant config through `StepConfig.params`.

### No logic in `setup-flows.ts`

`parentOrgSteps`, `subOrgSteps`, and `policyManagerSteps` are static arrays of `StepConfig`. `SDK_METHODS` is a static map. Neither file should import from executor, SDK, or catalog.

---

## The override pattern

Every `execute*` function accepts an optional `overrideRequest` that, when provided, is used as the complete params object instead of the function's default params. This is how the UI's editable request panel works:

1. User clicks a step → `/api/preview` returns annotated JSON.
2. User edits the JSON in the panel.
3. User clicks Execute → `/api/execute` is called with `overrideRequest` set to the edited object.
4. The execute function calls `client.someMethod(override)` directly.

The override bypasses default params entirely. This is intentional — the user is explicitly choosing to send a different payload.

---

## PR checklist

- [ ] New `StepKind` values are added to the union in `src/types/scenario.ts`
- [ ] Corresponding `CatalogItem` added to `src/lib/catalog.ts` with accurate `requires`/`provides`
- [ ] `buildDisplayRequest` case added with `annotate()` on all fields
- [ ] `executeXxx()` function follows the standard pattern (override check, trimResponse, formatError)
- [ ] Case added to `executeStep` dispatcher
- [ ] `SDK_METHODS` entry added to `src/lib/setup-flows.ts`
- [ ] `STEP_PRODUCES` updated in `SetupClient.tsx` if the step writes to `SessionState`
- [ ] Tested against a real sandbox org — both preview and execute paths
- [ ] No `console.log` left in production code paths
