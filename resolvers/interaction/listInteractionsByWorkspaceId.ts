// Vendors
import { query } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { workspaceId, filter, limit, nextToken, sortDirection } = ctx.args

  let scheduledAt
  let nonKeyFilter = filter

  if (filter && filter.scheduledAt) {
    scheduledAt = filter.scheduledAt

    const rest = {}
    for (const key in filter) {
      if (key !== 'scheduledAt') {
        rest[key] = filter[key]
      }
    }

    if (Object.keys(rest).length > 0) {
      nonKeyFilter = rest
    } else {
      nonKeyFilter = undefined
    }
  }

  const queryInput = {
    workspaceId: { eq: workspaceId },
  }

  if (scheduledAt) {
    queryInput.scheduledAt = scheduledAt
  }

  return query({
    index: 'interactionByWorkspace',
    query: queryInput,
    filter: nonKeyFilter,
    limit,
    nextToken,
    scanIndexForward: sortDirection !== 'DESC',
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'listInteractionsByWorkspaceId')
  }
  return ctx.result
}
