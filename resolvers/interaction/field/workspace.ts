// Vendors
import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

const MISSING_WORKSPACE_ID = '__MISSING_INTERACTION_WORKSPACE__'

export function request(ctx: Context) {
  const workspaceId =
    typeof ctx.source?.workspaceId === 'string'
      ? ctx.source.workspaceId.trim()
      : ''

  ctx.stash.workspaceId = workspaceId

  return get({
    key: { id: workspaceId || MISSING_WORKSPACE_ID },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'interaction.workspace')
  }

  if (!ctx.stash.workspaceId) {
    return null
  }

  return ctx.result ?? null
}
