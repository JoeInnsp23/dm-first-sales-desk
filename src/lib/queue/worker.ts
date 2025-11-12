#!/usr/bin/env node
/**
 * Worker process for processing background jobs
 * Run this as a separate process: node src/lib/queue/worker.ts
 */

import { createInboundMessageWorker } from "./workers/inbound-message.worker";
import { createOutboundMessageWorker } from "./workers/outbound-message.worker";

console.log("🚀 Starting background workers...");

// Create all workers
const workers = [
  createInboundMessageWorker(),
  createOutboundMessageWorker(),
  // Add more workers as needed
];

console.log(`✓ Started ${workers.length} workers`);

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
