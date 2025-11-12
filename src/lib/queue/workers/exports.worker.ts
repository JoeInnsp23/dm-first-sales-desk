import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { db } from "@/lib/db";
import { messages, threads, contacts, orders } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { EventsService } from "@/lib/services";

export type ExportsJob = {
  accountId: string;
  userId: string;
  exportType: "messages" | "contacts" | "threads" | "orders";
  format: "csv" | "json";
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    threadIds?: string[];
    contactIds?: string[];
    status?: string[];
  };
  filename?: string;
};

/**
 * Convert array of objects to CSV format
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      // Handle nested objects and arrays
      if (typeof value === "object" && value !== null) {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      // Escape quotes in strings
      if (typeof value === "string") {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? "";
    }).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

async function processExport(job: Job<ExportsJob>) {
  const { accountId, userId, exportType, format, filters, filename } = job.data;

  console.log(`Generating ${exportType} export in ${format} format for account ${accountId}`);

  try {
    let data: any[] = [];
    let recordCount = 0;

    // Fetch data based on export type
    switch (exportType) {
      case "messages": {
        const conditions: any[] = [eq(messages.accountId, accountId)];

        if (filters?.dateFrom) {
          conditions.push(gte(messages.sentAt, new Date(filters.dateFrom)));
        }
        if (filters?.dateTo) {
          conditions.push(lte(messages.sentAt, new Date(filters.dateTo)));
        }
        if (filters?.threadIds && filters.threadIds.length > 0) {
          conditions.push(inArray(messages.threadId, filters.threadIds));
        }

        const results = await db.query.messages.findMany({
          where: and(...conditions),
          orderBy: (messages, { desc }) => [desc(messages.sentAt)],
          limit: 10000, // Limit exports to 10k records
        });

        data = results.map((msg) => ({
          id: msg.id,
          threadId: msg.threadId,
          externalMessageId: msg.externalMessageId,
          type: msg.type,
          content: msg.content,
          direction: msg.direction,
          status: msg.status,
          senderName: msg.senderName,
          sentAt: msg.sentAt.toISOString(),
          deliveredAt: msg.deliveredAt?.toISOString(),
          readAt: msg.readAt?.toISOString(),
          createdAt: msg.createdAt.toISOString(),
        }));

        recordCount = data.length;
        break;
      }

      case "contacts": {
        const conditions: any[] = [eq(contacts.accountId, accountId)];

        if (filters?.contactIds && filters.contactIds.length > 0) {
          conditions.push(inArray(contacts.id, filters.contactIds));
        }

        const results = await db.query.contacts.findMany({
          where: and(...conditions),
          orderBy: (contacts, { desc }) => [desc(contacts.createdAt)],
          limit: 10000,
        });

        data = results.map((contact) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          whatsappId: contact.whatsappId,
          instagramId: contact.instagramId,
          tiktokUserId: contact.tiktokUserId,
          tags: contact.tags,
          // lifecycleStage: contact.lifecycleStage, // Field not in schema
          // totalOrderValue: contact.totalOrderValue, // Field not in schema
          lastContactedAt: contact.lastContactedAt?.toISOString(),
          createdAt: contact.createdAt.toISOString(),
        }));

        recordCount = data.length;
        break;
      }

      case "threads": {
        const conditions: any[] = [eq(threads.accountId, accountId)];

        if (filters?.status && filters.status.length > 0) {
          conditions.push(inArray(threads.status, filters.status as any));
        }
        if (filters?.dateFrom) {
          conditions.push(gte(threads.createdAt, new Date(filters.dateFrom)));
        }
        if (filters?.dateTo) {
          conditions.push(lte(threads.createdAt, new Date(filters.dateTo)));
        }

        const results = await db.query.threads.findMany({
          where: and(...conditions),
          orderBy: (threads, { desc }) => [desc(threads.lastMessageAt)],
          limit: 10000,
        });

        data = results.map((thread) => ({
          id: thread.id,
          subject: thread.subject,
          status: thread.status,
          pipelineStage: thread.pipelineStage,
          // priority: thread.priority, // Field not in schema
          assignedToId: thread.assignedToId,
          contactId: thread.contactId,
          // messageCount: thread.messageCount, // Field not in schema
          isRead: thread.isRead,
          isStarred: thread.isStarred,
          tags: thread.tags,
          lastMessageAt: thread.lastMessageAt?.toISOString(),
          // firstMessageAt: thread.firstMessageAt // Field not in schema?.toISOString(),
          closedAt: thread.closedAt?.toISOString(),
          createdAt: thread.createdAt.toISOString(),
        }));

        recordCount = data.length;
        break;
      }

      case "orders": {
        const conditions: any[] = [eq(orders.accountId, accountId)];

        if (filters?.status && filters.status.length > 0) {
          conditions.push(inArray(orders.status, filters.status as any));
        }
        if (filters?.dateFrom) {
          conditions.push(gte(orders.placedAt, new Date(filters.dateFrom)));
        }
        if (filters?.dateTo) {
          conditions.push(lte(orders.placedAt, new Date(filters.dateTo)));
        }

        const results = await db.query.orders.findMany({
          where: and(...conditions),
          orderBy: (orders, { desc }) => [desc(orders.placedAt)],
          limit: 10000,
        });

        data = results.map((order) => ({
          id: order.id,
          externalOrderId: order.externalOrderId,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerName: order.customerName,
          // paymentStatus: order.paymentStatus, // Field not in schema
          fulfillmentStatus: order.fulfillmentStatus,
          placedAt: order.placedAt.toISOString(),
          // paidAt: order.paidAt // Field not in schema?.toISOString(),
          // fulfilledAt: order.fulfilledAt?.toISOString(), // Field not in schema
          createdAt: order.createdAt.toISOString(),
        }));

        recordCount = data.length;
        break;
      }

      default:
        throw new Error(`Unsupported export type: ${exportType}`);
    }

    // Convert to requested format
    let exportData: string;
    let contentType: string;
    let fileExtension: string;

    if (format === "csv") {
      exportData = convertToCSV(data);
      contentType = "text/csv";
      fileExtension = "csv";
    } else {
      exportData = JSON.stringify(data, null, 2);
      contentType = "application/json";
      fileExtension = "json";
    }

    const exportFilename = filename || `${exportType}_export_${Date.now()}.${fileExtension}`;

    // In a real implementation, you would:
    // 1. Upload the file to S3 or similar storage
    // 2. Generate a signed URL
    // 3. Send email notification with download link
    // For now, we'll just log the result

    console.log(`✓ Export generated: ${exportFilename} (${recordCount} records, ${exportData.length} bytes)`);

    // Log export event (commented out for now)
//     // await EventsService.create({
//       accountId,
//       aggregateType: "export" as const,
//       aggregateId: "export-" + Date.now(),
//       "export_completed",  description: "Export completed",
//       type: "webhook_received",
//       description: `${exportType} export completed`,
//       metadata: {
//         exportType,
//         format,
//         recordCount,
//         fileSize: exportData.length,
//         filename: exportFilename,
//         userId,
//       },
//     });

    // TODO: Upload to S3 and send notification
    // const uploadUrl = await uploadToS3(exportData, exportFilename, contentType);
    // await sendExportNotification(userId, exportFilename, uploadUrl);

    return {
      success: true,
      filename: exportFilename,
      recordCount,
      fileSize: exportData.length,
      // downloadUrl: uploadUrl,
    };
  } catch (error) {
    console.error(`✗ Failed to generate ${exportType} export:`, error);

    // Log failed export event
//     // await EventsService.create({
//       accountId,
//       aggregateType: "export" as const,
//       aggregateId: "export-" + Date.now(),
//       "export_completed",  description: "Export completed",
//       type: "webhook_received",
//       description: `${exportType} export failed`,
//       metadata: {
//         exportType,
//         format,
//         error: (error as Error).message,
//         userId,
//       },
//     });

    throw error;
  }
}

export function createExportsWorker() {
  const worker = new Worker(
    QUEUE_NAMES.EXPORTS,
    processExport,
    {
      connection: createRedisConnection(),
      concurrency: 2, // Limit concurrent exports to prevent overload
    }
  );

  worker.on("completed", (job) => {
    console.log(`Export job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Export job ${job?.id} failed:`, err);
  });

  return worker;
}
