import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { db } from "@/lib/db";
import { threads, accountMemberships } from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { EventsService, ThreadsService } from "@/lib/services";

export type TasksNotificationsJob = {
  type: "sla_warning" | "task_reminder" | "thread_snoozed" | "thread_assigned";
  accountId: string;
  threadId?: string;
  taskId?: string;
  userId?: string;
  data?: Record<string, any>;
};

async function processTasksNotifications(job: Job<TasksNotificationsJob>) {
  const { type, accountId, threadId, userId, data } = job.data;

  console.log(`Processing notification: ${type} for account ${accountId}`);

  try {
    switch (type) {
      case "thread_snoozed": {
        if (!threadId) {
          throw new Error("threadId is required for thread_snoozed notification");
        }

        // Update thread status back to open when unsnoozed
        await db
          .update(threads)
          .set({
            status: "open",
            snoozedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(threads.id, threadId));

        await EventsService.logThreadEvent(
          accountId,
          threadId,
          "unsnoozed",
          "Thread unsnoozed automatically",
          {}
        );

        console.log(`✓ Thread ${threadId} unsnoozed`);

        // TODO: Send notification to assigned user
        // This would integrate with email/push notification service

        return {
          notificationSent: true,
          threadId,
          action: "unsnoozed",
        };
      }

      case "thread_assigned": {
        if (!threadId || !userId) {
          throw new Error("threadId and userId are required for thread_assigned notification");
        }

        const thread = await ThreadsService.getById(threadId, accountId);

        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        // Get user details
        const user = await db.query.accountMemberships.findFirst({
          where: and(
            eq(accountMemberships.accountId, accountId),
            eq(accountMemberships.userId, userId)
          ),
          with: {
            user: true,
          },
        });

        if (!user) {
          throw new Error(`User ${userId} not found in account ${accountId}`);
        }

        console.log(
          `✓ Sending thread assignment notification to ${user.user.name} (${user.user.email})`
        );

        // TODO: Send email/push notification
        // Example:
        // await EmailService.send({
        //   to: user.user.email,
        //   subject: `New thread assigned: ${thread.subject}`,
        //   template: 'thread-assigned',
        //   data: { thread, user }
        // });

        // Log event
        await EventsService.logThreadEvent(
          accountId,
          threadId,
          "notification_sent",
          `Assignment notification sent to ${user.user.name}`,
          { userId, notificationType: "thread_assigned" }
        );

        return {
          notificationSent: true,
          threadId,
          userId,
          action: "assignment_notification",
        };
      }

      case "sla_warning": {
        if (!threadId) {
          throw new Error("threadId is required for sla_warning notification");
        }

        const thread = await ThreadsService.getById(threadId, accountId);

        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        // Check if thread is actually SLA critical
        if (!thread.slaDeadline) {
          console.log(`Thread ${threadId} does not have SLA deadline, skipping`);
          return { notificationSent: false, skipped: true, reason: "no_sla" };
        }

        const now = new Date();
        const timeUntilBreach = thread.slaDeadline.getTime() - now.getTime();
        const hoursUntilBreach = timeUntilBreach / (1000 * 60 * 60);

        if (hoursUntilBreach < 0) {
          console.log(`Thread ${threadId} SLA already breached`);
          // Mark as critical if not already
          if (!thread.isSlaCritical) {
            await db
              .update(threads)
              .set({
                isSlaCritical: true,
                updatedAt: new Date(),
              })
              .where(eq(threads.id, threadId));
          }
        }

        // Get assigned user or account admins
        let recipients: any[] = [];
        if (thread.assignedToId) {
          const assignedUser = await db.query.accountMemberships.findFirst({
            where: and(
              eq(accountMemberships.accountId, accountId),
              eq(accountMemberships.userId, thread.assignedToId)
            ),
            with: { user: true },
          });
          if (assignedUser) recipients.push(assignedUser.user);
        }

        // If no assigned user, notify admins
        if (recipients.length === 0) {
          const admins = await db.query.accountMemberships.findMany({
            where: and(
              eq(accountMemberships.accountId, accountId),
              eq(accountMemberships.role, "admin")
            ),
            with: { user: true },
          });
          recipients = admins.map((m) => m.user);
        }

        console.log(
          `✓ Sending SLA warning for thread ${threadId} to ${recipients.length} recipient(s) ` +
            `(${Math.abs(hoursUntilBreach).toFixed(1)}h ${hoursUntilBreach >= 0 ? "remaining" : "overdue"})`
        );

        // TODO: Send notifications
        // for (const recipient of recipients) {
        //   await EmailService.send({
        //     to: recipient.email,
        //     subject: `SLA Warning: ${thread.subject}`,
        //     template: 'sla-warning',
        //     data: { thread, hoursUntilBreach }
        //   });
        // }

        // Log event
        await EventsService.logThreadEvent(
          accountId,
          threadId,
          "notification_sent",
          `SLA warning notification sent to ${recipients.length} user(s)`,
          {
            notificationType: "sla_warning",
            hoursUntilBreach,
            recipientCount: recipients.length,
          }
        );

        return {
          notificationSent: true,
          threadId,
          recipientCount: recipients.length,
          action: "sla_warning",
          hoursUntilBreach,
        };
      }

      case "task_reminder": {
        // TODO: Implement task reminder functionality
        // This would require a tasks table which isn't in the current schema
        console.log("Task reminder notification not yet implemented");

        return {
          notificationSent: false,
          skipped: true,
          reason: "not_implemented",
        };
      }

      default: {
        console.log(`Unknown notification type: ${type}`);
        return {
          notificationSent: false,
          skipped: true,
          reason: "unknown_type",
        };
      }
    }
  } catch (error: any) {
    console.error(`Failed to process notification ${type}:`, error);
    throw error;
  }
}

export function createTasksNotificationsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.TASKS_NOTIFICATIONS,
    processTasksNotifications,
    {
      connection: createRedisConnection(),
      concurrency: 10,
    }
  );

  worker.on("completed", (job) => {
    console.log("Tasks/notifications job " + job.id + " completed");
  });

  worker.on("failed", (job, err) => {
    console.error("Tasks/notifications job " + (job?.id || "unknown") + " failed:", err);
  });

  return worker;
}
