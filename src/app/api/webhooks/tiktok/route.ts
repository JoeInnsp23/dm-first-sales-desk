import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TikTokShopAdapter } from "@/lib/integrations";
import { addJob } from "@/lib/queue";
import { EventsService } from "@/lib/services";

/**
 * POST /api/webhooks/tiktok
 * Receive TikTok Shop webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log the webhook
    console.log("TikTok Shop webhook received:", JSON.stringify(body, null, 2));

    // TikTok Shop sends different event types
    const eventType = body.type;

    if (!eventType) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Extract shop ID to find the channel connection
    const shopId = body.shop_id || body.data?.shop_id;

    if (!shopId) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Find channel connection by shop ID
    // In production, you'd query the config field properly
    const connection = await db.query.channelConnections.findFirst({
      where: eq(channelConnections.type, "tiktok_shop"),
    });

    if (!connection) {
      console.error("No TikTok Shop channel connection found");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Verify webhook signature
    const signature = req.headers.get("x-tts-signature") || "";
    const rawBody = JSON.stringify(body);

    const adapter = new TikTokShopAdapter({
      appKey: (connection.config as any).appKey,
      appSecret: (connection.config as any).appSecret,
      accessToken: (connection.config as any).accessToken,
      shopId: (connection.config as any).shopId,
      accountId: connection.accountId,
      channelConnectionId: connection.id,
    });

    if (signature && !adapter.verifyWebhook(rawBody, signature)) {
      console.error("Invalid TikTok Shop webhook signature");
      return NextResponse.json({ status: "forbidden" }, { status: 403 });
    }

    // Handle different event types
    switch (eventType) {
      case "MESSAGE_NEW": {
        // Parse the webhook payload
        const inboundPayload = adapter.parseInboundMessage(body);

        if (!inboundPayload) {
          return NextResponse.json({ status: "ignored" }, { status: 200 });
        }

        // Log webhook event
        await EventsService.logWebhookEvent(
          connection.accountId,
          "tiktok_shop",
          "message_received",
          inboundPayload,
          {
            shopId,
            eventType,
          }
        );

        // Queue the message for processing
        await addJob("inboundMessage", "tiktok-message", inboundPayload);

        return NextResponse.json({ status: "queued" }, { status: 200 });
      }

      case "ORDER_STATUS_CHANGE": {
        // Queue order sync job
        await addJob("ordersSync", "tiktok-order-sync", {
          accountId: connection.accountId,
          channelConnectionId: connection.id,
          channelType: "tiktok_shop",
          orderId: body.data.order_id,
          orderData: body.data,
        });

        // Log webhook event
        await EventsService.logWebhookEvent(
          connection.accountId,
          "tiktok_shop",
          "order_status_change",
          body.data,
          {
            shopId,
            orderId: body.data.order_id,
          }
        );

        return NextResponse.json({ status: "queued" }, { status: 200 });
      }

      default:
        console.log(`Unhandled TikTok Shop event type: ${eventType}`);
        return NextResponse.json({ status: "ignored" }, { status: 200 });
    }
  } catch (error) {
    console.error("Error processing TikTok Shop webhook:", error);
    // Return 200 to prevent TikTok from retrying
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
