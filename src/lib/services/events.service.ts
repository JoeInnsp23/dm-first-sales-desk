import { db } from "@/lib/db";
import { domainEvents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export type CreateDomainEventInput = {
  accountId: string;
  eventType: string;
  eventName: string;
  actorId?: string;
  actorType?: "user" | "system" | "webhook";
  aggregateId?: string;
  aggregateType?: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
};

export class EventsService {
  /**
   * Create a domain event
   */
  static async create(input: CreateDomainEventInput) {
    const [event] = await db.insert(domainEvents).values(input).returning();

    return event;
  }

  /**
   * Log a thread event
   */
  static async logThreadEvent(
    accountId: string,
    threadId: string,
    eventType: string,
    eventName: string,
    payload: Record<string, any>,
    actorId?: string
  ) {
    return this.create({
      accountId,
      eventType: `thread.${eventType}`,
      eventName,
      actorId,
      actorType: actorId ? "user" : "system",
      aggregateId: threadId,
      aggregateType: "thread",
      payload,
    });
  }

  /**
   * Log a message event
   */
  static async logMessageEvent(
    accountId: string,
    messageId: string,
    threadId: string,
    eventType: string,
    eventName: string,
    payload: Record<string, any>,
    actorId?: string
  ) {
    return this.create({
      accountId,
      eventType: `message.${eventType}`,
      eventName,
      actorId,
      actorType: actorId ? "user" : "system",
      aggregateId: messageId,
      aggregateType: "message",
      payload: {
        ...payload,
        threadId,
      },
    });
  }

  /**
   * Log a contact event
   */
  static async logContactEvent(
    accountId: string,
    contactId: string,
    eventType: string,
    eventName: string,
    payload: Record<string, any>,
    actorId?: string
  ) {
    return this.create({
      accountId,
      eventType: `contact.${eventType}`,
      eventName,
      actorId,
      actorType: actorId ? "user" : "system",
      aggregateId: contactId,
      aggregateType: "contact",
      payload,
    });
  }

  /**
   * Log a webhook event
   */
  static async logWebhookEvent(
    accountId: string,
    channelType: string,
    eventType: string,
    payload: Record<string, any>,
    metadata?: Record<string, any>
  ) {
    return this.create({
      accountId,
      eventType: `webhook.${channelType}.${eventType}`,
      eventName: `Webhook received: ${channelType} ${eventType}`,
      actorType: "webhook",
      aggregateType: "webhook",
      payload,
      metadata,
    });
  }

  /**
   * Get events for an aggregate (e.g., all events for a thread)
   */
  static async getByAggregate(
    accountId: string,
    aggregateId: string,
    aggregateType: string,
    limit = 100
  ) {
    return db.query.domainEvents.findMany({
      where: and(
        eq(domainEvents.accountId, accountId),
        eq(domainEvents.aggregateId, aggregateId),
        eq(domainEvents.aggregateType, aggregateType)
      ),
      orderBy: desc(domainEvents.occurredAt),
      limit,
    });
  }

  /**
   * Get recent events for an account
   */
  static async getRecent(accountId: string, limit = 100) {
    return db.query.domainEvents.findMany({
      where: eq(domainEvents.accountId, accountId),
      orderBy: desc(domainEvents.occurredAt),
      limit,
    });
  }

  /**
   * Get events by type
   */
  static async getByType(
    accountId: string,
    eventType: string,
    limit = 100
  ) {
    return db.query.domainEvents.findMany({
      where: and(
        eq(domainEvents.accountId, accountId),
        eq(domainEvents.eventType, eventType)
      ),
      orderBy: desc(domainEvents.occurredAt),
      limit,
    });
  }
}
