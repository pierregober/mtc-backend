import { put } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

import { sanitizeObject } from '../_shared'

import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { input, condition } = ctx.args
  const now = util.time.nowEpochSeconds()
  const id = `MESSAGE-${util.autoId()}`

  const item = sanitizeObject({
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
  })

  return put({
    key: { id: item.id },
    condition,
    item,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'createMessage')
  }
  return ctx.result
}
