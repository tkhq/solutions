import { NextResponse } from 'next/server'
import { Turnkey } from '@turnkey/sdk-server'

function getClient(orgId: string) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: orgId,
  }).apiClient()
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  try {
    const response = await getClient(orgId).getPolicies({ organizationId: orgId })
    return NextResponse.json({ policies: response.policies ?? [] })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { orgId, policyName, effect, condition, consensus, notes } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  try {
    const response = await getClient(orgId).createPolicy({
      organizationId: orgId,
      policyName: policyName ?? 'New Policy',
      effect: effect ?? 'EFFECT_ALLOW',
      condition: condition ?? '',
      consensus: consensus ?? '',
      notes: notes ?? '',
    })
    return NextResponse.json({ policyId: response.policyId })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { orgId, policyId, policyName, effect, condition, consensus, notes } = await req.json()
  if (!orgId || !policyId) return NextResponse.json({ error: 'orgId and policyId required' }, { status: 400 })
  try {
    const response = await getClient(orgId).updatePolicy({
      organizationId: orgId,
      policyId,
      policyName,
      policyEffect: effect,
      policyCondition: condition ?? '',
      policyConsensus: consensus ?? '',
      policyNotes: notes ?? '',
    })
    return NextResponse.json({ policyId: response.policyId })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { orgId, policyId } = await req.json()
  if (!orgId || !policyId) return NextResponse.json({ error: 'orgId and policyId required' }, { status: 400 })
  try {
    const response = await getClient(orgId).deletePolicy({ organizationId: orgId, policyId })
    return NextResponse.json({ policyId: response.policyId })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
