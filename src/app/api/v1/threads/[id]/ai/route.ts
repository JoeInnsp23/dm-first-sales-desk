import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  validateBody,
} from "@/lib/api";
import { AIService } from "@/lib/ai";

// AI action schema
const aiActionSchema = z.object({
  action: z.enum(["suggest_reply", "analyze_sentiment", "generate_summary"]),
  model: z
    .enum(["claude-3-5-sonnet", "claude-3-haiku", "gpt-4", "gpt-3.5-turbo"])
    .optional(),
  tone: z.enum(["professional", "friendly", "casual"]).optional(),
  language: z.string().optional(),
});

/**
 * POST /api/v1/threads/[id]/ai
 * Generate AI suggestions for a thread
 */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const threadId = params?.id as string;
    const body = await validateBody(req, aiActionSchema);

    let result;

    switch (body.action) {
      case "suggest_reply":
        result = await AIService.generateReplySuggestion(
          threadId,
          auth.accountId,
          {
            model: body.model,
            tone: body.tone,
            language: body.language,
          }
        );
        break;

      case "analyze_sentiment":
        result = await AIService.analyzeSentiment(threadId, auth.accountId, {
          model: body.model,
        });
        break;

      case "generate_summary":
        result = await AIService.generateSummary(threadId, auth.accountId, {
          model: body.model,
        });
        break;

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return successResponse(result);
  })
);
