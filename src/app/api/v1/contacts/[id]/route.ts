import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withErrorHandling,
  successResponse,
  validateBody,
} from "@/lib/api";
import { ContactsService } from "@/lib/services";

// Update contact schema
const updateContactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/contacts/[id]
 * Get contact by ID
 */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const resolvedParams = await params;
    const id = resolvedParams?.id as string;
    const contact = await ContactsService.getById(id, auth.accountId);
    return successResponse(contact);
  })
);

/**
 * PATCH /api/v1/contacts/[id]
 * Update contact
 */
export const PATCH = withErrorHandling(
  withAuth(async (req: NextRequest, { params, auth }) => {
    const resolvedParams = await params;
    const id = resolvedParams?.id as string;
    const body = await validateBody(req, updateContactSchema);

    const contact = await ContactsService.update(id, auth.accountId, body);
    return successResponse(contact);
  })
);
