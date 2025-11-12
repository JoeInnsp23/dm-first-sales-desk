#!/usr/bin/env node
/**
 * Worker process for processing background jobs
 * Run this as a separate process: npm run worker
 * Or in development with auto-reload: npm run worker:dev
 */

import { createInboundMessageWorker } from "./workers/inbound-message.worker";
import { createOutboundMessageWorker } from "./workers/outbound-message.worker";
import { createAISuggestionsWorker } from "./workers/ai-suggestions.worker";
import { createOrdersSyncWorker } from "./workers/orders-sync.worker";
import { createTasksNotificationsWorker } from "./workers/tasks-notifications.worker";
import { createExportsWorker } from "./workers/exports.worker";

console.log("🚀 Starting background workers...");

// Create all workers
const workers = [
  createInboundMessageWorker(),
  createOutboundMessageWorker(),
  createAISuggestionsWorker(),
  createOrdersSyncWorker(),
  createTasksNotificationsWorker(),
  createExportsWorker(),
];

console.log(`✓ Started ${workers.length} workers`);
console.log("  - Inbound Message Worker (concurrency: 10)");
console.log("  - Outbound Message Worker (concurrency: 5)");
console.log("  - AI Suggestions Worker (concurrency: 3)");
console.log("  - Orders Sync Worker (concurrency: 5)");
console.log("  - Tasks/Notifications Worker (concurrency: 10)");
console.log("  - Exports Worker (concurrency: 2)");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, closing workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, closing workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

// Keep the process running
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});
