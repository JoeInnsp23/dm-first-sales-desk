import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  paginatedResponse,
  validateQuery,
} from "@/lib/api";
import { ThreadsService } from "@/lib/services";

// Query parameters schema
const listThreadsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
  status: z.enum(["open", "snoozed", "closed", "archived"]).optional(),
  assignedToId: z.string().optional(),
  pipelineStage: z.enum(["lead", "engaged", "converted", "lost"]).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  starredOnly: z.coerce.boolean().optional(),
  slaCriticalOnly: z.coerce.boolean().optional(),
});

/**
 * GET /api/v1/threads
 * List threads with filtering and pagination
 */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { auth }) => {
    const query = validateQuery(req, listThreadsSchema);

    const result = await ThreadsService.list(auth.accountId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      assignedToId: query.assignedToId,
      pipelineStage: query.pipelineStage,
      unreadOnly: query.unreadOnly,
      starredOnly: query.starredOnly,
      slaCriticalOnly: query.slaCriticalOnly,
    });

    return paginatedResponse(result.threads, result.pagination);
  })
);
