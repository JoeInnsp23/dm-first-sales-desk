import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../connection";
import { QUEUE_NAMES } from "../queues";
import { db } from "@/lib/db";
import { orders, threadOrderLinks } from "@/lib/db/schema";
import { ContactsService, ThreadsService, EventsService } from "@/lib/services";
import { eq, and } from "drizzle-orm";

export type OrdersSyncJob = {
  accountId: string;
  channelConnectionId: string;
  channelType: "shopify" | "tiktok_shop";
  orderId?: string;
  orderData: any;
  webhookTopic?: string;
};

async function processOrdersSync(job: Job<OrdersSyncJob>) {
  const { accountId, channelConnectionId, channelType, orderData, webhookTopic } = job.data;

  const externalOrderId = orderData.id || orderData.order_id || orderData.externalOrderId;

  console.log(`Syncing order from ${channelType}: ${externalOrderId}`);

  try {
    // Step 1: Find or create contact from customer data
    let contactId: string | null = null;

    if (orderData.customer) {
      const customer = orderData.customer;

      // Extract customer identifiers based on channel type
      const contactInput: any = {
        accountId,
        name: customer.name || customer.first_name + " " + customer.last_name || "Unknown Customer",
      };

      if (customer.email) contactInput.email = customer.email;
      if (customer.phone) contactInput.phone = customer.phone;

      // Platform-specific identifiers
      if (channelType === "shopify" && customer.id) {
        contactInput.email = customer.email || `shopify_${customer.id}@placeholder.local`;
      } else if (channelType === "tiktok_shop" && customer.user_id) {
        contactInput.tiktokUserId = customer.user_id;
      }

      try {
        const contact = await ContactsService.findOrCreate(contactInput);
        contactId = contact.id;
        console.log(`✓ Found/created contact: ${contact.name} (${contactId})`);
      } catch (error: any) {
        console.error("Failed to create contact:", error.message);
        // Continue without contact linking
      }
    }

    // Step 2: Check if order already exists
    const existingOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.accountId, accountId),
        eq(orders.externalOrderId, externalOrderId.toString())
      ),
    });

    // Step 3: Parse order data based on channel type
    const orderValues = parseOrderData(
      channelType,
      orderData,
      accountId,
      channelConnectionId,
      contactId
    );

    let order;
    if (existingOrder) {
      // Update existing order
      const [updated] = await db
        .update(orders)
        .set({
          ...orderValues,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, existingOrder.id))
        .returning();

      order = updated;
      console.log(`✓ Updated existing order: ${order.orderNumber || order.externalOrderId}`);
    } else {
      // Create new order
      const [created] = await db.insert(orders).values(orderValues).returning();

      order = created;
      console.log(`✓ Created new order: ${order.orderNumber || order.externalOrderId}`);
    }

    // Step 4: Link order to thread if we have a contact
    if (contactId) {
      try {
        // Find or create thread for this contact
        const thread = await ThreadsService.findOrCreate({
          accountId,
          contactId,
          channelConnectionId,
          subject: `Order ${order.orderNumber || order.externalOrderId}`,
        });

        // Check if link already exists
        const existingLink = await db.query.threadOrderLinks.findFirst({
          where: and(
            eq(threadOrderLinks.threadId, thread.id),
            eq(threadOrderLinks.orderId, order.id)
          ),
        });

        if (!existingLink) {
          await db.insert(threadOrderLinks).values({
            threadId: thread.id,
            orderId: order.id,
          });

          console.log(`✓ Linked order to thread: ${thread.id}`);

          // Log event
          await EventsService.logThreadEvent(
            accountId,
            thread.id,
            "order_linked",
            `Order ${order.orderNumber || order.externalOrderId} linked to thread`,
            {
              orderId: order.id,
              externalOrderId: order.externalOrderId,
              orderStatus: order.status,
              totalAmount: order.totalAmount,
            }
          );
        }
      } catch (error: any) {
        console.error("Failed to link order to thread:", error.message);
        // Continue - order is still synced even if thread link fails
      }
    }

    console.log(
      `✓ Order sync completed: ${order.externalOrderId} ` +
        `(${order.status}, ${order.currency} ${order.totalAmount})`
    );

    return {
      success: true,
      orderId: order.id,
      externalOrderId: order.externalOrderId,
      contactId,
      isNew: !existingOrder,
    };
  } catch (error: any) {
    console.error(`Failed to sync order ${externalOrderId}:`, error);
    throw error;
  }
}

/**
 * Parse order data based on channel type
 */
