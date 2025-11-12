import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireAuth, requireRole } from "@/lib/auth";
import { ZodError, z } from "zod";

export type ApiHandler<T = any> = (
  req: NextRequest,
  context: {
    params?: Record<string, string>;
  }
) => Promise<NextResponse<T>>;

export type AuthenticatedApiHandler<T = any> = (
  req: NextRequest,
  context: {
    params?: Record<string, string>;
    auth: Awaited<ReturnType<typeof requireAuth>>;
  }
) => Promise<NextResponse<T>>;

/**
 * API error classes
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class BadRequestError extends ApiError {
  constructor(message = "Bad request") {
    super(400, message, "BAD_REQUEST");
  }
}

export class ValidationError extends ApiError {
  constructor(
    message = "Validation error",
    public errors?: Record<string, string[]>
  ) {
    super(422, message, "VALIDATION_ERROR");
  }
}

/**
 * Wrap API handler with error handling
 */
export function withErrorHandling<T>(
  handler: ApiHandler<T>
): (
  req: NextRequest,
  context: { params?: Record<string, string> }
) => Promise<NextResponse> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error("API Error:", error);

      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            error: {
              message: error.message,
              code: error.code,
              ...(error instanceof ValidationError && { errors: error.errors }),
            },
          },
          { status: error.statusCode }
        );
      }

      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              message: "Validation error",
              code: "VALIDATION_ERROR",
              errors: error.flatten().fieldErrors,
            },
          },
          { status: 422 }
        );
      }

      // Unhandled error
      return NextResponse.json(
        {
          error: {
            message: "Internal server error",
            code: "INTERNAL_ERROR",
          },
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Require authentication for API route
 */
export function withAuth<T>(
  handler: AuthenticatedApiHandler<T>
): ApiHandler<T> {
  return async (req, context) => {
    const auth = await getAuthContext();

    if (!auth) {
      throw new UnauthorizedError();
    }

    return handler(req, { ...context, auth });
  };
}

/**
 * Require specific role for API route
 */
export function withRole<T>(
  role: "owner" | "admin" | "agent",
  handler: AuthenticatedApiHandler<T>
): ApiHandler<T> {
  return async (req, context) => {
    const auth = await requireRole(role);

    return handler(req, { ...context, auth });
  };
}

/**
 * Validate request body with Zod schema
 */
export async function validateBody<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Validation error", error.flatten().fieldErrors);
    }
    throw new BadRequestError("Invalid JSON body");
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQuery<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): z.infer<T> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError("Validation error", error.flatten().fieldErrors);
    }
    throw new BadRequestError("Invalid query parameters");
  }
}

/**
 * Helper to create success response
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

/**
 * Helper to create paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  }
) {
  return NextResponse.json({
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}
