```bash
sudo sls deploy
```

### Below is just SLOP of documentation. More for Pierre to read over and enhance for we eventually get funding 🥲

---

Why does have additional auth in the pipeline resolver stages?

Amplify Gen 2 treats authorization and custom business logic as explicit steps in a pipeline resolver to support more advanced use cases. Here’s the breakdown:

⸻

🔹 preAuthFunction
• Runs before authorization.
• Typically used for early transformations, request validation, logging, or fetching metadata.
• ⚠️ This function runs even if the user is not authenticated.

⸻

🔹 authFunction
• It implements custom, fine-grained access control (beyond what Cognito alone handles).
• Even though you’re using Cognito, Amplify might still enforce owner-based, group-based, or field-level access checks here.
• Example: Check if the caller is the resource owner, or belongs to a group with canReadAuditLogs.

⸻

🔹 postAuthFunction
• Runs after auth checks have passed.
• Used to transform the request before it hits the data source.
• Example: Inject a timestamp, user ID, or log something.

⸻

🔹 DataResolverFn (e.g. QueryGetAuditLogDataResolverFn)
• This is the final function in the pipeline that actually talks to the data source (DynamoDB, Lambda, etc.).

⸻

✅ So, isn’t Cognito enough?

Yes and no:
• Cognito provides the identity (who the user is).
• AppSync’s built-in @auth rules with Cognito can enforce basic auth on fields, types, and operations.
• Amplify Gen 2 enhances this by generating explicit pipeline stages so you can override, inspect, or extend them easily (like custom group logic, dynamic ownership, etc.).

⸻

🧠 Why this design?

This makes Gen 2:
• More modular and predictable
• Easier to override a single step (auth0Function) without redoing the entire resolver
• Future-proof (supports stacking multiple auth providers, like Cognito + IAM + API Key)

Structure of the

Got it — you want these sorted according to their order in an AppSync pipeline resolver, meaning grouped and sequenced logically like this: 1. preAuth0Function 2. init0Function (if present) 3. auth0Function 4. postAuth0Function 5. DataResolverFn

I’ve grouped and ordered each operation’s pipeline sequence accordingly (Create, Update, Delete, Get, List, Subscriptions, Workspace-specific):

⸻

✅ Mutation: createAuditLog 1. MutationcreateAuditLogpreAuth0Function – NONE_DS 2. MutationcreateAuditLoginit0Function – NONE_DS 3. MutationcreateAuditLogauth0Function – NONE_DS 4. MutationcreateAuditLogpostAuth0Function – NONE_DS 5. MutationCreateAuditLogDataResolverFn – auditLogTable

⸻

✅ Mutation: updateAuditLog 1. MutationupdateAuditLogpreAuth0Function – NONE_DS 2. MutationupdateAuditLoginit0Function – NONE_DS 3. MutationupdateAuditLogauth0Function – auditLogTable 4. MutationupdateAuditLogpostAuth0Function – NONE_DS 5. MutationUpdateAuditLogDataResolverFn – auditLogTable

⸻

✅ Mutation: deleteAuditLog 1. MutationdeleteAuditLogpreAuth0Function – NONE_DS 2. MutationdeleteAuditLogauth0Function – auditLogTable 3. MutationdeleteAuditLogpostAuth0Function – NONE_DS 4. MutationDeleteAuditLogDataResolverFn – auditLogTable

⸻

✅ Query: getAuditLog 1. QuerygetAuditLogpreAuth0Function – NONE_DS 2. QuerygetAuditLogauth0Function – NONE_DS 3. QuerygetAuditLogpostAuth0Function – NONE_DS 4. QueryGetAuditLogDataResolverFn – auditLogTable

⸻

✅ Query: listAuditLogs 1. QuerylistAuditLogspreAuth0Function – NONE_DS 2. QuerylistAuditLogsauth0Function – NONE_DS 3. QuerylistAuditLogspostAuth0Function – NONE_DS 4. QueryListAuditLogsDataResolverFn – auditLogTable

⸻

✅ Workspace Audit Logs Resolver
• auditLogworkspaceauth0Function – NONE_DS
• AuditLogWorkspaceDataResolverFn – workspaceTable
• workspaceauditLogsauth0Function – NONE_DS
• WorkspaceAuditLogsDataResolverFn – auditLogTable

⸻

