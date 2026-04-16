"use strict";

const crypto = require("crypto");
const AWS = require("aws-sdk");

const dynamo = new AWS.DynamoDB();
const documentClient = new AWS.DynamoDB.DocumentClient();

const FEEDBACK_TABLE_NAME = (process.env.FEEDBACK_TABLE_NAME || "mtc-prod-feedback").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FEEDBACK_EMAIL_FROM = (process.env.FEEDBACK_EMAIL_FROM || "").trim();
const FEEDBACK_EMAIL_TO = (process.env.FEEDBACK_EMAIL_TO || "").trim();
const FEEDBACK_EMAIL_SUBJECT_PREFIX =
  (process.env.FEEDBACK_EMAIL_SUBJECT_PREFIX || "[MTC Feedback]").trim();
const FEEDBACK_EMAIL_ENABLED = (process.env.FEEDBACK_EMAIL_ENABLED || "1")
  .trim()
  .toLowerCase() !== "0";
const FEEDBACK_WEBHOOK_SECRET = (process.env.FEEDBACK_WEBHOOK_SECRET || "").trim();

const MIN_FEEDBACK_LENGTH = 3;
const MAX_FEEDBACK_LENGTH = 1000;

let keySchemaCache = null;

function buildResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,x-feedback-secret",
    },
    body: JSON.stringify(payload),
  };
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseBody(event) {
  if (!event || typeof event.body !== "string" || !event.body.trim()) {
    return {};
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return JSON.parse(rawBody);
}

function parseRecipientList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveFeedbackAuthor(submission) {
  const userName = normalizeOptionalString(submission.user?.name);
  if (userName) {
    return {
      name: userName,
      email: normalizeOptionalString(submission.user?.email),
      sub: normalizeOptionalString(submission.user?.sub),
    };
  }

  const email = normalizeOptionalString(submission.user?.email);
  if (email) {
    return {
      name: email,
      email,
      sub: normalizeOptionalString(submission.user?.sub),
    };
  }

  return {
    name: "Anonymous user",
    email,
    sub: normalizeOptionalString(submission.user?.sub),
  };
}

function buildFeedbackSubject(submission) {
  const actor = resolveFeedbackAuthor(submission);
  const page = normalizeOptionalString(submission.page) || "unknown page";
  return `${FEEDBACK_EMAIL_SUBJECT_PREFIX} ${actor.name} (${page})`;
}

function buildFeedbackBody(submission) {
  const actor = resolveFeedbackAuthor(submission);

  return [
    "New feedback received",
    "",
    "Message:",
    submission.message,
    "",
    "Metadata:",
    `- Page: ${submission.page || "N/A"}`,
    `- Sent by client at: ${submission.sentAt}`,
    `- Submitted by API at: ${submission.submittedAt}`,
    `- User name: ${actor.name}`,
    `- User email: ${actor.email || "N/A"}`,
    `- User sub: ${actor.sub || "N/A"}`,
  ].join("\n");
}

async function sendFeedbackEmail(submission) {
  const recipients = parseRecipientList(FEEDBACK_EMAIL_TO);

  if (!FEEDBACK_EMAIL_ENABLED) {
    return { delivery: "skipped", provider: "resend", messageId: null };
  }

  if (!RESEND_API_KEY || !FEEDBACK_EMAIL_FROM || recipients.length === 0) {
    console.warn(
      "[feedback-lambda] Resend config missing. Set RESEND_API_KEY, FEEDBACK_EMAIL_FROM, and FEEDBACK_EMAIL_TO to enable delivery.",
    );
    return { delivery: "skipped", provider: "resend", messageId: null };
  }

  const actor = resolveFeedbackAuthor(submission);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FEEDBACK_EMAIL_FROM,
      to: ["pierregober@gmail.com", "mike"],
      subject: buildFeedbackSubject(submission),
      text: buildFeedbackBody(submission),
      reply_to: actor.email || undefined,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      "Unable to deliver feedback email.";
    throw new Error(message);
  }

  return {
    delivery: "sent",
    provider: "resend",
    messageId: payload?.id || null,
  };
}

