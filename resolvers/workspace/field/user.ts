// Vendors
import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const userId = typeof ctx.source?.user === 'string' ? ctx.source.user.trim() : ''

  if (!userId) {
    util.error('workspace.user is missing', 'BadRequest', 'workspace.user')
  }

  ctx.stash.userId = userId

  return get({
    key: { id: userId },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'workspace.user')
  }

  return ctx.result?.id ?? ctx.stash.userId
}
