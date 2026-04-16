// Vendors
import { scan } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'
import { normalizeContractInteraction } from './helpers'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { userId, filter, limit, nextToken } = ctx.args

  let combinedFilter
  if (filter) {
    combinedFilter = {
      and: [
        {
          userId: { eq: userId },
        },
        filter,
      ],
    }
  } else {
    combinedFilter = {
      userId: { eq: userId },
    }
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

  if (!ctx.result?.items) {
    return ctx.result
  }

  return {
    ...ctx.result,
    items: ctx.result.items.map((item) => normalizeContractInteraction(item)),
  }
}