✅ Subscriptions: onCreateAuditLog 1. SubscriptiononCreateAuditLogauth0Function – NONE_DS 2. SubscriptiononCreateAuditLogpostAuth0Function – NONE_DS 3. SubscriptionOnCreateAuditLogDataResolverFn – NONE_DS

⸻

✅ Subscriptions: onUpdateAuditLog 1. SubscriptiononUpdateAuditLogauth0Function – NONE_DS 2. SubscriptiononUpdateAuditLogpostAuth0Function – NONE_DS 3. SubscriptionOnUpdateAuditLogDataResolverFn – NONE_DS

⸻

✅ Subscriptions: onDeleteAuditLog 1. SubscriptiononDeleteAuditLogauth0Function – NONE_DS 2. SubscriptiononDeleteAuditLogpostAuth0Function – NONE_DS 3. SubscriptionOnDeleteAuditLogDataResolverFn – NONE_DS

---

Velocity templates (VTL) are the fastest AppSync resolver option because:
• They’re compiled to native code inside AppSync’s execution engine
• They don’t have the extra JS runtime layer that JavaScript resolvers use

Typical latency
• VTL unit resolver: sub-millisecond processing inside AppSync, plus your data source latency
• JS unit resolver: ~1–5 ms extra overhead compared to VTL
• Lambda: ~15–40 ms warm, 50–300 ms+ cold

Real-world difference (for something like job.company)

If DynamoDB takes 5 ms:
• VTL → ~5 ms total
• JS → ~6–10 ms total
• Lambda (warm) → ~20–50 ms total
• Lambda (cold) → 100 ms+
⸻

# Commands

This plugin provides some useful commands to explore and manage your API.

## `validate-schema`

This commands allows you to validate your GraphQL schema.

```bash
sls appsync validate-schema
```

## `get-introspection`

Allows you to extract the introspection of the schema as a JSON or SDL.

**Options**

- `--format` or `-f`: the format in which to extract the schema. `JSON` or `SDL`. Defaults to `JSON`
- `--output` or `-o`: a file where to output the schema. If not specified, prints to stdout

```bash
sls appsync get-introspection
```

## `flush-cache`

If your API uses the server-side [Caching](caching.md), this command flushes the cache.

```bash
sls appsync flush-cache
```

## `console`

Opens a new browser tab to the AWS console page of this API.

```bash
sls appsync console
```

## `cloudwatch`

Opens a new browser tab to the CloudWatch logs page of this API.

```bash
sls appsync cloudwatch
```

## `logs`

Outputs the logs of the AppSync API to stdout.

**Options**

- `--startTime`: Starting time. You can use human-friendly relative times. e.g. `30m`, `1h`, etc. Default: `10m` (10 minutes ago)
- `--tail` or `-t`: Keep streaming new logs.
- `--interval` or `-i`: Tail polling interval in milliseconds. Default: `1000`.
- `--filter` or `-f`: A filter pattern to apply to the logs stream.

```bash
sls appsync logs --filter '86771d0c-c0f3-4f54-b048-793a233e3ed9'
```

## `domain`

Manage the domain for this AppSync API.

## Create the domain

Before associating a domain to an API, you must first create it. You can do so using the following command.

**Options**

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--stage`: The stage to use

```bash
sls appsync domain create
```

## Delete the domain

Deletes a domain from AppSync.

**Options**

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--yes` or `-y`: Automatic yes to prompts
- `--stage`: The stage to use

```bash
sls appsync domain delete
```

If an API is associated to it, you will need to [disassociate](#disassociate-the-api-from-the-domain) it first.

## Create a route53 record

If you use Route53 for your hosted zone, you can also create the required CNAME record for your custom domain.

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--stage`: The stage to use

```bash
sls appsync domain create-record
```

## Delete the route53 record

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--yes` or `-y`: Automatic yes to prompts
- `--stage`: The stage to use

```bash
sls appsync domain delete-record
```

## Associate the API to the domain

Associate the API in this stack to the domain.

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--stage`: The stage to use

```bash
sls appsync domain assoc --stage dev
```

You can associate an API to a domain that already has another API attached to it. The old API will be replaced by the new one.

## Disassociate the API from the domain

- `--quiet` or `-q`: Don't return an error if the operation fails
- `--yes` or `-y`: Automatic yes to prompts
- `--stage`: The stage to use

```bash
sls appsync domain disassoc --stage dev
```
