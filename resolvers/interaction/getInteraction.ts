// Vendors
import { get } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils'
import { normalizeContractInteraction } from './helpers'

// Types
import type { Context } from '@aws-appsync/utils'

export function request(ctx: Context) {
  return get({
    key: { id: ctx.args.id },
  })
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, 'getInteraction')
  }
  if (!ctx.result) {
    return ctx.result
  }

  return normalizeContractInteraction(ctx.result)
}
