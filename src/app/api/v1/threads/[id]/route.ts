import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  validateBody,
  NotFoundError,
} from "@/lib/api";
import { ThreadsService } from "@/lib/services";

// Update thread schema
const updateThreadSchema = z.object({
  subject: z.string().optional(),
  status: z.enum(["open", "snoozed", "closed", "archived"]).optional(),
  pipelineStage: z.enum(["lead", "engaged", "converted", "lost"]).optional(),
  assignedToId: z.string().nullable().optional(),
  isStarred: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  snoozedUntil: z.string().datetime().optional(),
});

/**
 * GET /api/v1/threads/[id]
 * Get thread by ID
 */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const id = params?.id as string;
    const thread = await ThreadsService.getById(id, auth.accountId);
    return successResponse(thread);
  })
);

/**
 * PATCH /api/v1/threads/[id]
 * Update thread
 */
export const PATCH = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const id = params?.id as string;
    const body = await validateBody(req, updateThreadSchema);

    const updates: any = { ...body };

    // Convert snoozedUntil to Date if provided
    if (body.snoozedUntil) {
      updates.snoozedUntil = new Date(body.snoozedUntil);
    }

    const thread = await ThreadsService.update(id, auth.accountId, updates);
    return successResponse(thread);
  })
);

/**
 * DELETE /api/v1/threads/[id]
 * Archive thread (soft delete)
 */
export const DELETE = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const id = params?.id as string;
    const thread = await ThreadsService.archive(id, auth.accountId);
    return successResponse(thread);
  })
);
