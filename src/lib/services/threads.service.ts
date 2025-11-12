import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { NotFoundError } from "@/lib/api";

export type CreateThreadInput = {
  accountId: string;
  contactId: string;
  channelConnectionId: string;
  externalThreadId?: string;
  subject?: string;
  status?: "open" | "snoozed" | "closed" | "archived";
  pipelineStage?: "lead" | "engaged" | "converted" | "lost";
  metadata?: Record<string, any>;
};

export type UpdateThreadInput = {
  subject?: string;
  status?: "open" | "snoozed" | "closed" | "archived";
  pipelineStage?: "lead" | "engaged" | "converted" | "lost";
  assignedToId?: string | null;
  isRead?: boolean;
  isStarred?: boolean;
  tags?: string[];
  snoozedUntil?: Date | null;
  metadata?: Record<string, any>;
};

export type ListThreadsOptions = {
  page?: number;
  pageSize?: number;
  status?: "open" | "snoozed" | "closed" | "archived";
  assignedToId?: string;
  pipelineStage?: "lead" | "engaged" | "converted" | "lost";
  unreadOnly?: boolean;
  starredOnly?: boolean;
  slaCriticalOnly?: boolean;
};

export class ThreadsService {
  /**
   * Create a new thread
   */
  static async create(input: CreateThreadInput) {
    const [thread] = await db.insert(threads).values(input).returning();

    return thread;
  }

  /**
   * Find or create thread for a contact on a specific channel
   */
  static async findOrCreate(input: CreateThreadInput) {
    // Try to find existing thread
    const existingThread = await db.query.threads.findFirst({
      where: and(
        eq(threads.accountId, input.accountId),
        eq(threads.contactId, input.contactId),
        eq(threads.channelConnectionId, input.channelConnectionId)
      ),
    });

    if (existingThread) {
      // If thread was closed or archived, reopen it
      if (
        existingThread.status === "closed" ||
        existingThread.status === "archived"
      ) {
        return this.update(existingThread.id, input.accountId, {
          status: "open",
        });
      }
      return existingThread;
    }

    // Create new thread
    return this.create(input);
  }

  /**
   * Get thread by ID with related data
   */
  static async getById(id: string, accountId: string) {
    const thread = await db.query.threads.findFirst({
      where: and(eq(threads.id, id), eq(threads.accountId, accountId)),
      with: {
        contact: true,
        channelConnection: true,
        assignedTo: true,
      },
    });

    if (!thread) {
      throw new NotFoundError("Thread not found");
    }

    return thread;
  }

  /**
   * Update thread
   */
  static async update(id: string, accountId: string, input: UpdateThreadInput) {
    const updates: any = {
      ...input,
      updatedAt: new Date(),
    };

    // Handle status changes
    if (input.status === "closed") {
      updates.closedAt = new Date();
    } else if (input.status === "open") {
      updates.closedAt = null;
      updates.snoozedUntil = null;
    }

    const [thread] = await db
      .update(threads)
      .set(updates)
      .where(and(eq(threads.id, id), eq(threads.accountId, accountId)))
      .returning();

    if (!thread) {
      throw new NotFoundError("Thread not found");
    }

    return thread;
  }

