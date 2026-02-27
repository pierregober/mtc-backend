// Vendors
import { remove } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  const { input, condition } = ctx.args

  return remove({
    key: { id: input.id },
    condition,
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'deleteWorkspace')
  }
  return ctx.result
}
