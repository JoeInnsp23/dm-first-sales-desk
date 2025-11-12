import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { channelConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InstagramAdapter } from "@/lib/integrations";
import { addJob } from "@/lib/queue";
import { EventsService } from "@/lib/services";

/**
 * GET /api/webhooks/instagram
 * Webhook verification for Instagram
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Find any Instagram connection to get the verify token
  const connection = await db.query.channelConnections.findFirst({
    where: eq(channelConnections.type, "instagram"),
  });

  if (!connection) {
    console.error("No Instagram channel connection found");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const adapter = new InstagramAdapter({
    appId: (connection.config as any).appId,
    appSecret: (connection.config as any).appSecret,
    accessToken: (connection.config as any).accessToken,
    pageId: (connection.config as any).pageId,
    accountId: connection.accountId,
    channelConnectionId: connection.id,
  });

  const challengeResponse = adapter.verifyWebhookSetup(
    mode || "",
    token || "",
    challenge || ""
  );

  if (challengeResponse) {
    console.log("Instagram webhook verified");
    return new NextResponse(challengeResponse, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

/**
 * POST /api/webhooks/instagram
 * Receive Instagram webhooks
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log the webhook
    console.log("Instagram webhook received:", JSON.stringify(body, null, 2));

    // Instagram sends subscription confirmations
    if (body.object !== "instagram" && body.object !== "page") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Extract page ID to find the channel connection
    const entry = body.entry?.[0];
    const pageId = entry?.id;

    if (!pageId) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Find channel connection by page ID
    // In production, you'd query the config field properly
    const connection = await db.query.channelConnections.findFirst({
      where: eq(channelConnections.type, "instagram"),
    });

    if (!connection) {
      console.error("No Instagram channel connection found");
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Verify webhook signature
    const signature = req.headers.get("x-hub-signature-256") || "";
    const rawBody = JSON.stringify(body);

    const adapter = new InstagramAdapter({
      appId: (connection.config as any).appId,
      appSecret: (connection.config as any).appSecret,
      accessToken: (connection.config as any).accessToken,
      pageId: (connection.config as any).pageId,
      accountId: connection.accountId,
      channelConnectionId: connection.id,
    });

    if (signature && !adapter.verifyWebhook(rawBody, signature)) {
      console.error("Invalid Instagram webhook signature");
      return NextResponse.json({ status: "forbidden" }, { status: 403 });
    }

    // Parse the webhook payload
    const inboundPayload = adapter.parseInboundMessage(body);

    if (!inboundPayload) {
      // Not a message event, ignore
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Log webhook event
    await EventsService.logWebhookEvent(
      connection.accountId,
      "instagram",
      "message_received",
      inboundPayload,
      {
        pageId,
      }
    );

    // Queue the message for processing
    await addJob("inboundMessage", "instagram-message", inboundPayload);

    return NextResponse.json({ status: "queued" }, { status: 200 });
  } catch (error) {
    console.error("Error processing Instagram webhook:", error);
    // Return 200 to prevent Instagram from retrying
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
