// Vendors
import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

const MISSING_CLIENT_ID = '__MISSING_INTERACTION_CLIENT__'

export function request(ctx: Context) {
  const clientId =
    typeof ctx.source?.clientId === 'string' ? ctx.source.clientId.trim() : ''

  ctx.stash.clientId = clientId

  return get({
    key: { id: clientId || MISSING_CLIENT_ID },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'interaction.client')
  }

  if (!ctx.stash.clientId) {
    return null
  }

  return ctx.result ?? null
}