async function resolveTableKeySchema() {
  if (keySchemaCache) {
    return keySchemaCache;
  }

  const table = await dynamo
    .describeTable({
      TableName: FEEDBACK_TABLE_NAME,
    })
    .promise();

  const keySchema = table?.Table?.KeySchema || [];
  const attributeDefinitions = table?.Table?.AttributeDefinitions || [];

  const attributeTypeByName = Object.fromEntries(
    attributeDefinitions.map((entry) => [entry.AttributeName, entry.AttributeType]),
  );

  keySchemaCache = keySchema.map((entry) => ({
    name: entry.AttributeName,
    keyType: entry.KeyType,
    type: attributeTypeByName[entry.AttributeName] || "S",
  }));

  return keySchemaCache;
}

function buildKeyValue(schemaEntry, feedbackId, submittedAtMs) {
  if (schemaEntry.type === "N") {
    return submittedAtMs;
  }

  if (schemaEntry.type !== "S") {
    throw new Error(
      `Unsupported key attribute type '${schemaEntry.type}' for ${schemaEntry.name}.`,
    );
  }

  if (schemaEntry.keyType === "HASH") {
    return feedbackId;
  }

  return new Date(submittedAtMs).toISOString();
}

async function persistFeedback(submission) {
  const submittedAtMs = Date.now();
  const feedbackId = crypto.randomUUID();
  const keySchema = await resolveTableKeySchema();

  const item = {
    id: feedbackId,
    feedbackId,
    message: submission.message,
    page: submission.page,
    sentAt: submission.sentAt,
    submittedAt: submission.submittedAt,
    submittedAtMs,
    userSub: submission.user.sub,
    userEmail: submission.user.email,
    userName: submission.user.name,
  };

  for (const schemaEntry of keySchema) {
    if (Object.prototype.hasOwnProperty.call(item, schemaEntry.name)) {
      continue;
    }

    item[schemaEntry.name] = buildKeyValue(schemaEntry, feedbackId, submittedAtMs);
  }

  await documentClient
    .put({
      TableName: FEEDBACK_TABLE_NAME,
      Item: item,
    })
    .promise();

  return {
    feedbackId,
    submittedAtMs,
  };
}

exports.main = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "POST";

  if (method === "OPTIONS") {
    return buildResponse(204, {});
  }

  if (FEEDBACK_WEBHOOK_SECRET) {
    const providedSecret =
      event?.headers?.["x-feedback-secret"] ||
      event?.headers?.["X-Feedback-Secret"] ||
      "";

    if (providedSecret !== FEEDBACK_WEBHOOK_SECRET) {
      return buildResponse(401, { error: "Unauthorized." });
    }
  }

  let payload;

  try {
    payload = parseBody(event);
  } catch {
    return buildResponse(400, { error: "Invalid JSON payload." });
  }

  const message = normalizeOptionalString(payload.message) || "";

  if (message.length < MIN_FEEDBACK_LENGTH) {
    return buildResponse(400, { error: "Feedback must be at least 3 characters." });
  }

  if (message.length > MAX_FEEDBACK_LENGTH) {
    return buildResponse(400, { error: "Feedback is too long." });
  }

  const submission = {
    message,
    page: normalizeOptionalString(payload.page),
    sentAt: normalizeOptionalString(payload.sentAt) || new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    user: {
      sub: normalizeOptionalString(payload.user?.sub),
      email: normalizeOptionalString(payload.user?.email),
      name: normalizeOptionalString(payload.user?.name),
    },
  };

  try {
    const storage = await persistFeedback(submission);
    const dispatch = await sendFeedbackEmail(submission);

    console.info(
      "[feedback-lambda]",
      JSON.stringify({
        ...submission,
        storage,
        dispatch,
      }),
    );

    return buildResponse(200, {
      ok: true,
      storage,
      delivery: dispatch.delivery,
      provider: dispatch.provider,
      messageId: dispatch.messageId,
    });
  } catch (error) {
    console.error("[feedback-lambda] failure", error);
    return buildResponse(502, {
      error: error instanceof Error ? error.message : "Failed to handle feedback.",
    });
  }
};
