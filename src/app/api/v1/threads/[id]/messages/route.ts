import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  validateBody,
  validateQuery,
} from "@/lib/api";
import { MessagesService } from "@/lib/services";
import { addJob } from "@/lib/queue";

// List messages schema
const listMessagesSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
  beforeId: z.string().uuid().optional(),
});

// Send message schema
const sendMessageSchema = z.object({
  type: z.enum(["text", "image", "video", "audio", "document"]).default("text"),
  content: z.string().optional(),
  attachments: z
    .array(
      z.object({
        type: z.string(),
        url: z.string().url(),
        mimeType: z.string().optional(),
        filename: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * GET /api/v1/threads/[id]/messages
 * List messages for a thread
 */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const resolvedParams = await params;
    const threadId = resolvedParams?.id as string;
    const query = validateQuery(req, listMessagesSchema);

    const messages = await MessagesService.listByThread(
      threadId,
      auth.accountId,
      {
        page: query.page,
        pageSize: query.pageSize,
        beforeId: query.beforeId,
      }
    );

    return successResponse(messages);
  })
);

/**
 * POST /api/v1/threads/[id]/messages
 * Send a message in a thread
 */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const resolvedParams = await params;
    const threadId = resolvedParams?.id as string;
    const body = await validateBody(req, sendMessageSchema);

    // Get thread to get channel connection info
    const { ThreadsService } = await import("@/lib/services");
    const thread = await ThreadsService.getById(threadId, auth.accountId);

    // Queue outbound message for sending
    await addJob("outboundMessage", "send-message", {
      accountId: auth.accountId,
      threadId,
      channelConnectionId: thread.channelConnectionId,
      channelType: thread.channelConnection.type,
      message: {
        type: body.type,
        content: body.content,
        attachments: body.attachments,
      },
      recipientId: thread.contact.whatsappId || thread.contact.instagramId || thread.contact.tiktokUserId,
      sentByUserId: auth.userId,
    });

    return successResponse({ status: "queued" }, 202);
  })
);
