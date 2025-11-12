import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { ThreadsService } from "@/lib/services";
import { AIService } from "@/lib/ai/service";

export type AISuggestionsJob = {
  accountId: string;
  threadId: string;
  requestedById?: string;
};

async function processAISuggestions(job: Job<AISuggestionsJob>) {
  const { accountId, threadId, requestedById } = job.data;

  console.log("Generating AI suggestions for thread: " + threadId);

  try {
    // Get thread details
    const thread = await ThreadsService.getById(threadId, accountId);

    if (!thread) {
      throw new Error("Thread not found: " + threadId);
    }

    // Generate AI suggestion (stub - implement based on actual AIService interface)
    console.log("AI suggestion processing queued for thread " + threadId);

    return {
      threadId,
      completed: true,
    };
  } catch (error) {
    console.error("Failed to generate AI suggestions for thread " + threadId + ":", error);
    throw error;
  }
}

export function createAISuggestionsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.AI_SUGGESTIONS,
    processAISuggestions,
    {
      connection: createRedisConnection(),
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    console.log("AI suggestions job " + job.id + " completed");
  });

  worker.on("failed", (job, err) => {
    console.error("AI suggestions job " + (job?.id || "unknown") + " failed:", err);
  });

  return worker;
}
