/**
 * Turnkey API client factories.
 *
 * All server-side Turnkey SDK calls go through one of three client contexts:
 *   - parentClient()    — acts as the root parent org
 *   - subOrgClient()    — acts as a specific sub-org (using parent credentials)
 *   - apiUserClient()   — acts as an ephemeral API user created during setup
 *
 * Credentials are read from environment variables (API_PUBLIC_KEY,
 * API_PRIVATE_KEY, ORGANIZATION_ID). These are never exposed to the browser.
 */
import { Turnkey } from '@turnkey/sdk-server'

/** Returns an API client scoped to the parent/root organization. */
export function parentClient() {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  }).apiClient()
}

/** Returns an API client scoped to a specific sub-organization.
 *  Uses the parent org's API credentials — the parent has root access to all sub-orgs it creates. */
export function subOrgClient(subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: subOrgId,
  }).apiClient()
}

/**
 * Returns an API client for an ephemeral API user created during sub-org setup.
 * Uses the generated key pair rather than the server's root credentials.
 *
 * @param publicKey - P256 public key of the API user (hex string).
 * @param privateKey - P256 private key of the API user (hex string). Handle with care.
 * @param subOrgId  - Organization ID that this API user belongs to.
 */
export function apiUserClient(publicKey: string, privateKey: string, subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: publicKey,
    apiPrivateKey: privateKey,
    defaultOrganizationId: subOrgId,
  }).apiClient()
}

// Cache the parent org name so we only call getWhoami once per server process.
let _parentOrgName: string | null = null

/** Returns the cached parent org name synchronously, or null if not yet fetched. */
export function getCachedParentOrgName(): string | null {
  return _parentOrgName
}

/**
 * Fetches and caches the parent organization's display name via `getWhoami`.
 *
 * On success the name is stored in `_parentOrgName` for the lifetime of the
 * server process.  On failure (e.g. invalid credentials during local dev)
 * it falls back to `"Demo"` so the UI still renders without crashing.
 */
export async function getParentOrgName(): Promise<string> {
  if (_parentOrgName) return _parentOrgName
  try {
    const r = await parentClient().getWhoami({ organizationId: process.env.ORGANIZATION_ID! })
    _parentOrgName = r.organizationName ?? 'Demo'
  } catch {
    _parentOrgName = 'Demo'
  }
  return _parentOrgName
}
