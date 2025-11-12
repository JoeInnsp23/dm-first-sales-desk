import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { EventsService } from "@/lib/services";

export type TasksNotificationsJob = {
  type: "sla_warning" | "task_reminder" | "thread_snoozed" | "thread_assigned";
  accountId: string;
  threadId?: string;
  taskId?: string;
  userId?: string;
  data?: Record<string, any>;
};

async function processTasksNotifications(job: Job<TasksNotificationsJob>) {
  const { type, accountId, threadId } = job.data;

  console.log("Processing notification: " + type + " for account " + accountId);

  try {
    // Process based on type (simplified implementation)
    if (type === "thread_snoozed" && threadId) {
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

      console.log("Thread " + threadId + " unsnoozed");
      return { notificationSent: true, threadId, unsnoozed: true };
    }

    console.log("Notification " + type + " processed");
    return { notificationSent: true };
  } catch (error) {
    console.error("Failed to process notification " + type + ":", error);
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
