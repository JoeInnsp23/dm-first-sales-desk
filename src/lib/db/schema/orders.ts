import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  jsonb,
  decimal,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { contacts } from "./contacts";
import { threads } from "./threads";
import { channelConnections } from "./channels";

// Enums
export const orderSourceEnum = pgEnum("order_source", [
  "shopify",
  "tiktok_shop",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "unfulfilled",
  "partial",
  "fulfilled",
]);

// Orders - For Shopify + TikTok Shop
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    channelConnectionId: uuid("channel_connection_id")
      .notNull()
      .references(() => channelConnections.id, { onDelete: "cascade" }),
    // Order identification
    source: orderSourceEnum("source").notNull(),
    externalOrderId: text("external_order_id").notNull(), // Platform order ID
    orderNumber: text("order_number"), // Human-readable order number
    // Order details
    status: orderStatusEnum("status").notNull().default("pending"),
    fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status")
      .notNull()
      .default("unfulfilled"),
    // Financial info
    currency: text("currency").notNull().default("USD"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    subtotalAmount: decimal("subtotal_amount", { precision: 10, scale: 2 }),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
    shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
    // Line items
    lineItems: jsonb("line_items").$type<
      Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        sku?: string;
        imageUrl?: string;
      }>
    >(),
    // Customer info (denormalized for quick access)
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    // Shipping info
    shippingAddress: jsonb("shipping_address").$type<{
      name?: string;
      address1?: string;
      address2?: string;
      city?: string;
      province?: string;
      country?: string;
      zip?: string;
      phone?: string;
    }>(),
    // Tracking
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    carrier: text("carrier"),
    // Metadata
    metadata: jsonb("metadata"), // Platform-specific data
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>(),
    // Timestamps
    placedAt: timestamp("placed_at").notNull(),
    fulfilledAt: timestamp("fulfilled_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("orders_account_id_idx").on(table.accountId),
    contactIdIdx: index("orders_contact_id_idx").on(table.contactId),
    externalOrderIdIdx: index("orders_external_order_id_idx").on(
      table.externalOrderId
    ),
    statusIdx: index("orders_status_idx").on(table.status),
    placedAtIdx: index("orders_placed_at_idx").on(table.placedAt),
  })
);

// Thread-Order links - Link orders to conversation threads
export const threadOrderLinks = pgTable("thread_order_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  account: one(accounts, {
    fields: [orders.accountId],
    references: [accounts.id],
  }),
  contact: one(contacts, {
    fields: [orders.contactId],
    references: [contacts.id],
  }),
  channelConnection: one(channelConnections, {
    fields: [orders.channelConnectionId],
    references: [channelConnections.id],
  }),
  threadLinks: many(threadOrderLinks),
}));

export const threadOrderLinksRelations = relations(
  threadOrderLinks,
  ({ one }) => ({
    thread: one(threads, {
      fields: [threadOrderLinks.threadId],
      references: [threads.id],
    }),
    order: one(orders, {
      fields: [threadOrderLinks.orderId],
      references: [orders.id],
    }),
  })
);