function parseOrderData(
  channelType: "shopify" | "tiktok_shop",
  orderData: any,
  accountId: string,
  channelConnectionId: string,
  contactId: string | null
) {
  const baseData = {
    accountId,
    channelConnectionId,
    contactId,
    source: channelType,
    externalOrderId: (orderData.id || orderData.order_id || orderData.externalOrderId).toString(),
  };

  if (channelType === "shopify") {
    return {
      ...baseData,
      orderNumber: orderData.order_number?.toString() || orderData.name,
      status: mapShopifyStatus(orderData.financial_status, orderData.fulfillment_status),
      fulfillmentStatus: mapShopifyFulfillmentStatus(orderData.fulfillment_status),
      currency: orderData.currency || "USD",
      totalAmount: orderData.total_price || orderData.current_total_price || "0",
      subtotalAmount: orderData.subtotal_price,
      taxAmount: orderData.total_tax,
      shippingAmount: orderData.total_shipping_price_set?.shop_money?.amount,
      discountAmount: orderData.total_discounts,
      lineItems: orderData.line_items?.map((item: any) => ({
        id: item.id?.toString(),
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        sku: item.sku,
        imageUrl: item.image?.src,
      })),
      customerName: orderData.customer
        ? `${orderData.customer.first_name || ""} ${orderData.customer.last_name || ""}`.trim()
        : null,
      customerEmail: orderData.customer?.email,
      customerPhone: orderData.customer?.phone,
      shippingAddress: orderData.shipping_address
        ? {
            name: orderData.shipping_address.name,
            address1: orderData.shipping_address.address1,
            address2: orderData.shipping_address.address2,
            city: orderData.shipping_address.city,
            province: orderData.shipping_address.province,
            country: orderData.shipping_address.country,
            zip: orderData.shipping_address.zip,
            phone: orderData.shipping_address.phone,
          }
        : null,
      trackingNumber: orderData.fulfillments?.[0]?.tracking_number,
      trackingUrl: orderData.fulfillments?.[0]?.tracking_url,
      carrier: orderData.fulfillments?.[0]?.tracking_company,
      metadata: {
        shopifyOrderId: orderData.id,
        shopifyOrderNumber: orderData.order_number,
        tags: orderData.tags,
        note: orderData.note,
      },
      tags: orderData.tags?.split(",").map((t: string) => t.trim()) || [],
      placedAt: new Date(orderData.created_at),
      fulfilledAt: orderData.fulfillments?.[0]?.created_at
        ? new Date(orderData.fulfillments[0].created_at)
        : null,
      cancelledAt: orderData.cancelled_at ? new Date(orderData.cancelled_at) : null,
    };
  } else {
    // TikTok Shop
    return {
      ...baseData,
      orderNumber: orderData.order_id?.toString(),
      status: mapTikTokStatus(orderData.order_status),
      fulfillmentStatus: mapTikTokFulfillmentStatus(orderData.order_status),
      currency: orderData.currency || "USD",
      totalAmount: (orderData.payment?.total_amount || 0).toString(),
      subtotalAmount: (orderData.payment?.sub_total || 0).toString(),
      shippingAmount: (orderData.payment?.shipping_fee || 0).toString(),
      lineItems: orderData.item_list?.map((item: any) => ({
        id: item.sku_id?.toString(),
        name: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.sale_price),
        sku: item.seller_sku,
        imageUrl: item.image_url,
      })),
      customerName: orderData.recipient?.name,
      customerPhone: orderData.recipient?.phone,
      shippingAddress: orderData.recipient
        ? {
            name: orderData.recipient.name,
            address1: orderData.recipient.address_detail,
            city: orderData.recipient.city,
            province: orderData.recipient.state,
            country: orderData.recipient.region_code,
            zip: orderData.recipient.zipcode,
            phone: orderData.recipient.phone,
          }
        : null,
      trackingNumber: orderData.tracking_number,
      metadata: {
        tiktokOrderId: orderData.order_id,
        waybillId: orderData.waybill_id,
      },
      placedAt: orderData.create_time ? new Date(orderData.create_time * 1000) : new Date(),
    };
  }
}

// Status mapping helpers
function mapShopifyStatus(
  financialStatus: string,
  fulfillmentStatus: string
): "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" {
  if (financialStatus === "refunded") return "refunded";
  if (financialStatus === "voided") return "cancelled";
  if (fulfillmentStatus === "fulfilled") return "delivered";
  if (fulfillmentStatus === "partial") return "shipped";
  if (financialStatus === "paid") return "processing";
  if (financialStatus === "pending") return "pending";
  return "confirmed";
}

function mapShopifyFulfillmentStatus(
  status: string
): "unfulfilled" | "partial" | "fulfilled" {
  if (status === "fulfilled") return "fulfilled";
  if (status === "partial") return "partial";
  return "unfulfilled";
}

function mapTikTokStatus(
  status: number | string
): "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" {
  const statusNum = typeof status === "number" ? status : parseInt(status);
  // TikTok Shop status codes (typical values)
  switch (statusNum) {
    case 100:
      return "pending"; // Unpaid
    case 111:
      return "confirmed"; // Awaiting shipment
    case 112:
      return "processing"; // Awaiting collection
    case 114:
      return "shipped"; // Partially shipped
    case 121:
      return "shipped"; // In transit
    case 122:
      return "delivered"; // Delivered
    case 130:
      return "cancelled"; // Cancelled
    case 140:
      return "refunded"; // Completed (with potential refund)
    default:
      return "pending";
  }
}

function mapTikTokFulfillmentStatus(
  status: number | string
): "unfulfilled" | "partial" | "fulfilled" {
  const statusNum = typeof status === "number" ? status : parseInt(status);
  if (statusNum >= 122) return "fulfilled";
  if (statusNum === 114) return "partial";
  return "unfulfilled";
}

export function createOrdersSyncWorker() {
  const worker = new Worker(
    QUEUE_NAMES.ORDERS_SYNC,
    processOrdersSync,
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log("Orders sync job " + job.id + " completed");
  });

  worker.on("failed", (job, err) => {
    console.error("Orders sync job " + (job?.id || "unknown") + " failed:", err);
  });

  return worker;
}
