// Vendors
import { extensions, util } from '@aws-appsync/utils'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(_ctx: Context) {
  return { payload: null }
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'onUpdateUser')
  }

  if (ctx.args.filter) {
    extensions.setSubscriptionFilter(
      util.transform.toSubscriptionFilter(ctx.args.filter),
    )
  }

  return null
}