  /**
   * Update thread last message metadata
   * Called when new message is added
   */
  static async updateLastMessage(
    id: string,
    accountId: string,
    messagePreview: string
  ) {
    await db
      .update(threads)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: messagePreview.substring(0, 200),
        hasUnreadMessages: true,
        updatedAt: new Date(),
      })
      .where(and(eq(threads.id, id), eq(threads.accountId, accountId)));
  }

  /**
   * Mark thread as read
   */
  static async markAsRead(id: string, accountId: string) {
    return this.update(id, accountId, {
      isRead: true,
      hasUnreadMessages: false,
    });
  }

  /**
   * Mark thread as unread
   */
  static async markAsUnread(id: string, accountId: string) {
    return this.update(id, accountId, {
      isRead: false,
      hasUnreadMessages: true,
    });
  }

  /**
   * Toggle star status
   */
  static async toggleStar(id: string, accountId: string) {
    const thread = await this.getById(id, accountId);
    return this.update(id, accountId, {
      isStarred: !thread.isStarred,
    });
  }

  /**
   * Snooze thread until a specific time
   */
  static async snooze(id: string, accountId: string, until: Date) {
    return this.update(id, accountId, {
      status: "snoozed",
      snoozedUntil: until,
    });
  }

  /**
   * Un-snooze thread
   */
  static async unsnooze(id: string, accountId: string) {
    return this.update(id, accountId, {
      status: "open",
      snoozedUntil: null,
    });
  }

  /**
   * Close thread
   */
  static async close(id: string, accountId: string) {
    return this.update(id, accountId, {
      status: "closed",
    });
  }

  /**
   * Reopen thread
   */
  static async reopen(id: string, accountId: string) {
    return this.update(id, accountId, {
      status: "open",
    });
  }

  /**
   * Archive thread
   */
  static async archive(id: string, accountId: string) {
    return this.update(id, accountId, {
      status: "archived",
    });
  }

  /**
   * Assign thread to user
   */
  static async assign(id: string, accountId: string, userId: string) {
    return this.update(id, accountId, {
      assignedToId: userId,
    });
  }

  /**
   * Unassign thread
   */
  static async unassign(id: string, accountId: string) {
    return this.update(id, accountId, {
      assignedToId: null,
    });
  }

  /**
   * Update pipeline stage
   */
  static async updatePipelineStage(
    id: string,
    accountId: string,
    stage: "lead" | "engaged" | "converted" | "lost"
  ) {
    return this.update(id, accountId, {
      pipelineStage: stage,
    });
  }

  /**
   * Add tags to thread
   */
  static async addTags(id: string, accountId: string, newTags: string[]) {
    const thread = await this.getById(id, accountId);
    const currentTags = thread.tags || [];
    const mergedTags = Array.from(new Set([...currentTags, ...newTags]));

    return this.update(id, accountId, { tags: mergedTags });
  }

  /**
   * List threads with filtering and pagination
   */
  static async list(accountId: string, options: ListThreadsOptions = {}) {
    const {
      page = 1,
      pageSize = 50,
      status,
      assignedToId,
      pipelineStage,
      unreadOnly,
      starredOnly,
      slaCriticalOnly,
    } = options;

    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(threads.accountId, accountId)];

    if (status) {
      conditions.push(eq(threads.status, status));
    }

    if (assignedToId) {
      conditions.push(eq(threads.assignedToId, assignedToId));
    }

    if (pipelineStage) {
      conditions.push(eq(threads.pipelineStage, pipelineStage));
    }

    if (unreadOnly) {
      conditions.push(eq(threads.hasUnreadMessages, true));
    }

    if (starredOnly) {
      conditions.push(eq(threads.isStarred, true));
    }

    if (slaCriticalOnly) {
      conditions.push(eq(threads.isSlaCritical, true));
    }

    const results = await db.query.threads.findMany({
      where: and(...conditions),
      with: {
        contact: true,
        channelConnection: true,
        assignedTo: true,
      },
      limit: pageSize,
      offset,
      orderBy: desc(threads.lastMessageAt),
    });

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(threads)
      .where(and(...conditions));

    return {
      threads: results,
      pagination: {
        page,
        pageSize,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / pageSize),
      },
    };
  }

  /**
   * Get threads by pipeline stage (for Kanban board)
   */
  static async getByPipelineStage(accountId: string) {
    const allThreads = await db.query.threads.findMany({
      where: and(
        eq(threads.accountId, accountId),
        or(eq(threads.status, "open"), eq(threads.status, "snoozed"))
      ),
      with: {
        contact: true,
        channelConnection: true,
      },
      orderBy: desc(threads.lastMessageAt),
    });

    // Group by stage
    const stages = {
      lead: allThreads.filter((t) => t.pipelineStage === "lead"),
      engaged: allThreads.filter((t) => t.pipelineStage === "engaged"),
      converted: allThreads.filter((t) => t.pipelineStage === "converted"),
      lost: allThreads.filter((t) => t.pipelineStage === "lost"),
    };

    return stages;
  }

  /**
   * Get threads requiring attention (SLA critical, unread, etc.)
   */
  static async getAttentionRequired(accountId: string) {
    return db.query.threads.findMany({
      where: and(
        eq(threads.accountId, accountId),
        eq(threads.status, "open"),
        or(eq(threads.isSlaCritical, true), eq(threads.hasUnreadMessages, true))
      ),
      with: {
        contact: true,
        channelConnection: true,
      },
      orderBy: [desc(threads.isSlaCritical), desc(threads.lastMessageAt)],
      limit: 50,
    });
  }

  /**
   * Check and update SLA status for TikTok Shop threads
   */
  static async updateSlaStatus(id: string, accountId: string) {
    const thread = await this.getById(id, accountId);

    if (!thread.slaDeadline) {
      return thread;
    }

    const now = new Date();
    const isCritical = thread.slaDeadline < now;

    if (isCritical !== thread.isSlaCritical) {
      return this.update(id, accountId, {
        isSlaCritical: isCritical,
      });
    }

    return thread;
  }
}
