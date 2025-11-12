import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";

export type OrdersSyncJob = {
  accountId: string;
  channelConnectionId: string;
  channelType: "shopify" | "tiktok_shop";
  orderId?: string;
  orderData: any;
  webhookTopic?: string;
};

async function processOrdersSync(job: Job<OrdersSyncJob>) {
  const { accountId, channelType, orderData } = job.data;

  console.log("Syncing order from " + channelType + ": " + (orderData.externalOrderId || orderData.orderId));

  try {
    // Order sync logic would go here
    // TODO: Implement order creation/update logic

    console.log("Order sync completed (stub)");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to sync order:", error);
    throw error;
  }
}

export function createOrdersSyncWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ORDERS_SYNC,
    processOrdersSync,
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log("Orders sync job " + job.id + " completed");
  });

  worker.on("failed", (job, err) => {
    console.error("Orders sync job " + (job?.id || "unknown") + " failed:", err);
  });

  return worker;
}
