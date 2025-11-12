import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  validateBody,
  validateQuery,
} from "@/lib/api";
import { ContactsService } from "@/lib/services";

// List contacts schema
const listContactsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
  q: z.string().optional(), // Search query
});

// Create contact schema
const createContactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/contacts
 * List or search contacts
 */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { auth }) => {
    const query = validateQuery(req, listContactsSchema);

    // If search query provided, use search
    if (query.q) {
      const contacts = await ContactsService.search(auth.accountId, query.q);
      return successResponse(contacts);
    }

    // Otherwise list with pagination
    const contacts = await ContactsService.list(auth.accountId, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return successResponse(contacts);
  })
);

/**
 * POST /api/v1/contacts
 * Create a new contact
 */
export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, { auth }) => {
    const body = await validateBody(req, createContactSchema);

    const contact = await ContactsService.create({
      accountId: auth.accountId,
      ...body,
    });

    return successResponse(contact, 201);
  })
);
