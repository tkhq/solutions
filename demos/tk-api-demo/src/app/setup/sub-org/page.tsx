import SetupClient from '@/app/setup/SetupClient'
import { subOrgSteps } from '@/lib/setup-flows'

export default function SubOrgSetupPage() {
  return <SetupClient steps={subOrgSteps} flowId="sub-org" />
}
