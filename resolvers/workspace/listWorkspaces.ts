// Vendors
import { query, scan } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { id, filter, limit, nextToken } = ctx.args

  if (id) {
    return query({
      query: { id: { eq: id } },
      filter,
      limit,
      nextToken,
    })
  }

  return scan({
    filter,
    limit,
    nextToken,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'listWorkspaces')
  }
  return ctx.result
}
