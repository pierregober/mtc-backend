// Vendors
import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const workspaceId =
    typeof ctx.source?.workspace === 'string' ? ctx.source.workspace.trim() : ''

  if (!workspaceId) {
    util.error('user.workspace is missing', 'BadRequest', 'user.workspace')
  }

  ctx.stash.workspaceId = workspaceId

  return get({
    key: { id: workspaceId },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'user.workspace')
  }

  return ctx.result?.id ?? ctx.stash.workspaceId
}
