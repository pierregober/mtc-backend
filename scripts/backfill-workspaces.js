#!/usr/bin/env node
"use strict";

const AWS = require("aws-sdk");

const DEFAULT_REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-1";
const DEFAULT_USER_TABLE = process.env.USER_TABLE_NAME || "mtc-prod-user";
const DEFAULT_WORKSPACE_TABLE =
  process.env.WORKSPACE_TABLE_NAME || "mtc-prod-workspace";

const args = parseArgs(process.argv);
const region = getArgValue(args, "region", DEFAULT_REGION);
const userTableName = getArgValue(args, "user-table", DEFAULT_USER_TABLE);
const workspaceTableName = getArgValue(
  args,
  "workspace-table",
  DEFAULT_WORKSPACE_TABLE,
);
const applyWrites = hasFlag(args, "apply");
const includeTitle = hasFlag(args, "title-from-owner");
const emitPartiql = hasFlag(args, "emit-partiql");

AWS.config.update({
  region,
});

const documentClient = new AWS.DynamoDB.DocumentClient({
  convertEmptyValues: true,
  maxRetries: 10,
});

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  const positionals = [];

  for (let index = 2; index < argv.length; index += 1) {
    const entry = argv[index];

    if (!entry.startsWith("--")) {
      positionals.push(entry);
      continue;
    }

    const raw = entry.slice(2);
    const equalsIndex = raw.indexOf("=");

    if (equalsIndex === -1) {
      flags.add(raw);
      continue;
    }

    values.set(raw.slice(0, equalsIndex), raw.slice(equalsIndex + 1));
  }

  return { flags, values, positionals };
}

function getArgValue(args, key, fallback) {
  return args.values.has(key) ? args.values.get(key) : fallback;
}

function hasFlag(args, key) {
  return args.flags.has(key);
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeEpochSeconds(value) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function formatEpochSeconds(value) {
  const normalized = normalizeEpochSeconds(value);

  if (normalized === null) {
    return "n/a";
  }

  const date = new Date(normalized * 1000);

  if (Number.isNaN(date.getTime())) {
    return String(normalized);
  }

  return `${date.toISOString()} (${normalized})`;
}

function escapePartiqlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function toPartiqlValue(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return `'${escapePartiqlString(value)}'`;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => toPartiqlValue(entry)).join(", ")}]`;
  }

  if (typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .map(
        ([key, nestedValue]) =>
          `'${escapePartiqlString(key)}': ${toPartiqlValue(nestedValue)}`,
      )
      .join(", ")}}`;
  }

  return "null";
}

function buildInsertStatement(tableName, item) {
  return `INSERT INTO "${tableName}" VALUE ${toPartiqlValue(item)}`;
}

function buildWorkspaceTitle(owner) {
  const fullName = [owner.firstName, owner.lastName]
    .map(normalizeString)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  const email = normalizeString(owner.email);
  if (email) {
    return email.split("@")[0] || email;
  }

  return "";
}

