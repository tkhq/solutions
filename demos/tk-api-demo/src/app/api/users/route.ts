import { NextResponse } from 'next/server'
import { subOrgClient } from '@/lib/turnkey-client'

function getClient(orgId: string) {
  return subOrgClient(orgId)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  try {
    const response = await getClient(orgId).getUsers({ organizationId: orgId })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = (response.users ?? []).map((u: any) => ({
      id: u.userId,
      name: u.username || u.userName || u.userEmail || u.userId,
    }))
    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
