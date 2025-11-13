import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { ThreadsService, MessagesService } from "@/lib/services";
import { AIService } from "@/lib/ai/service";

export type AISuggestionsJob = {
  accountId: string;
  threadId: string;
  requestedById?: string;
  count?: number; // Number of suggestions to generate (default: 1)
  tone?: "professional" | "friendly" | "casual";
  model?: "claude-3-5-sonnet" | "claude-3-haiku" | "gpt-4" | "gpt-3.5-turbo";
};

async function processAISuggestions(job: Job<AISuggestionsJob>) {
  const { accountId, threadId, requestedById, count = 1, tone = "friendly", model } = job.data;

  console.log(`Generating ${count} AI suggestion(s) for thread: ${threadId}`);

  try {
    // Verify thread exists
    const thread = await ThreadsService.getById(threadId, accountId);

    if (!thread) {
      throw new Error("Thread not found: " + threadId);
    }

    // Check if there are any messages in the thread
    const messages = await MessagesService.listByThread(threadId, accountId, {
      pageSize: 1,
    });

    if (messages.length === 0) {
      console.log(`No messages in thread ${threadId}, skipping AI suggestions`);
      return {
        threadId,
        skipped: true,
        reason: "no_messages",
      };
    }

    // Generate suggestions (batch if count > 1)
    const suggestions = await Promise.all(
      Array.from({ length: count }).map(async (_, index) => {
        try {
          const result = await AIService.generateReplySuggestion(threadId, accountId, {
            tone,
            model,
          });

          console.log(
            `✓ Generated AI suggestion ${index + 1}/${count} for thread ${threadId}: ` +
              `"${result.suggestion.substring(0, 60)}..." ` +
              `(${result.tokensUsed} tokens, $${result.costUsd.toFixed(4)})`
          );

          return result;
        } catch (error: any) {
          // Handle AI-specific errors without failing the entire job
          if (error.message?.includes("API key")) {
            console.error("AI API key not configured, skipping suggestion generation");
            return { error: "no_api_key", skipped: true };
          }

          if (error.message?.includes("rate limit") || error.message?.includes("quota")) {
            console.error("AI API rate limit or quota exceeded");
            throw error; // Retry these
          }

          // Log other errors but don't fail
          console.error(`Error generating suggestion ${index + 1}:`, error.message);
          return { error: error.message, skipped: true };
        }
      })
    );

    // Calculate totals
    const successful = suggestions.filter((s) => !("error" in s));
    const totalTokens = successful.reduce((sum, s: any) => sum + (s.tokensUsed || 0), 0);
    const totalCost = successful.reduce((sum, s: any) => sum + (s.costUsd || 0), 0);

    console.log(
      `✓ AI suggestions job completed for thread ${threadId}: ` +
        `${successful.length}/${count} successful, ` +
        `${totalTokens} total tokens, $${totalCost.toFixed(4)} total cost`
    );

    return {
      threadId,
      requestedById,
      generated: successful.length,
      failed: suggestions.length - successful.length,
      totalTokens,
      totalCost,
      suggestions: successful.slice(0, 5), // Return max 5 to avoid large payloads
    };
  } catch (error: any) {
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
