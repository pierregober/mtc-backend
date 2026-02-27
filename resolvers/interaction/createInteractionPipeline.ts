// Vendors
import { util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(_ctx: Context) {
  return {}
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'createInteraction')
  }

  return ctx.prev.result
}
