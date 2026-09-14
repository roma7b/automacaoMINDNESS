import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
};

// funnel: 'customer' | 'affiliate'
// pipeline (customer): discovered | qualified | contacted | replied | interested
//   | whatsapp_handoff | registered | active_customer | closed
// pipeline (affiliate): discovered | qualified | contacted | replied | interested
//   | joined_affiliate_group | active_affiliate | generated_customer | closed
// channel: browser_contact_pending | browser_contact_sent | waiting_inbound_reply
//   | api_eligible | api_active | api_window_closed | human_review_required
//   | do_not_contact | blocked | completed
export const leads = sqliteTable(
  "leads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instagramUsername: text("instagram_username").notNull(),
    instagramUserId: text("instagram_user_id"),
    funnel: text("funnel").notNull(),
    pipelineStatus: text("pipeline_status").notNull().default("discovered"),
    channelStatus: text("channel_status")
      .notNull()
      .default("browser_contact_pending"),
    icpScore: real("icp_score"),
    icpReasoning: text("icp_reasoning"),
    priority: integer("priority").notNull().default(0),
    niche: text("niche"),
    profileType: text("profile_type"), // store | employee | owner | decision_maker | creator
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
    doNotContact: integer("do_not_contact", { mode: "boolean" })
      .notNull()
      .default(false),
    doNotContactReason: text("do_not_contact_reason"),
    profileSnapshot: text("profile_snapshot", { mode: "json" }),
    source: text("source"), // discovery keyword/segment that surfaced this lead
    bestSendWindow: text("best_send_window"),
    suggestedReply: text("suggested_reply"),
    suggestedReplyAt: text("suggested_reply_at"),
    lastInboxCheckAt: text("last_inbox_check_at"),
    // Raw text captured from the thread right after a successful send —
    // already includes whatever profile chrome (bio, category, follow
    // button) sits mounted under the DM overlay. Diffing future reads
    // against this baseline is what actually distinguishes "the profile
    // page's own static text" from a genuinely new reply, since that noise
    // varies per business and can't be hardcoded as a fixed pattern list.
    threadBaseline: text("thread_baseline", { mode: "json" }).$type<string[]>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("leads_instagram_username_funnel_unique").on(
      table.instagramUsername,
      table.funnel,
    ),
    index("leads_pipeline_status_idx").on(table.pipelineStatus),
    index("leads_channel_status_idx").on(table.channelStatus),
  ],
);

// direction: 'inbound' | 'outbound'
// channel: 'browser' | 'api'
// status: 'queued' | 'sent' | 'delivered' | 'failed'
export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    channel: text("channel").notNull(),
    content: text("content").notNull(),
    variant: text("variant"),
    metaMessageId: text("meta_message_id"),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    sentAt: text("sent_at"),
    ...timestamps,
  },
  (table) => [
    index("messages_lead_id_idx").on(table.leadId),
    uniqueIndex("messages_meta_message_id_unique").on(table.metaMessageId),
  ],
);

export const aiCalls = sqliteTable(
  "ai_calls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull(), // draft_message | classify_intent | daily_digest | ...
    model: text("model").notNull(),
    tokensInput: integer("tokens_input").notNull(),
    tokensOutput: integer("tokens_output").notNull(),
    costUsd: real("cost_usd").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("ai_calls_created_at_idx").on(table.createdAt)],
);

// type: 'browser_first_contact' | 'api_send' | 'follow_up' | 'daily_digest' | ...
// status: 'pending' | 'running' | 'done' | 'failed' | 'dead_letter'
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    status: text("status").notNull().default("pending"),
    payload: text("payload", { mode: "json" }).notNull(),
    idempotencyKey: text("idempotency_key"),
    runAt: text("run_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    lockedAt: text("locked_at"),
    ...timestamps,
  },
  (table) => [
    index("jobs_status_run_at_idx").on(table.status, table.runAt),
    uniqueIndex("jobs_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export const followUps = sqliteTable(
  "follow_ups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    scheduledAt: text("scheduled_at").notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | sent | cancelled
    kind: text("kind").notNull(),
    ...timestamps,
  },
  (table) => [index("follow_ups_scheduled_at_idx").on(table.scheduledAt)],
);

export const experiments = sqliteTable("experiments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  variable: text("variable").notNull(),
  status: text("status").notNull().default("running"), // running | concluded | aborted
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  winningVariant: text("winning_variant"),
  ...timestamps,
});

export const experimentAssignments = sqliteTable(
  "experiment_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    experimentId: integer("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    leadId: integer("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    variant: text("variant").notNull(),
    isControl: integer("is_control", { mode: "boolean" })
      .notNull()
      .default(false),
    outcome: text("outcome"), // set once the tracked conversion event happens
    ...timestamps,
  },
  (table) => [
    uniqueIndex("experiment_assignments_unique").on(
      table.experimentId,
      table.leadId,
    ),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    event: text("event").notNull(),
    payload: text("payload", { mode: "json" }),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("audit_log_entity_idx").on(table.entityType, table.entityId)],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull().default("meta"),
    externalId: text("external_id").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    processedAt: text("processed_at"),
    createdAt: timestamps.createdAt,
  },
  (table) => [uniqueIndex("webhook_events_external_id_unique").on(table.externalId)],
);

export const systemState = sqliteTable("system_state", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: timestamps.updatedAt,
});
