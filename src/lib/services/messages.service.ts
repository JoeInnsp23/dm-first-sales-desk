import { db } from "@/lib/db";
import { messages, threads } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError } from "@/lib/api";
import { ThreadsService } from "./threads.service";

export type CreateMessageInput = {
  accountId: string;
  threadId: string;
  externalMessageId: string;
  type?: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
  content?: string;
  attachments?: Array<{
    type: string;
    url: string;
    mimeType?: string;
    filename?: string;
    size?: number;
  }>;
  direction: "inbound" | "outbound";
  status?: "pending" | "sent" | "delivered" | "read" | "failed";
  senderId: string;
  senderType: "user" | "contact";
  senderName?: string;
  sentByUserId?: string;
  metadata?: Record<string, any>;
  sentAt?: Date;
};

export type UpdateMessageStatusInput = {
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  deliveredAt?: Date;
  readAt?: Date;
  errorMessage?: string;
};

export class MessagesService {
  /**
   * Create a new message
   * This automatically deduplicates based on externalMessageId
   */
  static async create(input: CreateMessageInput) {
    // Check if message already exists (deduplication)
    const existing = await db.query.messages.findFirst({
      where: eq(messages.externalMessageId, input.externalMessageId),
    });

    if (existing) {
      return existing;
    }

    // Create message
    const [message] = await db
      .insert(messages)
      .values({
        ...input,
        isRead: input.direction === "outbound", // Outbound messages are marked as read
        sentAt: input.sentAt || new Date(),
      })
      .returning();

    // Update thread with last message info
    if (input.content) {
      await ThreadsService.updateLastMessage(
        input.threadId,
        input.accountId,
        input.content
      );
    }

    return message;
  }

  /**
   * Get message by ID
   */
  static async getById(id: string, accountId: string) {
    const message = await db.query.messages.findFirst({
      where: and(eq(messages.id, id), eq(messages.accountId, accountId)),
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return message;
  }

  /**
   * Get message by external ID (for webhook deduplication)
   */
  static async getByExternalId(externalMessageId: string) {
    return db.query.messages.findFirst({
      where: eq(messages.externalMessageId, externalMessageId),
    });
  }

  /**
   * List messages for a thread
   */
  static async listByThread(
    threadId: string,
    accountId: string,
    options: {
      page?: number;
      pageSize?: number;
      beforeId?: string;
    } = {}
  ) {
    const { page = 1, pageSize = 50, beforeId } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(messages.threadId, threadId),
      eq(messages.accountId, accountId),
    ];

    // If beforeId is provided, get messages before that message (for cursor pagination)
    if (beforeId) {
      const beforeMessage = await this.getById(beforeId, accountId);
      conditions.push(messages.sentAt < beforeMessage.sentAt);
    }

    const results = await db.query.messages.findMany({
      where: and(...conditions),
      limit: pageSize,
      offset: beforeId ? 0 : offset, // Don't use offset with cursor pagination
      orderBy: desc(messages.sentAt),
    });

    return results;
  }

  /**
   * Update message status (for delivery/read receipts)
   */
  static async updateStatus(
    id: string,
    accountId: string,
    input: UpdateMessageStatusInput
  ) {
    const updates: any = {
      status: input.status,
      updatedAt: new Date(),
    };

    if (input.deliveredAt) {
      updates.deliveredAt = input.deliveredAt;
    }

    if (input.readAt) {
      updates.readAt = input.readAt;
      updates.isRead = true;
    }

    if (input.errorMessage) {
      updates.errorMessage = input.errorMessage;
    }

    const [message] = await db
      .update(messages)
      .set(updates)
      .where(and(eq(messages.id, id), eq(messages.accountId, accountId)))
      .returning();

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return message;
  }

  /**
   * Update message status by external ID
   * Useful for webhook status updates
   */
  static async updateStatusByExternalId(
    externalMessageId: string,
    input: UpdateMessageStatusInput
  ) {
    const message = await this.getByExternalId(externalMessageId);

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return this.updateStatus(message.id, message.accountId, input);
  }

  /**
   * Mark message as read
   */
  static async markAsRead(id: string, accountId: string) {
    return this.updateStatus(id, accountId, {
      status: "read",
      readAt: new Date(),
    });
  }

  /**
   * Mark all messages in a thread as read
   */
  static async markThreadAsRead(threadId: string, accountId: string) {
    await db
      .update(messages)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.accountId, accountId),
          eq(messages.isRead, false)
        )
      );

    // Update thread read status
    await ThreadsService.markAsRead(threadId, accountId);
  }

  /**
   * Get unread message count for a thread
   */
  static async getUnreadCount(threadId: string, accountId: string) {
    const unreadMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.threadId, threadId),
        eq(messages.accountId, accountId),
        eq(messages.isRead, false),
        eq(messages.direction, "inbound")
      ),
    });

    return unreadMessages.length;
  }

  /**
   * Get latest message for a thread
   */
  static async getLatest(threadId: string, accountId: string) {
    return db.query.messages.findFirst({
      where: and(eq(messages.threadId, threadId), eq(messages.accountId, accountId)),
      orderBy: desc(messages.sentAt),
    });
  }

  /**
   * Delete message
   */
  static async delete(id: string, accountId: string) {
    const message = await this.getById(id, accountId);

    await db
      .delete(messages)
      .where(and(eq(messages.id, id), eq(messages.accountId, accountId)));

    return message;
  }

  /**
   * Get message statistics for a thread
   */
  static async getThreadStats(threadId: string, accountId: string) {
    const allMessages = await db.query.messages.findMany({
      where: and(eq(messages.threadId, threadId), eq(messages.accountId, accountId)),
    });

    const stats = {
      total: allMessages.length,
      inbound: allMessages.filter((m) => m.direction === "inbound").length,
      outbound: allMessages.filter((m) => m.direction === "outbound").length,
      unread: allMessages.filter((m) => !m.isRead && m.direction === "inbound")
        .length,
      withAttachments: allMessages.filter(
        (m) => m.attachments && m.attachments.length > 0
      ).length,
    };

    return stats;
  }
}
