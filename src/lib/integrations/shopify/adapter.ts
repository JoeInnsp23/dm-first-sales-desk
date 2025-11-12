import crypto from "crypto";

export interface ShopifyConfig {
  storeDomain: string;
  accessToken: string;
  webhookSecret: string;
  accountId: string;
  channelConnectionId: string;
}

export class ShopifyAdapter {
  constructor(private config: ShopifyConfig) {}

  /**
   * Verify Shopify webhook HMAC signature
   */
  verifyWebhook(payload: string, hmacHeader: string): boolean {
    const hash = crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(payload, "utf8")
      .digest("base64");

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  }

  /**
   * Parse Shopify order webhook
   */
  parseOrderWebhook(payload: any): {
    accountId: string;
    channelConnectionId: string;
    externalOrderId: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    currency: string;
    customer: {
      email?: string;
      phone?: string;
      name?: string;
    };
    lineItems: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
      sku?: string;
      imageUrl?: string;
    }>;
    shippingAddress?: {
      name?: string;
      address1?: string;
      address2?: string;
      city?: string;
      province?: string;
      country?: string;
      zip?: string;
      phone?: string;
    };
    placedAt: string;
  } {
    return {
      accountId: this.config.accountId,
      channelConnectionId: this.config.channelConnectionId,
      externalOrderId: payload.id.toString(),
      orderNumber: payload.name || payload.order_number?.toString(),
      status: this.mapOrderStatus(payload.financial_status, payload.fulfillment_status),
      totalAmount: parseFloat(payload.total_price),
      currency: payload.currency,
      customer: {
        email: payload.customer?.email,
        phone: payload.customer?.phone,
        name: `${payload.customer?.first_name || ""} ${payload.customer?.last_name || ""}`.trim(),
      },
      lineItems: payload.line_items?.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        sku: item.sku,
        imageUrl: item.image_url,
      })) || [],
      shippingAddress: payload.shipping_address ? {
        name: payload.shipping_address.name,
        address1: payload.shipping_address.address1,
        address2: payload.shipping_address.address2,
        city: payload.shipping_address.city,
        province: payload.shipping_address.province,
        country: payload.shipping_address.country,
        zip: payload.shipping_address.zip,
        phone: payload.shipping_address.phone,
      } : undefined,
      placedAt: payload.created_at,
    };
  }

  /**
   * Map Shopify order status to our internal status
   */
  private mapOrderStatus(
    financialStatus: string,
    fulfillmentStatus: string | null
  ): string {
    if (financialStatus === "refunded") return "refunded";
    if (financialStatus === "voided") return "cancelled";

    if (fulfillmentStatus === "fulfilled") return "delivered";
    if (fulfillmentStatus === "partial") return "shipped";
    if (fulfillmentStatus === null && financialStatus === "paid") return "confirmed";

    return "pending";
  }

  /**
   * Get order from Shopify API
   */
  async getOrder(orderId: string): Promise<any> {
    const url = `https://${this.config.storeDomain}/admin/api/2024-01/orders/${orderId}.json`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.config.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Shopify order: ${response.statusText}`);
    }

    const data = await response.json();
    return data.order;
  }

  /**
   * Search for customer by email or phone
   */
  async searchCustomer(query: { email?: string; phone?: string }): Promise<any[]> {
    let searchQuery = "";
    if (query.email) {
      searchQuery = `email:${query.email}`;
    } else if (query.phone) {
      searchQuery = `phone:${query.phone}`;
    }

    const url = `https://${this.config.storeDomain}/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.config.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search Shopify customers: ${response.statusText}`);
    }

    const data = await response.json();
    return data.customers || [];
  }

  /**
   * Get customer orders
   */
  async getCustomerOrders(customerId: string): Promise<any[]> {
    const url = `https://${this.config.storeDomain}/admin/api/2024-01/customers/${customerId}/orders.json`;

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": this.config.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch customer orders: ${response.statusText}`);
    }

    const data = await response.json();
    return data.orders || [];
  }
}
