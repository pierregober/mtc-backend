// Vendors
import { put } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils';

// Helpers
import { sanitizeObject } from '../_shared';

// Types
import type { Context } from "@aws-appsync/utils"

export function request(ctx: Context) {
  const input = ctx.args.input
  const now = util.time.nowEpochSeconds()
  const id = `INTERACTION-${util.autoId()}`

  const clientId =
    typeof input?.clientId === 'string' ? input.clientId.trim() : ''

  if (!clientId) {
    util.error(
      'createInteraction requires input.clientId',
      'BadRequest',
      'createInteraction',
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
    item
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, "createInteraction")
  }

  return ctx.result
}
