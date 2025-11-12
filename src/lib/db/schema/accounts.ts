import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["owner", "admin", "agent"]);

// Accounts table - Multi-tenant root identity
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Users table - Auth identity (managed by Clerk)
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Account memberships - Role per account
export const accountMemberships = pgTable("account_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const accountsRelations = relations(accounts, ({ many }) => ({
  memberships: many(accountMemberships),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(accountMemberships),
}));

export const accountMembershipsRelations = relations(
  accountMemberships,
  ({ one }) => ({
    account: one(accounts, {
      fields: [accountMemberships.accountId],
      references: [accounts.id],
    }),
    user: one(users, {
      fields: [accountMemberships.userId],
      references: [users.id],
    }),
  })
);
