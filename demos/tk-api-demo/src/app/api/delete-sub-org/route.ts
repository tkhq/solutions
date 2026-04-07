import { NextResponse } from 'next/server'
import { subOrgClient } from '@/lib/turnkey-client'

export async function POST(req: Request) {
  try {
    const { subOrgId, deleteWithoutExport } = (await req.json()) as {
      subOrgId: string
      deleteWithoutExport: boolean
    }

    if (!subOrgId) {
      return NextResponse.json({ error: 'subOrgId is required' }, { status: 400 })
    }

    const client = subOrgClient(subOrgId)

    const response = await client.deleteSubOrganization({
      organizationId: subOrgId,
      deleteWithoutExport: deleteWithoutExport ?? false,
    })

    return NextResponse.json({ success: true, response })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
