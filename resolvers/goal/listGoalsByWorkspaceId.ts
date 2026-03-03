import { query } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { workspaceId, type, filter, limit, nextToken, sortDirection } = ctx.args

  let nonKeyFilter = filter

  if (type) {
    nonKeyFilter = {
      ...(filter ?? {}),
      type: { eq: type },
    }
  }

  const queryInput = {
    workspaceId: { eq: workspaceId },
  }

  return query({
    index: 'goalByWorkspace',
    query: queryInput,
    filter: nonKeyFilter,
    limit,
    nextToken,
    scanIndexForward: sortDirection !== 'DESC',
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'listGoalsByWorkspaceId')
  }
  return ctx.result
}
