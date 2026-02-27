// Vendors
import { put } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Helpers
import { sanitizeObject } from '../resolvers/_shared'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const input = ctx.args.input ?? {}
  const now = util.time.nowEpochSeconds()
  const id = `INTERACTION-${util.autoId()}`

  const resolvedClientId =
    typeof ctx.stash.resolvedClientId === 'string' && ctx.stash.resolvedClientId
      ? ctx.stash.resolvedClientId
      : null

  const inputClientId =
    typeof input.clientId === 'string' && input.clientId.trim()
      ? input.clientId.trim()
      : null

  const clientId = resolvedClientId ?? inputClientId

  if (!clientId) {
    util.error(
      'createInteraction failed to resolve a clientId',
      'BadRequest',
      'createInteraction.createInteractionRecord',
    )
  }

  const { clientName, ...restInput } = input

  const item = sanitizeObject({
    id,
    createdAt: now,
    updatedAt: now,
    ...restInput,
    clientId,
  })

  return put({
    key: { id: item.id },
    condition: ctx.args.condition,
    item,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(
      ctx.error.message,
      ctx.error.type,
      'createInteraction.createInteractionRecord',
    )
  }

  return ctx.result
}
