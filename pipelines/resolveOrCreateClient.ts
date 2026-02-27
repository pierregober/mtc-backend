// Vendors
import { get, put } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Helpers
import { sanitizeObject } from '../resolvers/_shared'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const input = ctx.args.input ?? {}

  const clientId =
    typeof input.clientId === 'string' && input.clientId.trim()
      ? input.clientId.trim()
      : null

  if (clientId) {
    ctx.stash.resolvedClientId = clientId

    return get({
      key: { id: clientId },
    })
  }

  const clientName =
    typeof input.clientName === 'string' ? input.clientName.trim() : ''
  const workspaceId =
    typeof input.workspaceId === 'string' ? input.workspaceId.trim() : ''
  const userId = typeof input.userId === 'string' ? input.userId.trim() : ''

  if (!clientName) {
    util.error(
      'createInteraction requires either input.clientId or input.clientName',
      'BadRequest',
      'createInteraction.resolveOrCreateClient',
    )
  }

  if (!workspaceId) {
    util.error(
      'createInteraction requires input.workspaceId when creating a client',
      'BadRequest',
      'createInteraction.resolveOrCreateClient',
    )
  }

  if (!userId) {
    util.error(
      'createInteraction requires input.userId when creating a client',
      'BadRequest',
      'createInteraction.resolveOrCreateClient',
    )
  }

  const now = util.time.nowEpochSeconds()
  const generatedClientId = `CLIENT-${util.autoId()}`

  ctx.stash.resolvedClientId = generatedClientId

  const item = sanitizeObject({
    id: generatedClientId,
    name: clientName,
    userId,
    dashboard: workspaceId,
    status: 'Active',
    createdAt: now,
    updatedAt: now,
  })

  return put({
    key: { id: generatedClientId },
    item,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(
      ctx.error.message,
      ctx.error.type,
      'createInteraction.resolveOrCreateClient',
    )
  }

  const input = ctx.args.input ?? {}
  const requestedClientId =
    typeof input.clientId === 'string' && input.clientId.trim()
      ? input.clientId.trim()
      : null

  if (requestedClientId && !ctx.result) {
    util.error(
      "createInteraction received a clientId that doesn't exist",
      'NotFound',
      'createInteraction.resolveOrCreateClient',
    )
  }

  return {
    clientId: ctx.stash.resolvedClientId,
  }
}
