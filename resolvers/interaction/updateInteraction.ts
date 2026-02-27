// Vendors
import { update } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Helpers
import { sanitizeObject } from '../_shared'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { input, condition } = ctx.args
  const now = util.time.nowEpochSeconds()
  const { id, ...rest } = input

  const updateObject = sanitizeObject({
    ...rest,
    updatedAt: now,
  })

  return update({
    key: { id },
    condition,
    update: updateObject,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'updateInteraction')
  }
  return ctx.result
}
