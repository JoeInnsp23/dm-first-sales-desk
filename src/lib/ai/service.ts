import { getAIClient, AIModel } from "./client";
import { db } from "@/lib/db";
import { aiSuggestions } from "@/lib/db/schema";
import { MessagesService, ThreadsService } from "@/lib/services";
import { eq } from "drizzle-orm";

export type SentimentType = "positive" | "neutral" | "negative";

export class AIService {
  /**
   * Generate a reply suggestion based on conversation context
   */
  static async generateReplySuggestion(
    threadId: string,
    accountId: string,
    options: {
      model?: AIModel;
      tone?: "professional" | "friendly" | "casual";
      language?: string;
    } = {}
  ): Promise<{
    suggestion: string;
    tokensUsed: number;
    costUsd: number;
  }> {
    const { model = "claude-3-5-sonnet", tone = "friendly", language = "English" } = options;

    // Get thread and recent messages
    const thread = await ThreadsService.getById(threadId, accountId);
    const messages = await MessagesService.listByThread(threadId, accountId, {
      pageSize: 10,
    });

    // Build conversation context
    const conversationContext = messages
      .reverse()
      .map((msg) => {
        const sender = msg.direction === "inbound" ? "Customer" : "Agent";
        return `${sender}: ${msg.content || "[Media message]"}`;
      })
      .join("\n");

    const systemPrompt = `You are a helpful customer service assistant. Generate a ${tone} reply in ${language} that:
- Addresses the customer's question or concern
- Is clear and concise
- Maintains a ${tone} tone
- Is appropriate for the conversation context`;

    const prompt = `Based on this conversation, suggest an appropriate reply:

${conversationContext}

Generate a reply suggestion:`;

    const client = getAIClient();
    const response = await client.complete(prompt, {
      model,
      systemPrompt,
      maxTokens: 500,
      temperature: 0.7,
    });

    // Save the suggestion
    const [suggestion] = await db
      .insert(aiSuggestions)
      .values({
        accountId,
        threadId,
        type: "reply",
        model: response.model as any,
        prompt,
        suggestion: response.content,
        tokensUsed: response.tokensUsed,
        costUsd: response.costUsd,
      })
      .returning();

    return {
      suggestion: response.content,
      tokensUsed: response.tokensUsed,
      costUsd: response.costUsd,
    };
  }

  /**
   * Analyze sentiment of conversation
   */
  static async analyzeSentiment(
    threadId: string,
    accountId: string,
    options: {
      model?: AIModel;
    } = {}
  ): Promise<{
    sentiment: SentimentType;
    confidence: number;
    explanation: string;
  }> {
    const { model = "claude-3-haiku" } = options;

    // Get recent messages
    const messages = await MessagesService.listByThread(threadId, accountId, {
      pageSize: 10,
    });

    const conversationContext = messages
      .reverse()
      .filter((msg) => msg.direction === "inbound") // Only analyze customer messages
      .map((msg) => msg.content || "[Media message]")
      .join("\n");

    const systemPrompt = `You are a sentiment analysis assistant. Analyze the sentiment of customer messages and respond in JSON format.`;

    const prompt = `Analyze the sentiment of these customer messages:

${conversationContext}

Respond with JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": 0-100,
  "explanation": "brief explanation"
}`;

    const client = getAIClient();
    const response = await client.complete(prompt, {
      model,
      systemPrompt,
      maxTokens: 300,
      temperature: 0.3,
    });

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(response.content);
    } catch (error) {
      // Fallback if parsing fails
      result = {
        sentiment: "neutral",
        confidence: 50,
        explanation: "Unable to determine sentiment",
      };
    }

    // Save the analysis
    await db.insert(aiSuggestions).values({
      accountId,
      threadId,
      type: "sentiment",
      model: response.model as any,
      prompt,
      suggestion: response.content,
      tokensUsed: response.tokensUsed,
      costUsd: response.costUsd,
      sentiment: result.sentiment as any,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Generate conversation summary
   */
  static async generateSummary(
    threadId: string,
    accountId: string,
    options: {
      model?: AIModel;
    } = {}
  ): Promise<{
    summary: string;
    keyPoints: string[];
  }> {
    const { model = "claude-3-haiku" } = options;

    // Get all messages
    const messages = await MessagesService.listByThread(threadId, accountId, {
      pageSize: 50,
    });

    const conversationContext = messages
      .reverse()
      .map((msg) => {
        const sender = msg.direction === "inbound" ? "Customer" : "Agent";
        return `${sender}: ${msg.content || "[Media message]"}`;
      })
      .join("\n");

    const systemPrompt = `You are a conversation summarization assistant. Create concise summaries with key points in JSON format.`;

    const prompt = `Summarize this conversation:

${conversationContext}

Respond with JSON:
{
  "summary": "brief 2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"]
}`;

    const client = getAIClient();
    const response = await client.complete(prompt, {
      model,
      systemPrompt,
      maxTokens: 500,
      temperature: 0.5,
    });

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(response.content);
    } catch (error) {
      result = {
        summary: "Unable to generate summary",
        keyPoints: [],
      };
    }

    // Save the summary
    await db.insert(aiSuggestions).values({
      accountId,
      threadId,
      type: "summary",
      model: response.model as any,
      prompt,
      suggestion: response.content,
      tokensUsed: response.tokensUsed,
      costUsd: response.costUsd,
    });

    return result;
  }

  /**
   * Mark AI suggestion as used
   */
  static async markSuggestionAsUsed(
    suggestionId: string,
    wasHelpful: boolean,
    feedbackNote?: string
  ) {
    await db
      .update(aiSuggestions)
      .set({
        wasUsed: true,
        wasHelpful,
        feedbackNote,
        reviewedAt: new Date(),
      })
      .where(eq(aiSuggestions.id, suggestionId));
  }
}
