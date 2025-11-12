import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users, accountMemberships } from "@/lib/db/schema";
import { cache } from "react";

export type AuthContext = {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  accountId: string;
  role: "owner" | "admin" | "agent";
};

/**
 * Get the authenticated user's context including their account
 * This is cached per request to avoid multiple DB calls
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Get user from database (sync with Clerk)
  let dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // If user doesn't exist in DB, create from Clerk data
  if (!dbUser) {
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const [newUser] = await db
      .insert(users)
      .values({
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: clerkUser.fullName,
        avatarUrl: clerkUser.imageUrl,
      })
      .returning();

    dbUser = newUser;
  }

  // Get user's primary account membership
  const membership = await db.query.accountMemberships.findFirst({
    where: eq(accountMemberships.userId, userId),
    with: {
      account: true,
    },
  });

  if (!membership) {
    // User has no account - needs onboarding
    return null;
  }

  return {
    userId,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
    },
    accountId: membership.accountId,
    role: membership.role,
  };
});

/**
 * Require authentication and return context
 * Throws error if not authenticated
 */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    throw new Error("Unauthorized");
  }

  return context;
}

/**
 * Check if user has required role
 */
export function hasRole(
  context: AuthContext,
  requiredRole: "owner" | "admin" | "agent"
): boolean {
  const roleHierarchy = {
    owner: 3,
    admin: 2,
    agent: 1,
  };

  return roleHierarchy[context.role] >= roleHierarchy[requiredRole];
}

/**
 * Require specific role
 */
export async function requireRole(
  requiredRole: "owner" | "admin" | "agent"
): Promise<AuthContext> {
  const context = await requireAuth();

  if (!hasRole(context, requiredRole)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return context;
}
