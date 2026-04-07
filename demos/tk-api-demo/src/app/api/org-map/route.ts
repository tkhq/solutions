import { NextResponse } from 'next/server'
import { parentClient, subOrgClient } from '@/lib/turnkey-client'

const MAX_SUB_ORGS = 24

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

export async function GET() {
  try {
    const client = parentClient()
    const orgId = process.env.ORGANIZATION_ID!

    const [whoamiR, usersR, policiesR, userTagsR, pkTagsR, subOrgIdsR] =
      await Promise.allSettled([
        client.getWhoami({ organizationId: orgId }),
        client.getUsers({ organizationId: orgId }),
        client.getPolicies({ organizationId: orgId }),
        client.listUserTags({ organizationId: orgId }),
        client.listPrivateKeyTags({ organizationId: orgId }),
        client.getSubOrgIds({ organizationId: orgId }),
      ])

    const parentName =
      whoamiR.status === 'fulfilled' ? whoamiR.value.organizationName : orgId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentUsers = settled(usersR, { users: [] as any[] }).users ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentPolicies = settled(policiesR, { policies: [] as any[] }).policies ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userTags = settled(userTagsR, { userTags: [] as any[] }).userTags ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkTags = settled(pkTagsR, { privateKeyTags: [] as any[] }).privateKeyTags ?? []
    const subOrgIds = settled(subOrgIdsR, { organizationIds: [] }).organizationIds ?? []

    const idsToFetch = subOrgIds.slice(0, MAX_SUB_ORGS)

    const subOrgResults = await Promise.allSettled(
      idsToFetch.map(async (id) => {
        const c = subOrgClient(id)
        const [nameR, usersSubR, policiesSubR, walletsSubR] = await Promise.allSettled([
          c.getWhoami({ organizationId: id }),
          c.getUsers({ organizationId: id }),
          c.getPolicies({ organizationId: id }),
          c.getWallets({ organizationId: id }),
        ])
        return {
          id,
          name:
            nameR.status === 'fulfilled'
              ? nameR.value.organizationName
              : `Sub-Org ${id.slice(0, 8)}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          users: settled(usersSubR, { users: [] as any[] }).users ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          policies: settled(policiesSubR, { policies: [] as any[] }).policies ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wallets: settled(walletsSubR, { wallets: [] as any[] }).wallets ?? [],
        }
      })
    )

    const subOrgs = subOrgResults
      .filter((r) => r.status === 'fulfilled')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r) => (r as PromiseFulfilledResult<any>).value)

    return NextResponse.json({
      parentOrg: {
        id: orgId,
        name: parentName,
        users: parentUsers,
        policies: parentPolicies,
        userTags,
        privateKeyTags: pkTags,
        totalSubOrgs: subOrgIds.length,
      },
      subOrgs,
      fetchedSubOrgCount: idsToFetch.length,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
