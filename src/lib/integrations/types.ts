// Base types for channel integrations

export type ChannelType = "whatsapp" | "instagram" | "tiktok_shop" | "shopify";

export type MessageType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";

export interface BaseMessage {
  type: MessageType;
  content?: string;
  attachments?: Array<{
    type: string;
    url: string;
    mimeType?: string;
    filename?: string;
    size?: number;
  }>;
}

export interface InboundWebhookPayload {
  accountId: string;
  channelConnectionId: string;
  channelType: ChannelType;
  externalMessageId: string;
  message: BaseMessage & {
    sentAt: string;
  };
  sender: {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string;
    profileData?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export interface OutboundMessage {
  type: MessageType;
  content?: string;
  attachments?: Array<{
    type: string;
    url: string;
    mimeType?: string;
    filename?: string;
  }>;
}

export interface ChannelAdapter {
  sendMessage(recipientId: string, message: OutboundMessage): Promise<string>;
  verifyWebhook(payload: any, signature: string): boolean;
  parseInboundMessage(payload: any): InboundWebhookPayload | null;
}
