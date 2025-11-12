import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { NotFoundError } from "@/lib/api";

export type CreateContactInput = {
  accountId: string;
  name?: string;
  email?: string;
  phone?: string;
  whatsappId?: string;
  instagramId?: string;
  tiktokUserId?: string;
  shopifyCustomerId?: string;
  avatarUrl?: string;
  profileData?: Record<string, any>;
  customFields?: Record<string, any>;
  tags?: string[];
  notes?: string;
};

export type UpdateContactInput = Partial<Omit<CreateContactInput, "accountId">>;

export type FindOrCreateContactInput = {
  accountId: string;
  whatsappId?: string;
  instagramId?: string;
  tiktokUserId?: string;
  phone?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  profileData?: Record<string, any>;
};

export class ContactsService {
  /**
   * Create a new contact
   */
  static async create(input: CreateContactInput) {
    const [contact] = await db
      .insert(contacts)
      .values({
        ...input,
        tags: input.tags ? sql`${JSON.stringify(input.tags)}::jsonb` : sql`'[]'::jsonb`,
        lastContactedAt: new Date(),
      })
      .returning();

    return contact;
  }

  /**
   * Find or create a contact based on platform identifiers
   * This is used during webhook processing to auto-create contacts
   */
  static async findOrCreate(input: FindOrCreateContactInput) {
    const { accountId, whatsappId, instagramId, tiktokUserId, phone, email } =
      input;

    // Build search conditions based on available identifiers
    const searchConditions = [];

    if (whatsappId) {
      searchConditions.push(eq(contacts.whatsappId, whatsappId));
    }
    if (instagramId) {
      searchConditions.push(eq(contacts.instagramId, instagramId));
    }
    if (tiktokUserId) {
      searchConditions.push(eq(contacts.tiktokUserId, tiktokUserId));
    }
    if (phone) {
      searchConditions.push(eq(contacts.phone, phone));
    }
    if (email) {
      searchConditions.push(eq(contacts.email, email));
    }

    if (searchConditions.length === 0) {
      throw new Error("At least one identifier is required");
    }

    // Try to find existing contact
    const existingContact = await db.query.contacts.findFirst({
      where: and(eq(contacts.accountId, accountId), or(...searchConditions)),
    });

    if (existingContact) {
      // Update contact with any new information
      const [updatedContact] = await db
        .update(contacts)
        .set({
          whatsappId: whatsappId || existingContact.whatsappId,
          instagramId: instagramId || existingContact.instagramId,
          tiktokUserId: tiktokUserId || existingContact.tiktokUserId,
          phone: phone || existingContact.phone,
          email: email || existingContact.email,
          name: input.name || existingContact.name,
          avatarUrl: input.avatarUrl || existingContact.avatarUrl,
          profileData: input.profileData || existingContact.profileData,
          lastContactedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, existingContact.id))
        .returning();

      return updatedContact;
    }

    // Create new contact
    return this.create({
      accountId,
      whatsappId,
      instagramId,
      tiktokUserId,
      phone,
      email,
      name: input.name,
      avatarUrl: input.avatarUrl,
      profileData: input.profileData,
    });
  }

  /**
   * Get contact by ID
   */
  static async getById(id: string, accountId: string) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, id), eq(contacts.accountId, accountId)),
    });

    if (!contact) {
      throw new NotFoundError("Contact not found");
    }

    return contact;
  }

  /**
   * Update contact
   */
  static async update(id: string, accountId: string, input: UpdateContactInput) {
    const [contact] = await db
      .update(contacts)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.accountId, accountId)))
      .returning();

    if (!contact) {
      throw new NotFoundError("Contact not found");
    }

    return contact;
  }

  /**
   * Search contacts
   */
  static async search(accountId: string, query: string, limit = 20) {
    return db.query.contacts.findMany({
      where: and(
        eq(contacts.accountId, accountId),
        or(
          ilike(contacts.name, `%${query}%`),
          ilike(contacts.email, `%${query}%`),
          ilike(contacts.phone, `%${query}%`)
        )
      ),
      limit,
      orderBy: (contacts, { desc }) => [desc(contacts.lastContactedAt)],
    });
  }

  /**
   * List contacts with pagination
   */
  static async list(
    accountId: string,
    options: {
      page?: number;
      pageSize?: number;
      tags?: string[];
    } = {}
  ) {
    const { page = 1, pageSize = 50, tags } = options;
    const offset = (page - 1) * pageSize;

    let query = db.query.contacts.findMany({
      where: eq(contacts.accountId, accountId),
      limit: pageSize,
      offset,
      orderBy: (contacts, { desc }) => [desc(contacts.lastContactedAt)],
    });

    // TODO: Add tag filtering when needed
    // This would require a JSONB query

    return query;
  }

  /**
   * Merge two contacts
   */
  static async merge(
    primaryId: string,
    secondaryId: string,
    accountId: string
  ) {
    const primary = await this.getById(primaryId, accountId);
    const secondary = await this.getById(secondaryId, accountId);

    // Merge data - primary takes precedence, but fill in missing fields
    const merged = {
      name: primary.name || secondary.name,
      email: primary.email || secondary.email,
      phone: primary.phone || secondary.phone,
      whatsappId: primary.whatsappId || secondary.whatsappId,
      instagramId: primary.instagramId || secondary.instagramId,
      tiktokUserId: primary.tiktokUserId || secondary.tiktokUserId,
      shopifyCustomerId:
        primary.shopifyCustomerId || secondary.shopifyCustomerId,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      profileData: {
        ...(secondary.profileData || {}),
        ...(primary.profileData || {}),
      },
      customFields: {
        ...(secondary.customFields || {}),
        ...(primary.customFields || {}),
      },
      tags: Array.from(
        new Set([...(primary.tags || []), ...(secondary.tags || [])])
      ),
      notes: [primary.notes, secondary.notes].filter(Boolean).join("\n\n"),
    };

    // Update primary with merged data
    const [updatedContact] = await db
      .update(contacts)
      .set(merged)
      .where(eq(contacts.id, primaryId))
      .returning();

    // TODO: Move threads and messages from secondary to primary
    // This would involve updating foreign keys in threads table

    // Delete secondary contact
    await db
      .delete(contacts)
      .where(and(eq(contacts.id, secondaryId), eq(contacts.accountId, accountId)));

    return updatedContact;
  }

  /**
   * Add tags to contact
   */
  static async addTags(id: string, accountId: string, newTags: string[]) {
    const contact = await this.getById(id, accountId);
    const currentTags = contact.tags || [];
    const mergedTags = Array.from(new Set([...currentTags, ...newTags]));

    return this.update(id, accountId, { tags: mergedTags });
  }

  /**
   * Remove tags from contact
   */
  static async removeTags(id: string, accountId: string, tagsToRemove: string[]) {
    const contact = await this.getById(id, accountId);
    const currentTags = contact.tags || [];
    const filteredTags = currentTags.filter((tag) => !tagsToRemove.includes(tag));

    return this.update(id, accountId, { tags: filteredTags });
  }
}
