import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { users } from "./accounts";

// Domain events - Change log for debugging + analytics
export const domainEvents = pgTable(
  "domain_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // Event details
    eventType: text("event_type").notNull(), // e.g., 'thread.created', 'message.sent'
    eventName: text("event_name").notNull(),
    // Actor
    actorId: text("actor_id"), // User or system ID
    actorType: text("actor_type"), // 'user', 'system', 'webhook'
    // Aggregate info
    aggregateId: uuid("aggregate_id"), // ID of the entity
    aggregateType: text("aggregate_type"), // 'thread', 'message', 'contact', etc.
    // Event payload
    payload: jsonb("payload").notNull(), // Full event data
    metadata: jsonb("metadata"), // Request ID, IP, user agent, etc.
    // Timestamps
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("domain_events_account_id_idx").on(table.accountId),
    eventTypeIdx: index("domain_events_event_type_idx").on(table.eventType),
    aggregateIdIdx: index("domain_events_aggregate_id_idx").on(
      table.aggregateId
    ),
    occurredAtIdx: index("domain_events_occurred_at_idx").on(table.occurredAt),
  })
);

// Relations
export const domainEventsRelations = relations(domainEvents, ({ one }) => ({
  account: one(accounts, {
    fields: [domainEvents.accountId],
    references: [accounts.id],
  }),
}));
