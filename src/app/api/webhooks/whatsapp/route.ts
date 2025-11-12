import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { WhatsAppAdapter } from "@/lib/integrations";
import { addJob } from "@/lib/queue";
import { EventsService } from "@/lib/services";

/**
 * GET /api/webhooks/whatsapp
 * Webhook verification for WhatsApp
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // TODO: Get verify token from config
  // For now, just return the challenge
  if (mode === "subscribe" && challenge) {
    console.log("WhatsApp webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Receive WhatsApp webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log the webhook
    console.log("WhatsApp webhook received:", JSON.stringify(body, null, 2));

    // Extract phone number ID to find the channel connection
    const phoneNumberId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Find channel connection by phone number ID
    // In production, you'd query the config field properly
    const connection = await db.query.channelConnections.findFirst({
      where: eq(channelConnections.type, "whatsapp"),
    });

    if (!connection) {
      console.error("No WhatsApp channel connection found");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Create adapter with connection config
    const adapter = new WhatsAppAdapter({
      apiToken: (connection.config as any).apiToken,
      phoneNumberId: (connection.config as any).phoneNumberId,
      webhookVerifyToken: (connection.config as any).webhookVerifyToken,
      accountId: connection.accountId,
      channelConnectionId: connection.id,
    });

    // Parse the webhook payload
    const inboundPayload = adapter.parseInboundMessage(body);

    if (!inboundPayload) {
      // Not a message event, ignore
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Log webhook event
    await EventsService.logWebhookEvent(
      connection.accountId,
      "whatsapp",
      "message_received",
      inboundPayload,
      {
        phoneNumberId,
      }
    );

    // Queue the message for processing
    await addJob("inboundMessage", "whatsapp-message", inboundPayload);

    return NextResponse.json({ status: "queued" }, { status: 200 });
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error);
    // Return 200 to prevent WhatsApp from retrying
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
