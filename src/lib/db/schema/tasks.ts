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
export const taskTypeEnum = pgEnum("task_type", [
  "follow_up",
  "reminder",
  "snooze",
  "custom",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "task_due",
  "thread_assigned",
  "new_message",
  "sla_warning",
  "mention",
  "custom",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "unread",
  "read",
  "archived",
]);

// Tasks - For reminders, snoozes, follow-ups
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => threads.id, {
      onDelete: "cascade",
    }),
    // Task details
    type: taskTypeEnum("type").notNull().default("custom"),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("pending"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    // Assignment
    assignedToId: text("assigned_to_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Due date
    dueAt: timestamp("due_at"),
    // Metadata
    metadata: jsonb("metadata"),
    // Timestamps
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index("tasks_account_id_idx").on(table.accountId),
    threadIdIdx: index("tasks_thread_id_idx").on(table.threadId),
    assignedToIdIdx: index("tasks_assigned_to_id_idx").on(table.assignedToId),
    statusIdx: index("tasks_status_idx").on(table.status),
    dueAtIdx: index("tasks_due_at_idx").on(table.dueAt),
  })
);

// Notifications - For UI + email notifications
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Notification details
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    status: notificationStatusEnum("status").notNull().default("unread"),
    // Links
    threadId: uuid("thread_id").references(() => threads.id, {
      onDelete: "cascade",
    }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    // Action URL
    actionUrl: text("action_url"),
    // Metadata
    metadata: jsonb("metadata"),
    // Timestamps
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    statusIdx: index("notifications_status_idx").on(table.status),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  })
);

// Relations
export const tasksRelations = relations(tasks, ({ one }) => ({
  account: one(accounts, {
    fields: [tasks.accountId],
    references: [accounts.id],
  }),
  thread: one(threads, {
    fields: [tasks.threadId],
    references: [threads.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedToId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  account: one(accounts, {
    fields: [notifications.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  thread: one(threads, {
    fields: [notifications.threadId],
    references: [threads.id],
  }),
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id],
  }),
}));
