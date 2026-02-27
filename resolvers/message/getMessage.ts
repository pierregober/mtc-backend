import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'

import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  return get({
    key: { id: ctx.args.id },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'getMessage')
  }
  return ctx.result
}
