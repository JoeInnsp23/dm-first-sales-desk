import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ShopifyAdapter } from "@/lib/integrations";
import { addJob } from "@/lib/queue";
import { EventsService } from "@/lib/services";

/**
 * POST /api/webhooks/shopify
 * Receive Shopify webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Log the webhook
    console.log("Shopify webhook received:", JSON.stringify(body, null, 2));

    // Get the webhook topic from headers
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

    if (!topic || !shopDomain || !hmacHeader) {
      return NextResponse.json(
        { error: "Missing required headers" },
        { status: 400 }
      );
    }

    // Find channel connection by shop domain
    // In production, you'd query the config field properly
    const connection = await db.query.channelConnections.findFirst({
      where: eq(channelConnections.type, "shopify"),
    });

    if (!connection) {
      console.error("No Shopify channel connection found");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Verify webhook signature
    const adapter = new ShopifyAdapter({
      storeDomain: (connection.config as any).storeDomain,
      accessToken: (connection.config as any).accessToken,
      webhookSecret: (connection.config as any).webhookSecret,
      accountId: connection.accountId,
      channelConnectionId: connection.id,
    });

    if (!adapter.verifyWebhook(rawBody, hmacHeader)) {
      console.error("Invalid Shopify webhook signature");
      return NextResponse.json({ status: "forbidden" }, { status: 403 });
    }

    // Handle different webhook topics
    switch (topic) {
      case "orders/create":
      case "orders/updated":
      case "orders/paid":
      case "orders/fulfilled":
      case "orders/cancelled": {
        // Parse order data
        const orderData = adapter.parseOrderWebhook(body);

        // Queue order sync job
        await addJob("ordersSync", "shopify-order-sync", {
          accountId: connection.accountId,
          channelConnectionId: connection.id,
          channelType: "shopify",
          orderData,
          webhookTopic: topic,
        });

        // Log webhook event
        await EventsService.logWebhookEvent(
          connection.accountId,
          "shopify",
          topic,
          orderData,
          {
            shopDomain,
            orderId: orderData.externalOrderId,
          }
        );

        return NextResponse.json({ status: "queued" }, { status: 200 });
      }

      case "customers/create":
      case "customers/update": {
        // Log webhook event for tracking
        await EventsService.logWebhookEvent(
          connection.accountId,
          "shopify",
          topic,
          body,
          {
            shopDomain,
            customerId: body.id?.toString(),
          }
        );

        // Could queue a job to sync customer data if needed
        return NextResponse.json({ status: "acknowledged" }, { status: 200 });
      }

      default:
        console.log(`Unhandled Shopify webhook topic: ${topic}`);
        return NextResponse.json({ status: "ignored" }, { status: 200 });
    }
  } catch (error) {
    console.error("Error processing Shopify webhook:", error);
    // Return 200 to prevent Shopify from retrying
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
