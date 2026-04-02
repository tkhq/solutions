import { scenario as addressAllowlist } from './address-allowlist'
import { scenario as walletInspection } from './wallet-inspection'
import { scenario as rawPayloadSigning } from './raw-payload-signing'
import type { Scenario } from '../src/types/scenario'

export const scenarios: Scenario[] = [addressAllowlist, walletInspection, rawPayloadSigning]