async function scanAll(tableName, options = {}) {
  const items = [];
  let lastEvaluatedKey;

  do {
    const response = await documentClient
      .scan({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
        ...options,
      })
      .promise();

    if (Array.isArray(response.Items) && response.Items.length > 0) {
      items.push(...response.Items);
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

async function getWorkspaceById(workspaceId) {
  const response = await documentClient
    .get({
      TableName: workspaceTableName,
      Key: {
        id: workspaceId,
      },
      ConsistentRead: true,
      ProjectionExpression: "#id",
      ExpressionAttributeNames: {
        "#id": "id",
      },
    })
    .promise();

  return response.Item ?? null;
}

function pickWorkspaceOwner(currentOwner, candidate) {
  const currentCreatedAt =
    normalizeEpochSeconds(currentOwner.createdAt) ?? Number.POSITIVE_INFINITY;
  const candidateCreatedAt =
    normalizeEpochSeconds(candidate.createdAt) ?? Number.POSITIVE_INFINITY;

  if (candidateCreatedAt < currentCreatedAt) {
    return candidate;
  }

  if (candidateCreatedAt > currentCreatedAt) {
    return currentOwner;
  }

  const currentUserId = normalizeString(currentOwner.userId);
  const candidateUserId = normalizeString(candidate.userId);

  if (!currentUserId) {
    return candidate;
  }

  if (!candidateUserId) {
    return currentOwner;
  }

  return candidateUserId.localeCompare(currentUserId) < 0
    ? candidate
    : currentOwner;
}

function toUserRecord(item) {
  const userId = normalizeString(item.id);
  const workspaceId = normalizeString(item.workspace);

  if (!userId || !workspaceId) {
    return null;
  }

  return {
    userId,
    workspaceId,
    email: normalizeString(item.email),
    firstName: normalizeString(item.firstName),
    lastName: normalizeString(item.lastName),
    createdAt: normalizeEpochSeconds(item.createdAt),
    updatedAt: normalizeEpochSeconds(item.updatedAt),
  };
}

function groupUsersByWorkspace(users) {
  const grouped = new Map();

  for (const item of users) {
    const user = toUserRecord(item);

    if (!user) {
      continue;
    }

    const entry = grouped.get(user.workspaceId);
    if (!entry) {
      grouped.set(user.workspaceId, {
        owner: user,
        members: [user],
      });
      continue;
    }

    entry.members.push(user);
    entry.owner = pickWorkspaceOwner(entry.owner, user);
  }

  return grouped;
}

async function putWorkspaceRecord(item) {
  try {
    await documentClient
      .put({
        TableName: workspaceTableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(#id)",
        ExpressionAttributeNames: {
          "#id": "id",
        },
      })
      .promise();

    return { status: "created" };
  } catch (error) {
    if (error?.code === "ConditionalCheckFailedException") {
      return { status: "skipped-existing" };
    }

    throw error;
  }
}

async function main() {
  console.log(
    `Scanning users from ${userTableName} and workspaces from ${workspaceTableName} in ${region}`,
  );
  console.log(
    applyWrites
      ? "Mode: apply"
      : "Mode: dry-run (use --apply to write restored workspace rows)",
  );

  const users = await scanAll(userTableName, {
    ProjectionExpression:
      "#id, #workspace, #email, #firstName, #lastName, #createdAt, #updatedAt",
    ExpressionAttributeNames: {
      "#id": "id",
      "#workspace": "workspace",
      "#email": "email",
      "#firstName": "firstName",
      "#lastName": "lastName",
      "#createdAt": "createdAt",
      "#updatedAt": "updatedAt",
    },
  });

  const workspaceOwners = groupUsersByWorkspace(users);

  const missingWorkspaces = [];
  for (const [workspaceId, entry] of workspaceOwners.entries()) {
    const existingWorkspace = await getWorkspaceById(workspaceId);

    if (existingWorkspace) {
      continue;
    }

    const createdAt = entry.owner.createdAt ?? Math.floor(Date.now() / 1000);
    const updatedAt = entry.owner.updatedAt ?? createdAt;
    const workspaceItem = {
      id: workspaceId,
      user: entry.owner.userId,
      createdAt,
      updatedAt,
    };

    if (includeTitle) {
      const title = buildWorkspaceTitle(entry.owner);
      if (title) {
        workspaceItem.title = title;
      }
    }

    missingWorkspaces.push({
      workspaceId,
      ownerUserId: entry.owner.userId,
      ownerEmail: entry.owner.email || "n/a",
      createdAt: formatEpochSeconds(createdAt),
      memberCount: entry.members.length,
      item: workspaceItem,
    });
  }

  console.log(`Users scanned: ${users.length}`);
  console.log(`Workspace ids referenced by users: ${workspaceOwners.size}`);
  console.log(`Missing workspace rows: ${missingWorkspaces.length}`);

  if (missingWorkspaces.length > 0) {
    console.table(
      missingWorkspaces.map(({ workspaceId, ownerUserId, ownerEmail, createdAt, memberCount }) => ({
        workspaceId,
        ownerUserId,
        ownerEmail,
        createdAt,
        memberCount,
      })),
    );
  }

  if (emitPartiql) {
    console.log("");
    console.log("-- PartiQL inserts");

    for (const row of missingWorkspaces) {
      console.log(buildInsertStatement(workspaceTableName, row.item));
    }

    return;
  }

  if (!applyWrites) {
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const row of missingWorkspaces) {
    const result = await putWorkspaceRecord(row.item);
    if (result.status === "created") {
      created += 1;
      console.log(`Created workspace ${row.workspaceId} for ${row.ownerUserId}`);
      continue;
    }

    skipped += 1;
    console.log(`Skipped existing workspace ${row.workspaceId}`);
  }

  console.log(
    `Backfill complete. Created: ${created}, skipped: ${skipped}, processed rows: ${missingWorkspaces.length}`,
  );
}

main().catch((error) => {
  console.error("Workspace backfill failed:");
  console.error(error);
  process.exitCode = 1;
});
