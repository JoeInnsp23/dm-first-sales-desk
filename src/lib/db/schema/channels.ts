import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";

// Enums
export const channelTypeEnum = pgEnum("channel_type", [
  "whatsapp",
  "instagram",
  "tiktok_shop",
  "shopify",
]);

export const channelStatusEnum = pgEnum("channel_status", [
  "active",
  "inactive",
  "error",
]);

// Channel connections - Stores encrypted API configs
export const channelConnections = pgTable("channel_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  type: channelTypeEnum("type").notNull(),
  status: channelStatusEnum("status").notNull().default("inactive"),
  name: text("name").notNull(),
  // Encrypted configuration (tokens, secrets, etc.)
  config: jsonb("config").notNull(),
  // Additional metadata
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const channelConnectionsRelations = relations(
  channelConnections,
  ({ one }) => ({
    account: one(accounts, {
      fields: [channelConnections.accountId],
      references: [accounts.id],
    }),
  })
);
