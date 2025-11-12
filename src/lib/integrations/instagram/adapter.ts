import crypto from "crypto";
import {
  ChannelAdapter,
  OutboundMessage,
  InboundWebhookPayload,
} from "../types";

export interface InstagramConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  pageId: string;
  accountId: string;
  channelConnectionId: string;
}

export class InstagramAdapter implements ChannelAdapter {
  constructor(private config: InstagramConfig) {}

  /**
   * Send a message via Instagram Messaging API
   */
  async sendMessage(
    recipientId: string,
    message: OutboundMessage
  ): Promise<string> {
    const url = `https://graph.facebook.com/v21.0/me/messages`;

    const payload: any = {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
    };

    if (message.type === "text" && message.content) {
      payload.message = {
        text: message.content,
      };
    } else if (message.type === "image" && message.attachments?.[0]) {
      payload.message = {
        attachment: {
          type: "image",
          payload: {
            url: message.attachments[0].url,
            is_reusable: true,
          },
        },
      };
    } else {
      throw new Error(`Unsupported message type: ${message.type}`);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Instagram API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.message_id;
  }

  /**
   * Verify Instagram webhook signature
   */
  verifyWebhook(payload: string, signature: string): boolean {
    const [algorithm, hash] = signature.split("=");

    if (algorithm !== "sha256") {
      return false;
    }

    const expectedHash = crypto
      .createHmac("sha256", this.config.appSecret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedHash)
    );
  }

  /**
   * Verify webhook setup (GET request)
   */
  verifyWebhookSetup(
    mode: string,
    token: string,
    challenge: string
  ): string | null {
    if (mode === "subscribe" && token === this.config.appSecret) {
      return challenge;
    }
    return null;
  }

  /**
   * Parse inbound Instagram webhook message
   */
  parseInboundMessage(payload: any): InboundWebhookPayload | null {
    try {
      const entry = payload.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (!messaging?.message) {
        return null; // Not a message event
      }

      const message = messaging.message;
      const sender = messaging.sender;

      let content: string | undefined;
      let attachments: any[] | undefined;
      let messageType: any = "text";

      if (message.text) {
        content = message.text;
        messageType = "text";
      } else if (message.attachments) {
        const attachment = message.attachments[0];
        messageType = attachment.type as any;

        attachments = [
          {
            type: attachment.type,
            url: attachment.payload.url,
          },
        ];
      }

      return {
        accountId: this.config.accountId,
        channelConnectionId: this.config.channelConnectionId,
        channelType: "instagram",
        externalMessageId: message.mid,
        message: {
          type: messageType,
          content,
          attachments,
          sentAt: new Date(messaging.timestamp).toISOString(),
        },
        sender: {
          id: sender.id,
        },
        metadata: {
          pageId: this.config.pageId,
        },
      };
    } catch (error) {
      console.error("Error parsing Instagram webhook:", error);
      return null;
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userId: string): Promise<{
    name?: string;
    username?: string;
    profilePicture?: string;
  }> {
    const url = `https://graph.facebook.com/v21.0/${userId}?fields=name,username,profile_pic&access_token=${this.config.accessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      name: data.name,
      username: data.username,
      profilePicture: data.profile_pic,
    };
  }
}
