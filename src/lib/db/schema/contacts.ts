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
import { sql } from "drizzle-orm";

// Contacts - Customer identity across channels
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    // Primary contact info
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    // Channel-specific identifiers
    whatsappId: text("whatsapp_id"),
    instagramId: text("instagram_id"),
    tiktokUserId: text("tiktok_user_id"),
    shopifyCustomerId: text("shopify_customer_id"),
    // Profile data
    avatarUrl: text("avatar_url"),
    profileData: jsonb("profile_data"), // Store channel-specific profile info
    // Custom fields & tags
    customFields: jsonb("custom_fields"),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
    // Search vector for full-text search
    searchVector: text("search_vector"),
    // Metadata
    notes: text("notes"),
    lastContactedAt: timestamp("last_contacted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("contacts_account_id_idx").on(table.accountId),
    emailIdx: index("contacts_email_idx").on(table.email),
    phoneIdx: index("contacts_phone_idx").on(table.phone),
    whatsappIdIdx: index("contacts_whatsapp_id_idx").on(table.whatsappId),
    instagramIdIdx: index("contacts_instagram_id_idx").on(table.instagramId),
    tiktokUserIdIdx: index("contacts_tiktok_user_id_idx").on(
      table.tiktokUserId
    ),
    shopifyCustomerIdIdx: index("contacts_shopify_customer_id_idx").on(
      table.shopifyCustomerId
    ),
  })
);

// Relations
export const contactsRelations = relations(contacts, ({ one }) => ({
  account: one(accounts, {
    fields: [contacts.accountId],
    references: [accounts.id],
  }),
}));
