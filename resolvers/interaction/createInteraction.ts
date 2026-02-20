// Vendors
import { put } from '@aws-appsync/utils/dynamodb'
import { util } from '@aws-appsync/utils';

// Helpers
import { sanitizeObject } from '../_shared';

// Types
import type { Context } from "@aws-appsync/utils"

export function request(ctx: Context) {
  const input = ctx.args.input;
  const now = util.time.nowEpochSeconds();
  const id = `INTERACTION-${util.autoId()}`;

  const item = sanitizeObject({
    id,
    createdAt: now,
    updatedAt: now,
    ...input,
  });

  return put({
    key: { id: item.id },
    condition: ctx.args.condition,
    item
  });
}

export function response(ctx: Context) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, "createInteraction");
  }

  console.log(ctx.result);
  /*
    {
      "createdAt": 1754414426,
      "companyId": "dd",
      "id": "JOB-d18c42f6-7961-43d3-8155-cfee342d2c8b",
      "user": "USER-google-oauth2|105810845156120758169",
      "updatedAt": 1754414426,
      "workspaceId": "ddd"
    }
  */

  return ctx.result
}