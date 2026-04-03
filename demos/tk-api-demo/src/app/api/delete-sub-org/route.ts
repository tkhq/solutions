import { NextResponse } from 'next/server'
import { Turnkey } from '@turnkey/sdk-server'

function subOrgClient(subOrgId: string) {
  return new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: subOrgId,
  }).apiClient()
}

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
