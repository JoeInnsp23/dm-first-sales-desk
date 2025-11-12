import { Queue, QueueOptions } from "bullmq";
import { createRedisConnection } from "./connection";

// Queue names
export const QUEUE_NAMES = {
  INBOUND_MESSAGE: "integration.inbound_message",
  OUTBOUND_MESSAGE: "integration.outbound_message",
  ORDERS_SYNC: "orders.sync",
  TASKS_NOTIFICATIONS: "tasks.notifications",
  AI_SUGGESTIONS: "ai.suggestions",
  EXPORTS: "exports.generate",
} as const;

// Default queue options
const defaultQueueOptions: QueueOptions = {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
};

// Inbound message processing queue
export const inboundMessageQueue = new Queue(
  QUEUE_NAMES.INBOUND_MESSAGE,
  defaultQueueOptions
);

// Outbound message sending queue
export const outboundMessageQueue = new Queue(
  QUEUE_NAMES.OUTBOUND_MESSAGE,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5, // More retries for outbound messages
    },
  }
);

// Orders sync queue (Shopify, TikTok Shop)
export const ordersSyncQueue = new Queue(
  QUEUE_NAMES.ORDERS_SYNC,
  defaultQueueOptions
);

// Tasks and notifications queue
export const tasksNotificationsQueue = new Queue(
  QUEUE_NAMES.TASKS_NOTIFICATIONS,
  defaultQueueOptions
);

// AI suggestions queue
export const aiSuggestionsQueue = new Queue(
  QUEUE_NAMES.AI_SUGGESTIONS,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 2, // Fewer retries for AI
    },
  }
);

// Exports queue
export const exportsQueue = new Queue(
  QUEUE_NAMES.EXPORTS,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 2,
      timeout: 300000, // 5 minutes timeout for exports
    },
  }
);

// Export all queues
export const queues = {
  inboundMessage: inboundMessageQueue,
  outboundMessage: outboundMessageQueue,
  ordersSync: ordersSyncQueue,
  tasksNotifications: tasksNotificationsQueue,
  aiSuggestions: aiSuggestionsQueue,
  exports: exportsQueue,
};

// Helper to add jobs to queues
export const addJob = async <T = any>(
  queueName: keyof typeof queues,
  name: string,
  data: T,
  options?: any
) => {
  const queue = queues[queueName];
  return queue.add(name, data, options);
};

// Helper to close all queues (for cleanup)
export const closeAllQueues = async () => {
  await Promise.all(Object.values(queues).map((q) => q.close()));
};
