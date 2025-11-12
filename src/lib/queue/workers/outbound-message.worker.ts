import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { MessagesService, EventsService } from "@/lib/services";

export type OutboundMessageJob = {
  accountId: string;
  threadId: string;
  channelConnectionId: string;
  channelType: "whatsapp" | "instagram" | "tiktok_shop";
  message: {
    type: "text" | "image" | "video" | "audio" | "document";
    content?: string;
    attachments?: Array<{
      type: string;
      url: string;
      mimeType?: string;
      filename?: string;
    }>;
  };
  recipientId: string; // Platform-specific recipient ID
  sentByUserId: string;
  metadata?: Record<string, any>;
};

async function processOutboundMessage(job: Job<OutboundMessageJob>) {
  const { accountId, threadId, channelConnectionId, channelType, message, recipientId, sentByUserId, metadata } = job.data;

  console.log(`Processing outbound message to ${recipientId} via ${channelType}`);

  try {
    // TODO: Implement actual channel adapter sending
    // For now, we'll simulate sending and create the message record

    // Generate a temporary external message ID
    // In production, this would come from the platform API response
    const externalMessageId = `temp_${channelType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create message record
    const newMessage = await MessagesService.create({
      accountId,
      threadId,
      externalMessageId,
      type: message.type,
      content: message.content,
      attachments: message.attachments,
      direction: "outbound",
      status: "pending",
      senderId: sentByUserId,
      senderType: "user",
      sentByUserId,
      metadata: {
        ...metadata,
        recipientId,
        channelType,
      },
    });

    // Simulate sending via channel adapter
    // In production, this would call:
    // - WhatsAppAdapter.sendMessage()
    // - InstagramAdapter.sendMessage()
    // - TikTokChatAdapter.sendMessage()

    // Update message status to sent
    await MessagesService.updateStatus(newMessage.id, accountId, {
      status: "sent",
    });

    // Log event
    await EventsService.logMessageEvent(
      accountId,
      newMessage.id,
      threadId,
      "sent",
      "Message sent",
      { channelType, recipientId },
      sentByUserId
    );

    console.log(`✓ Sent outbound message: ${externalMessageId}`);

    return {
      messageId: newMessage.id,
      externalMessageId,
    };
  } catch (error) {
    console.error(`✗ Failed to send outbound message:`, error);

    // TODO: Update message status to failed
    // await MessagesService.updateStatus(messageId, accountId, {
    //   status: "failed",
    //   errorMessage: error.message,
    // });

    throw error;
  }
}

export function createOutboundMessageWorker() {
  const worker = new Worker(
    QUEUE_NAMES.OUTBOUND_MESSAGE,
    processOutboundMessage,
    {
      connection: createRedisConnection(),
      concurrency: 5, // Limit concurrency to avoid rate limits
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // Per second
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`Outbound message job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Outbound message job ${job?.id} failed:`, err);
  });

  return worker;
}
