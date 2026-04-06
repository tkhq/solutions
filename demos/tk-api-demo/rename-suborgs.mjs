// rename-suborgs.mjs
// Renames all sub-orgs based on their root user's name.
// Usage: node rename-suborgs.mjs
//   or:  node rename-suborgs.mjs --dry-run

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Turnkey } from '@turnkey/sdk-server'

// ── Load .env ───────────────────────────────────────────────────────────────
try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('Could not load .env — make sure you run this from the project root.')
  process.exit(1)
}

const { API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID } = process.env
if (!API_PUBLIC_KEY || !API_PRIVATE_KEY || !ORGANIZATION_ID) {
  console.error('Missing API_PUBLIC_KEY, API_PRIVATE_KEY, or ORGANIZATION_ID in .env')
  process.exit(1)
}

const NAME = process.env.RENAME_PREFIX || 'Sam'
const DRY_RUN = process.argv.includes('--dry-run')
if (DRY_RUN) console.log('🔍 Dry run — no changes will be made\n')

// ── Clients ─────────────────────────────────────────────────────────────────
function makeClient(orgId) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: API_PUBLIC_KEY,
    apiPrivateKey: API_PRIVATE_KEY,
    defaultOrganizationId: orgId,
  }).apiClient()
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// ── Main ─────────────────────────────────────────────────────────────────────
const parent = makeClient(ORGANIZATION_ID)

console.log('Fetching sub-orgs...')
const { organizationIds } = await parent.getSubOrgIds({ organizationId: ORGANIZATION_ID })
console.log(`Found ${organizationIds.length} sub-org(s)\n`)

if (organizationIds.length === 0) {
  console.log('Nothing to rename.')
  process.exit(0)
}

// Assign sequential numbers to all sub-orgs
const orgs = organizationIds.map((id, i) => ({
  id,
  newName: `${NAME} Sub Org ${String(i + 1).padStart(3, '0')}`,
}))

// Preview
console.log('Planned renames:')
for (const org of orgs) {
  console.log(`  ${org.id.slice(0, 8)}…  →  "${org.newName}"`)
}
console.log()

if (DRY_RUN) {
  console.log('Dry run complete — rerun without --dry-run to apply.')
  process.exit(0)
}

// Apply
let ok = 0, fail = 0
for (const org of orgs) {
  try {
    const client = makeClient(org.id)
    await client.updateOrganizationName({
      organizationId: org.id,
      organizationName: org.newName,
    })
    console.log(`  ✓ "${org.newName}"`)
    ok++
  } catch (e) {
    console.error(`  ✗ ${org.id.slice(0, 8)}…  failed: ${e.message}`)
    fail++
  }
}

console.log(`\nDone — ${ok} renamed, ${fail} failed.`)
