import crypto from "crypto";
import {
  ChannelAdapter,
  OutboundMessage,
  InboundWebhookPayload,
} from "../types";

export interface TikTokShopConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopId: string;
  accountId: string;
  channelConnectionId: string;
}

export class TikTokShopAdapter implements ChannelAdapter {
  constructor(private config: TikTokShopConfig) {}

  /**
   * Send a message via TikTok Shop Chat API
   */
  async sendMessage(
    recipientId: string,
    message: OutboundMessage
  ): Promise<string> {
    const url = "https://open-api.tiktokglobalshop.com/api/chat/conversation/send";

    const timestamp = Math.floor(Date.now() / 1000);

    const payload: any = {
      shop_id: this.config.shopId,
      conversation_id: recipientId,
      message_type: 1, // Text message
    };

    if (message.type === "text" && message.content) {
      payload.text = message.content;
    } else if (message.type === "image" && message.attachments?.[0]) {
      payload.message_type = 2; // Image
      payload.image_url = message.attachments[0].url;
    } else {
      throw new Error(`Unsupported message type: ${message.type}`);
    }

    const signature = this.generateSignature(payload, timestamp);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tts-access-token": this.config.accessToken,
        "x-tts-timestamp": timestamp.toString(),
        "x-tts-signature": signature,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`TikTok Shop API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.data.message_id;
  }

  /**
   * Verify TikTok Shop webhook signature
   */
  verifyWebhook(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", this.config.appSecret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate signature for API requests
   */
  private generateSignature(payload: any, timestamp: number): string {
    const signString = `${this.config.appKey}${timestamp}${JSON.stringify(payload)}`;

    return crypto
      .createHmac("sha256", this.config.appSecret)
      .update(signString)
      .digest("hex");
  }

  /**
   * Parse inbound TikTok Shop webhook message
   */
  parseInboundMessage(payload: any): InboundWebhookPayload | null {
    try {
      const data = payload.data;

      // Handle message event
      if (payload.type === "MESSAGE_NEW") {
        const message = data.message;

        let content: string | undefined;
        let attachments: any[] | undefined;
        let messageType: any = "text";

        if (message.message_type === 1) {
          // Text
          content = message.text;
          messageType = "text";
        } else if (message.message_type === 2) {
          // Image
          messageType = "image";
          attachments = [
            {
              type: "image",
              url: message.image_url,
            },
          ];
        }

        return {
          accountId: this.config.accountId,
          channelConnectionId: this.config.channelConnectionId,
          channelType: "tiktok_shop",
          externalMessageId: message.message_id,
          message: {
            type: messageType,
            content,
            attachments,
            sentAt: new Date(message.create_time * 1000).toISOString(),
          },
          sender: {
            id: message.from_user_id || data.conversation.buyer_user_id,
            name: data.conversation.buyer_nickname,
          },
          metadata: {
            conversationId: data.conversation.conversation_id,
            orderId: data.conversation.order_id,
          },
        };
      }

      return null;
    } catch (error) {
      console.error("Error parsing TikTok Shop webhook:", error);
      return null;
    }
  }

  /**
   * Get order details (for SLA tracking)
   */
  async getOrderDetails(orderId: string): Promise<{
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
    status: string;
    createdAt: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      sku?: string;
      imageUrl?: string;
    }>;
  }> {
    const url = "https://open-api.tiktokglobalshop.com/api/orders/detail";
    const timestamp = Math.floor(Date.now() / 1000);

    const params = {
      shop_id: this.config.shopId,
      order_id: orderId,
    };

    const signature = this.generateSignature(params, timestamp);

    const response = await fetch(
      `${url}?${new URLSearchParams(params as any)}`,
      {
        headers: {
          "x-tts-access-token": this.config.accessToken,
          "x-tts-timestamp": timestamp.toString(),
          "x-tts-signature": signature,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch order: ${response.statusText}`);
    }

    const data = await response.json();
    const order = data.data;

    return {
      orderId: order.id,
      orderNumber: order.order_line_item_id,
      totalAmount: parseFloat(order.payment.total_amount),
      currency: order.payment.currency,
      status: order.order_status,
      createdAt: new Date(order.create_time * 1000).toISOString(),
      items: order.item_list.map((item: any) => ({
        id: item.id,
        name: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.sale_price),
        sku: item.seller_sku,
        imageUrl: item.product_image?.url,
      })),
    };
  }

  /**
   * Calculate SLA deadline for message response
   * TikTok Shop requires 24-hour response time
   */
  calculateSlaDeadline(messageTime: Date): Date {
    const deadline = new Date(messageTime);
    deadline.setHours(deadline.getHours() + 24);
    return deadline;
  }

  /**
   * Check if SLA is at risk (within 2 hours of deadline)
   */
  isSlaAtRisk(deadline: Date): boolean {
    const now = new Date();
    const twoHours = 2 * 60 * 60 * 1000;
    return deadline.getTime() - now.getTime() < twoHours;
  }
}
