import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  jsonb,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { threads } from "./threads";
import { messages } from "./messages";
import { users } from "./accounts";

// Enums
export const aiSuggestionTypeEnum = pgEnum("ai_suggestion_type", [
  "reply",
  "summary",
  "sentiment",
  "translation",
  "intent",
]);

export const aiModelEnum = pgEnum("ai_model", [
  "claude-3-5-sonnet",
  "claude-3-haiku",
  "gpt-4",
  "gpt-3.5-turbo",
]);

export const sentimentEnum = pgEnum("sentiment", [
  "positive",
  "neutral",
  "negative",
]);

// AI Suggestions - Stores model outputs
export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    // AI suggestion details
    type: aiSuggestionTypeEnum("type").notNull(),
    model: aiModelEnum("model").notNull(),
    prompt: text("prompt"),
    suggestion: text("suggestion").notNull(),
    // Usage tracking
    tokensUsed: integer("tokens_used"),
    costUsd: integer("cost_usd"), // Store in cents to avoid decimal issues
    // Metadata
    metadata: jsonb("metadata"), // Additional model outputs
    sentiment: sentimentEnum("sentiment"), // For sentiment analysis
    confidence: integer("confidence"), // 0-100 confidence score
    // User feedback
    wasUsed: boolean("was_used").notNull().default(false),
    wasHelpful: boolean("was_helpful"),
    feedbackNote: text("feedback_note"),
    reviewedById: text("reviewed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => ({
    accountIdIdx: index("ai_suggestions_account_id_idx").on(table.accountId),
    threadIdIdx: index("ai_suggestions_thread_id_idx").on(table.threadId),
    typeIdx: index("ai_suggestions_type_idx").on(table.type),
    createdAtIdx: index("ai_suggestions_created_at_idx").on(table.createdAt),
  })
);

// Relations
export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  account: one(accounts, {
    fields: [aiSuggestions.accountId],
    references: [accounts.id],
  }),
  thread: one(threads, {
    fields: [aiSuggestions.threadId],
    references: [threads.id],
  }),
  message: one(messages, {
    fields: [aiSuggestions.messageId],
    references: [messages.id],
  }),
  reviewedBy: one(users, {
    fields: [aiSuggestions.reviewedById],
    references: [users.id],
  }),
}));
