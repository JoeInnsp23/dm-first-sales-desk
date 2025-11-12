import crypto from "crypto";
import {
  ChannelAdapter,
  OutboundMessage,
  InboundWebhookPayload,
} from "../types";

export interface WhatsAppConfig {
  apiToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  accountId: string;
  channelConnectionId: string;
}

export class WhatsAppAdapter implements ChannelAdapter {
  constructor(private config: WhatsAppConfig) {}

  /**
   * Send a message via WhatsApp Business API
   */
  async sendMessage(
    recipientId: string,
    message: OutboundMessage
  ): Promise<string> {
    const url = `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientId,
    };

    if (message.type === "text" && message.content) {
      payload.type = "text";
      payload.text = { body: message.content };
    } else if (message.type === "image" && message.attachments?.[0]) {
      payload.type = "image";
      payload.image = {
        link: message.attachments[0].url,
        caption: message.content,
      };
    } else if (message.type === "video" && message.attachments?.[0]) {
      payload.type = "video";
      payload.video = {
        link: message.attachments[0].url,
        caption: message.content,
      };
    } else if (message.type === "document" && message.attachments?.[0]) {
      payload.type = "document";
      payload.document = {
        link: message.attachments[0].url,
        caption: message.content,
        filename: message.attachments[0].filename,
      };
    } else {
      throw new Error(`Unsupported message type: ${message.type}`);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.messages[0].id;
  }

  /**
   * Verify WhatsApp webhook signature
   */
  verifyWebhook(payload: any, signature: string): boolean {
    // WhatsApp doesn't use signature verification for webhooks
    // Instead, it uses a verify token during setup
    return true;
  }

  /**
   * Verify webhook setup (GET request)
   */
  verifyWebhookSetup(
    mode: string,
    token: string,
    challenge: string
  ): string | null {
    if (mode === "subscribe" && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Parse inbound WhatsApp webhook message
   */
  parseInboundMessage(payload: any): InboundWebhookPayload | null {
    try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value?.messages?.[0]) {
        return null; // Not a message event
      }

      const message = value.messages[0];
      const contact = value.contacts?.[0];
      const metadata = value.metadata;

      // Extract message content based on type
      let content: string | undefined;
      let attachments: any[] | undefined;
      let messageType: any = "text";

      if (message.type === "text") {
        content = message.text?.body;
        messageType = "text";
      } else if (message.type === "image") {
        messageType = "image";
        attachments = [
          {
            type: "image",
            url: message.image.id, // This is a media ID, needs to be fetched
            mimeType: message.image.mime_type,
          },
        ];
        content = message.image.caption;
      } else if (message.type === "video") {
        messageType = "video";
        attachments = [
          {
            type: "video",
            url: message.video.id,
            mimeType: message.video.mime_type,
          },
        ];
        content = message.video.caption;
      } else if (message.type === "audio") {
        messageType = "audio";
        attachments = [
          {
            type: "audio",
            url: message.audio.id,
            mimeType: message.audio.mime_type,
          },
        ];
      } else if (message.type === "document") {
        messageType = "document";
        attachments = [
          {
            type: "document",
            url: message.document.id,
            mimeType: message.document.mime_type,
            filename: message.document.filename,
          },
        ];
        content = message.document.caption;
      } else if (message.type === "sticker") {
        messageType = "sticker";
        attachments = [
          {
            type: "sticker",
            url: message.sticker.id,
            mimeType: message.sticker.mime_type,
          },
        ];
      } else if (message.type === "location") {
        messageType = "location";
        content = `Location: ${message.location.latitude}, ${message.location.longitude}`;
      }

      return {
        accountId: this.config.accountId,
        channelConnectionId: this.config.channelConnectionId,
        channelType: "whatsapp",
        externalMessageId: message.id,
        message: {
          type: messageType,
          content,
          attachments,
          sentAt: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        },
        sender: {
          id: message.from,
          name: contact?.profile?.name,
          phone: message.from,
        },
        metadata: {
          phoneNumberId: metadata?.phone_number_id,
          displayPhoneNumber: metadata?.display_phone_number,
        },
      };
    } catch (error) {
      console.error("Error parsing WhatsApp webhook:", error);
      return null;
    }
  }

  /**
   * Fetch media URL from WhatsApp (media ID -> actual URL)
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const url = `https://graph.facebook.com/v21.0/${mediaId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch media URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.url;
  }
}
