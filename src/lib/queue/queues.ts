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

// Lazy queue initialization to avoid Redis connection during build
let _defaultQueueOptions: QueueOptions | null = null;
let _inboundMessageQueue: Queue | null = null;
let _outboundMessageQueue: Queue | null = null;
let _ordersSyncQueue: Queue | null = null;
let _tasksNotificationsQueue: Queue | null = null;
let _aiSuggestionsQueue: Queue | null = null;
let _exportsQueue: Queue | null = null;

// Get default queue options (lazy)
const getDefaultQueueOptions = (): QueueOptions => {
  if (!_defaultQueueOptions) {
    _defaultQueueOptions = {
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
  }
  return _defaultQueueOptions;
};

// Inbound message processing queue (lazy)
export const getInboundMessageQueue = () => {
  if (!_inboundMessageQueue) {
    _inboundMessageQueue = new Queue(
      QUEUE_NAMES.INBOUND_MESSAGE,
      getDefaultQueueOptions()
    );
  }
  return _inboundMessageQueue;
};

// Outbound message sending queue (lazy)
export const getOutboundMessageQueue = () => {
  if (!_outboundMessageQueue) {
    const options = getDefaultQueueOptions();
    _outboundMessageQueue = new Queue(QUEUE_NAMES.OUTBOUND_MESSAGE, {
      ...options,
      defaultJobOptions: {
        ...options.defaultJobOptions,
        attempts: 5, // More retries for outbound messages
      },
    });
  }
  return _outboundMessageQueue;
};

// Orders sync queue (Shopify, TikTok Shop) (lazy)
export const getOrdersSyncQueue = () => {
  if (!_ordersSyncQueue) {
    _ordersSyncQueue = new Queue(
      QUEUE_NAMES.ORDERS_SYNC,
      getDefaultQueueOptions()
    );
  }
  return _ordersSyncQueue;
};

// Tasks and notifications queue (lazy)
export const getTasksNotificationsQueue = () => {
  if (!_tasksNotificationsQueue) {
    _tasksNotificationsQueue = new Queue(
      QUEUE_NAMES.TASKS_NOTIFICATIONS,
      getDefaultQueueOptions()
    );
  }
  return _tasksNotificationsQueue;
};

// AI suggestions queue (lazy)
export const getAiSuggestionsQueue = () => {
  if (!_aiSuggestionsQueue) {
    const options = getDefaultQueueOptions();
    _aiSuggestionsQueue = new Queue(QUEUE_NAMES.AI_SUGGESTIONS, {
      ...options,
      defaultJobOptions: {
        ...options.defaultJobOptions,
        attempts: 2, // Fewer retries for AI
      },
    });
  }
  return _aiSuggestionsQueue;
};

// Exports queue (lazy)
export const getExportsQueue = () => {
  if (!_exportsQueue) {
    const options = getDefaultQueueOptions();
    _exportsQueue = new Queue(QUEUE_NAMES.EXPORTS, {
      ...options,
      defaultJobOptions: {
        ...options.defaultJobOptions,
        attempts: 2,
      },
    });
  }
  return _exportsQueue;
};

// Backwards compatibility: export getters as properties
export const inboundMessageQueue = {
  get queue() {
    return getInboundMessageQueue();
  },
  add: (...args: Parameters<Queue["add"]>) => getInboundMessageQueue().add(...args),
  close: () => getInboundMessageQueue().close(),
};

export const outboundMessageQueue = {
  get queue() {
    return getOutboundMessageQueue();
  },
  add: (...args: Parameters<Queue["add"]>) => getOutboundMessageQueue().add(...args),
  close: () => getOutboundMessageQueue().close(),
};

export const ordersSyncQueue = {
  get queue() {
    return getOrdersSyncQueue();
  },
  add: (...args: Parameters<Queue["add"]>) => getOrdersSyncQueue().add(...args),
  close: () => getOrdersSyncQueue().close(),
};

export const tasksNotificationsQueue = {
  get queue() {
    return getTasksNotificationsQueue();
  },
  add: (...args: Parameters<Queue["add"]>) => getTasksNotificationsQueue().add(...args),
  close: () => getTasksNotificationsQueue().close(),
};

export const aiSuggestionsQueue = {
  get queue() {
    return getAiSuggestionsQueue();
  },
  add: (...args: Parameters<Queue["add"]>) => getAiSuggestionsQueue().add(...args),
  close: () => getAiSuggestionsQueue().close(),
};

export const exportsQueue = {
  get queue() {
    return getExportsQueue();
  },
  add: (...args: Parameters<Queue["add"]>) => getExportsQueue().add(...args),
  close: () => getExportsQueue().close(),
};

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
