// Vendors
import { put } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Helpers
import { sanitizeObject } from '../_shared'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { input } = ctx.args
  const now = util.time.nowEpochSeconds()

  const username =
    typeof input?.username === 'string' && input.username.trim()
      ? input.username.trim()
      : null

  if (!username) {
    util.error('Username is required.', 'BadRequest', 'createUserName')
  }

  const item = sanitizeObject({
    ...input,
    id: username,
    username,
    createdAt: now,
    updatedAt: now,
  })

  return put({
    key: { id: item.id },
    condition: {
      id: {
        attributeExists: false,
      },
    },
    item,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'createUserName')
  }
  return ctx.result
}
