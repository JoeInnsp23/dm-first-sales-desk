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
import { threads } from "./threads";
import { users } from "./accounts";

// Enums
export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "location",
  "contact",
]);

// Messages - Canonical message list
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    // Message identification
    externalMessageId: text("external_message_id").notNull().unique(), // For deduplication
    // Message content
    type: messageTypeEnum("type").notNull().default("text"),
    content: text("content"),
    // Media attachments
    attachments: jsonb("attachments").$type<
      Array<{
        type: string;
        url: string;
        mimeType?: string;
        filename?: string;
        size?: number;
      }>
    >(),
    // Direction and status
    direction: messageDirectionEnum("direction").notNull(),
    status: messageStatusEnum("status").notNull().default("sent"),
    // Sender info
    senderId: text("sender_id"), // Can be user ID or contact platform ID
    senderType: text("sender_type"), // 'user' or 'contact'
    senderName: text("sender_name"),
    // Agent who sent (if outbound)
    sentByUserId: text("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Metadata
    metadata: jsonb("metadata"), // Platform-specific metadata
    errorMessage: text("error_message"),
    // Read status
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    // Timestamps
    sentAt: timestamp("sent_at").notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("messages_account_id_idx").on(table.accountId),
    threadIdIdx: index("messages_thread_id_idx").on(table.threadId),
    externalMessageIdIdx: index("messages_external_message_id_idx").on(
      table.externalMessageId
    ),
    sentAtIdx: index("messages_sent_at_idx").on(table.sentAt),
  })
);

// Relations
export const messagesRelations = relations(messages, ({ one }) => ({
  account: one(accounts, {
    fields: [messages.accountId],
    references: [accounts.id],
  }),
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  sentByUser: one(users, {
    fields: [messages.sentByUserId],
    references: [users.id],
  }),
}));
