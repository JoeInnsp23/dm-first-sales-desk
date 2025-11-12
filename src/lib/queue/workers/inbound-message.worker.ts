import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { ContactsService, ThreadsService, MessagesService, EventsService } from "@/lib/services";

export type InboundMessageJob = {
  accountId: string;
  channelConnectionId: string;
  channelType: "whatsapp" | "instagram" | "tiktok_shop";
  externalMessageId: string;
  message: {
    type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
    content?: string;
    attachments?: Array<{
      type: string;
      url: string;
      mimeType?: string;
      filename?: string;
      size?: number;
    }>;
    sentAt: string;
  };
  sender: {
    id: string; // Platform-specific ID
    name?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string;
    profileData?: Record<string, any>;
  };
  metadata?: Record<string, any>;
};

async function processInboundMessage(job: Job<InboundMessageJob>) {
  const { accountId, channelConnectionId, channelType, externalMessageId, message, sender, metadata } = job.data;

  console.log(`Processing inbound message: ${externalMessageId} from ${channelType}`);

  try {
    // Step 1: Find or create contact
    const contactInput: any = {
      accountId,
      name: sender.name,
      phone: sender.phone,
      email: sender.email,
      avatarUrl: sender.avatarUrl,
      profileData: sender.profileData,
    };

    // Map platform-specific ID
    if (channelType === "whatsapp") {
      contactInput.whatsappId = sender.id;
    } else if (channelType === "instagram") {
      contactInput.instagramId = sender.id;
    } else if (channelType === "tiktok_shop") {
      contactInput.tiktokUserId = sender.id;
    }

    const contact = await ContactsService.findOrCreate(contactInput);

    // Log contact event
    await EventsService.logContactEvent(
      accountId,
      contact.id,
      "updated",
      "Contact updated from inbound message",
      { channelType, messageId: externalMessageId }
    );

    // Step 2: Find or create thread
    const thread = await ThreadsService.findOrCreate({
      accountId,
      contactId: contact.id,
      channelConnectionId,
      metadata: {
        channelType,
      },
    });

    // Log thread event
    await EventsService.logThreadEvent(
      accountId,
      thread.id,
      "message_received",
      "New message received",
      { channelType, messageId: externalMessageId }
    );

    // Step 3: Create message
    const newMessage = await MessagesService.create({
      accountId,
      threadId: thread.id,
      externalMessageId,
      type: message.type,
      content: message.content,
      attachments: message.attachments,
      direction: "inbound",
      status: "delivered",
      senderId: sender.id,
      senderType: "contact",
      senderName: sender.name,
      metadata,
      sentAt: new Date(message.sentAt),
    });

    // Log message event
    await EventsService.logMessageEvent(
      accountId,
      newMessage.id,
      thread.id,
      "received",
      "Message received",
      { channelType, externalMessageId }
    );

    console.log(`✓ Processed inbound message: ${externalMessageId}`);

    return {
      contactId: contact.id,
      threadId: thread.id,
      messageId: newMessage.id,
    };
  } catch (error) {
    console.error(`✗ Failed to process inbound message: ${externalMessageId}`, error);
    throw error;
  }
}

export function createInboundMessageWorker() {
  const worker = new Worker(
    QUEUE_NAMES.INBOUND_MESSAGE,
    processInboundMessage,
    {
      connection: createRedisConnection(),
      concurrency: 10, // Process up to 10 messages concurrently
    }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
}
