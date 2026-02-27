// Vendors
import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

const MISSING_USER_ID = '__MISSING_INTERACTION_USER__'

export function request(ctx: Context) {
  const userId =
    typeof ctx.source?.userId === 'string' ? ctx.source.userId.trim() : ''

  ctx.stash.userId = userId

  return get({
    key: { id: userId || MISSING_USER_ID },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'interaction.user')
  }

  if (!ctx.stash.userId) {
    return null
  }

  return ctx.result ?? null
}
