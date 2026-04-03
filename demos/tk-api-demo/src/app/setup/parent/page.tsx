import SetupClient from '@/app/setup/SetupClient'
import { parentOrgSteps } from '@/lib/setup-flows'

export default function ParentSetupPage() {
  return <SetupClient steps={parentOrgSteps} flowId="parent" />
}
