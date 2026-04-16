// Vendors
import { query, scan } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'
import { normalizeContractInteraction } from './helpers'

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
    util.error(ctx.error.message, ctx.error.type, 'listInteractions')
  }

  if (!ctx.result?.items) {
    return ctx.result
  }

  return {
    ...ctx.result,
    items: ctx.result.items.map((item) => normalizeContractInteraction(item)),
  }
}
