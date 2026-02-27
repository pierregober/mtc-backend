// Vendors
import { query } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { clientId, filter, limit, nextToken, sortDirection } = ctx.args

  return query({
    index: 'byClientId',
    query: { clientId: { eq: clientId } },
    filter,
    limit,
    nextToken,
    scanIndexForward: sortDirection !== 'DESC',
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'listInteractionsByClientId')
  }
  return ctx.result
}
