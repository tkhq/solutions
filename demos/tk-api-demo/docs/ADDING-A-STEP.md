# Adding a Step

This is the checklist for adding a new `StepKind` — a new Turnkey API operation that can appear in any scenario or catalog flow. Each item includes the exact file to edit and what to add.

---

## Checklist

### 1. Add to `StepKind` in `src/types/scenario.ts`

Append to the union. Place it in the appropriate comment group (Create, Sign, Update, Delete, or Queries):

```ts
export type StepKind =
  // ...existing kinds...
  | 'LIST_ACTIVITIES'   // existing
  | 'MY_NEW_OPERATION'  // add here
```

---

### 2. Add a `CatalogItem` to `src/lib/catalog.ts`

Add an entry to the `CATALOG` array. All fields are required:

```ts
{
  id: 'my-new-operation',           // unique slug, kebab-case
  kind: 'MY_NEW_OPERATION',         // must match the StepKind you just added
  title: 'My New Operation',        // shown in catalog list and step chips
  description: 'One sentence.',     // shown in the catalog detail panel
  params: { someOption: true },     // optional — forwarded to executor
  category: 'query',                // 'activity' for state-mutating, 'query' for read-only
  apiCall: 'my_api_endpoint',       // snake_case Turnkey endpoint name
  docs: 'https://docs.turnkey.com/api-reference/...', // link to Turnkey docs page
  requires: ['subOrgId'],           // SessionState keys that must exist before this step runs
  provides: ['someNewId'],          // SessionState keys this step sets on success ([] if none)
},
```

The `requires`/`provides` arrays are the entire dependency contract. The catalog UI uses them to enable or disable the "Add" button and to show "you need X first" hints.

---

### 3. Add a case to `buildDisplayRequest` in `src/lib/executor.ts`

The switch block starts at line 111. Add a case that returns an annotated request object. Use `annotate(value, comment)` on every field so the UI panel shows inline tooltips:

```ts
case 'MY_NEW_OPERATION':
  return {
    organizationId: annotate(
      state.subOrgId ?? process.env.ORGANIZATION_ID,
      'the org to run this against'
    ),
    someField: annotate('example-value', 'what this field does'),
  }
```

This function is synchronous and must never call the SDK. It runs on every preview load.

---

### 4. Add a private `executeMyNewOperation()` in `src/lib/executor.ts`

Follow the standard pattern exactly. Add it alongside the other `execute*` functions:

```ts
async function executeMyNewOperation(
  step: StepConfig,
  state: SessionState,
  override?: Record<string, unknown>
): Promise<StepResult> {
  const client = state.subOrgId ? subOrgClient(state.subOrgId) : parentClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (override as any) ?? {
    organizationId: state.subOrgId ?? process.env.ORGANIZATION_ID!,
    someField: 'example-value',
  }
  try {
    const response = await client.myNewOperation(params)
    return {
      success: true,
      request: buildDisplayRequest(step, state),
      response: trimResponse(response),
      updatedState: {
        ...state,
        someNewId: response.someNewId,  // only if this step produces state
      },
    }
  } catch (error) {
    return {
      success: false,
      request: buildDisplayRequest(step, state),
      response: formatError(error),
      updatedState: state,
    }
  }
}
```

Key rules:
- Always pass `override` as the params when present — this is how the UI's editable request panel works.
- Use `trimResponse()` on the API response to strip noisy fields (`votes`, `fingerprint`, etc.).
- Use `formatError()` in the catch block so errors render in the JSON inspector instead of crashing.
- Set `expectedFailure: true` in the return if the step is designed to demonstrate a policy rejection.

---

### 5. Add the case to the `executeStep` dispatcher in `src/lib/executor.ts`

The `executeStep` switch block starts around line 565. Add:

```ts
case 'MY_NEW_OPERATION':
  return executeMyNewOperation(step, state, ov)
```

TypeScript will warn if you add to the `StepKind` union but miss a case here — the switch is exhaustive.

---

### 6. If the step produces session state, add to `STEP_PRODUCES` in `src/app/setup/SetupClient.tsx`

`STEP_PRODUCES` (around line 25) drives the Skip feature. When a user skips a step, SetupClient reads this map to know which fields to accept as manual input:

```ts
const STEP_PRODUCES: Partial<Record<StepKind, (keyof SessionState)[]>> = {
  // ...existing entries...
  MY_NEW_OPERATION: ['someNewId'],
}
```

Only add this if your step produces a `SessionState` key. Read-only queries that produce nothing can be omitted.

If the key `someNewId` doesn't already exist in `SessionState`, add it to the interface in `src/types/scenario.ts` first.

---

### 7. Add the SDK method name to `SDK_METHODS` in `src/lib/setup-flows.ts`

`SDK_METHODS` maps `StepKind` → `@turnkey/sdk-server` method name. This drives the code-snippet panel in SetupClient:

```ts
export const SDK_METHODS: Record<string, string> = {
  // ...existing entries...
  MY_NEW_OPERATION: 'myNewOperation',
}
```

---

## End-to-end example: `LIST_ACTIVITIES`

`LIST_ACTIVITIES` is a read-only query that already exists in the codebase. It illustrates exactly what a minimal query step looks like.

**`src/types/scenario.ts`** — already in the union:
```ts
| 'LIST_ACTIVITIES'
```

**`src/lib/catalog.ts`** — entry:
```ts
{
  id: 'list-activities',
  kind: 'LIST_ACTIVITIES',
  title: 'List Activities',
  description: 'Return recent activities (signed requests) in the sub-org.',
  category: 'query',
  apiCall: 'get_activities',
  docs: 'https://docs.turnkey.com/api-reference/queries/list-activities',
  requires: ['subOrgId'],
  provides: [],
},
```

**`src/lib/executor.ts`** — display request:
```ts
case 'LIST_ACTIVITIES':
  return {
    organizationId: state.subOrgId ?? annotate('<subOrgId>', 'from create sub-org step'),
    paginationOptions: annotate({ limit: '10' }, 'optional — omit to get all activities'),
  }
```

**`src/lib/executor.ts`** — execute function:
```ts
async function executeListActivities(step, state, override) {
  const client = subOrgClient(state.subOrgId!)
  const params = override ?? { organizationId: state.subOrgId! }
  try {
    const response = await client.getActivities(params)
    return { success: true, request: buildDisplayRequest(step, state),
             response: trimResponse(response), updatedState: state }
  } catch (error) {
    return { success: false, request: buildDisplayRequest(step, state),
             response: formatError(error), updatedState: state }
  }
}
```

**`src/lib/setup-flows.ts`** — SDK method:
```ts
LIST_ACTIVITIES: 'getActivities',
```

No `STEP_PRODUCES` entry needed because `LIST_ACTIVITIES` returns `provides: []`.
