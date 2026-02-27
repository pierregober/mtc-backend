// Vendors
import { scan } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { userId, filter, limit, nextToken } = ctx.args

  const combinedFilter = filter
    ? {
        and: [
          {
            userId: { eq: userId },
          },
          filter,
        ],
      }
    : {
        userId: { eq: userId },
      }

  return scan({
    filter: combinedFilter,
    limit,
    nextToken,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'listInteractionsByUserId')
  }

  const sortDirection = ctx.args?.sortDirection
  const scanIndexForward = sortDirection !== 'DESC'
  const result = ctx.result ?? {}
  const items = Array.isArray(result.items) ? [...result.items] : []

  items.sort((a, b) => {
    const aScheduledAt =
      typeof a?.scheduledAt === 'number' && Number.isFinite(a.scheduledAt)
        ? a.scheduledAt
        : 0
    const bScheduledAt =
      typeof b?.scheduledAt === 'number' && Number.isFinite(b.scheduledAt)
        ? b.scheduledAt
        : 0

    if (aScheduledAt === bScheduledAt) {
      return 0
    }

    return scanIndexForward
      ? aScheduledAt - bScheduledAt
      : bScheduledAt - aScheduledAt
  })

  return {
    ...result,
    items,
  }
}
