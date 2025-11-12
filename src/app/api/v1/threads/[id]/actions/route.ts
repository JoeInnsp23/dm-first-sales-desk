import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  validateBody,
  BadRequestError,
} from "@/lib/api";
import { ThreadsService } from "@/lib/services";

// Action schema
const actionSchema = z.object({
  action: z.enum([
    "mark_read",
    "mark_unread",
    "star",
    "unstar",
    "assign",
    "unassign",
    "snooze",
    "unsnooze",
    "close",
    "reopen",
    "archive",
  ]),
  // Optional parameters for specific actions
  userId: z.string().optional(), // For assign action
  snoozedUntil: z.string().datetime().optional(), // For snooze action
});

/**
 * POST /api/v1/threads/[id]/actions
 * Perform actions on a thread
 */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const resolvedParams = await params;
    const threadId = resolvedParams?.id as string;
    const body = await validateBody(req, actionSchema);

    let thread;

    switch (body.action) {
      case "mark_read":
        thread = await ThreadsService.markAsRead(threadId, auth.accountId);
        break;

      case "mark_unread":
        thread = await ThreadsService.markAsUnread(threadId, auth.accountId);
        break;

      case "star":
      case "unstar":
        thread = await ThreadsService.toggleStar(threadId, auth.accountId);
        break;

      case "assign":
        if (!body.userId) {
          throw new BadRequestError("userId is required for assign action");
        }
        thread = await ThreadsService.assign(
          threadId,
          auth.accountId,
          body.userId
        );
        break;

      case "unassign":
        thread = await ThreadsService.unassign(threadId, auth.accountId);
        break;

      case "snooze":
        if (!body.snoozedUntil) {
          throw new BadRequestError("snoozedUntil is required for snooze action");
        }
        thread = await ThreadsService.snooze(
          threadId,
          auth.accountId,
          new Date(body.snoozedUntil)
        );
        break;

      case "unsnooze":
        thread = await ThreadsService.unsnooze(threadId, auth.accountId);
        break;

      case "close":
        thread = await ThreadsService.close(threadId, auth.accountId);
        break;

      case "reopen":
        thread = await ThreadsService.reopen(threadId, auth.accountId);
        break;

      case "archive":
        thread = await ThreadsService.archive(threadId, auth.accountId);
        break;

      default:
        throw new BadRequestError(`Unknown action: ${body.action}`);
    }

    return successResponse(thread);
  })
);
