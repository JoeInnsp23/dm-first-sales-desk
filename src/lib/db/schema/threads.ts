import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { contacts } from "./contacts";
import { channelConnections } from "./channels";
import { users } from "./accounts";

// Enums
export const threadStatusEnum = pgEnum("thread_status", [
  "open",
  "snoozed",
  "closed",
  "archived",
]);

export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "lead",
  "engaged",
  "converted",
  "lost",
]);

// Threads - One per channel per contact
export const threads = pgTable(
  "threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channelConnectionId: uuid("channel_connection_id")
      .notNull()
      .references(() => channelConnections.id, { onDelete: "cascade" }),
    // Thread details
    subject: text("subject"),
    status: threadStatusEnum("status").notNull().default("open"),
    pipelineStage: pipelineStageEnum("pipeline_stage").default("lead"),
    // Assignment
    assignedToId: text("assigned_to_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Platform-specific thread identifier
    externalThreadId: text("external_thread_id"),
    // Flags
    isRead: boolean("is_read").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    hasUnreadMessages: boolean("has_unread_messages").notNull().default(false),
    // TikTok Shop SLA tracking
    slaDeadline: timestamp("sla_deadline"),
    isSlaCritical: boolean("is_sla_critical").notNull().default(false),
    // Metadata
    metadata: jsonb("metadata"),
    tags: jsonb("tags").$type<string[]>(),
    // Timestamps
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    snoozedUntil: timestamp("snoozed_until"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("threads_account_id_idx").on(table.accountId),
    contactIdIdx: index("threads_contact_id_idx").on(table.contactId),
    statusIdx: index("threads_status_idx").on(table.status),
    lastMessageAtIdx: index("threads_last_message_at_idx").on(
      table.lastMessageAt
    ),
    assignedToIdIdx: index("threads_assigned_to_id_idx").on(table.assignedToId),
    pipelineStageIdx: index("threads_pipeline_stage_idx").on(
      table.pipelineStage
    ),
  })
);

// Relations
export const threadsRelations = relations(threads, ({ one }) => ({
  account: one(accounts, {
    fields: [threads.accountId],
    references: [accounts.id],
  }),
  contact: one(contacts, {
    fields: [threads.contactId],
    references: [contacts.id],
  }),
  channelConnection: one(channelConnections, {
    fields: [threads.channelConnectionId],
    references: [channelConnections.id],
  }),
  assignedTo: one(users, {
    fields: [threads.assignedToId],
    references: [users.id],
  }),
}));
