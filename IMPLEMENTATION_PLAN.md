# COMPLETE IMPLEMENTATION PLAN - DM-First Sales Desk

**Total Estimated Time:** 40-50 hours
**Priority Order:** Critical Workers → Testing → Infrastructure → Nice-to-Haves

---

## 🔴 PHASE 1: CRITICAL WORKERS (8-10 hours)

### Task 1.1: Complete AI Suggestions Worker (3-4 hours)

**File:** `src/lib/queue/workers/ai-suggestions.worker.ts`

**Current State:** Stub that just logs and returns placeholder
**Target:** Full AI reply generation with database persistence

#### Step 1.1.1: Update Worker to Fetch Messages (30 min)
```typescript
// Add to imports
import { MessagesService } from "@/lib/services";

// Replace stub with:
const messages = await MessagesService.listByThread(threadId, accountId, {
  limit: 10,
  sortOrder: "desc"
});

if (messages.length === 0) {
  console.log(`No messages in thread ${threadId}`);
  return { skipped: true, reason: "no_messages" };
}
```

#### Step 1.1.2: Build Conversation Context (30 min)
```typescript
// Format messages for AI
const conversationHistory = messages
  .reverse() // Chronological order
  .map((msg) => ({
    role: msg.direction === "inbound" ? "user" : "assistant",
    content: msg.content || "",
    timestamp: msg.sentAt,
  }))
  .filter((msg) => msg.content); // Remove empty messages

// Get latest inbound message for context
const latestInbound = messages
  .filter(m => m.direction === "inbound")
  .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];

if (!latestInbound) {
  return { skipped: true, reason: "no_inbound_message" };
}
```

#### Step 1.1.3: Call AI Service (45 min)
```typescript
// Generate suggestion
const suggestion = await AIService.generateReplySuggestion(
  accountId,
  threadId,
  conversationHistory,
  {
    tone: "professional",
    maxLength: 500,
  }
);

console.log(`✓ Generated AI suggestion for thread ${threadId}: ${suggestion.suggestion.substring(0, 50)}...`);
```

#### Step 1.1.4: Add Error Handling (30 min)
```typescript
try {
  const suggestion = await AIService.generateReplySuggestion(...);

  return {
    threadId,
    suggestionId: suggestion.id,
    suggestion: suggestion.suggestion,
    tokensUsed: suggestion.tokensUsed,
    costUsd: suggestion.costUsd,
  };
} catch (error) {
  if (error.message.includes("API key")) {
    console.error("AI API key not configured");
    return { skipped: true, reason: "no_api_key" };
  }

  if (error.message.includes("rate limit")) {
    console.error("AI API rate limit hit");
    throw error; // Retry
  }

  throw error;
}
```

#### Step 1.1.5: Add Batch Generation (45 min)
```typescript
// Support generating multiple suggestions
export type AISuggestionsJob = {
  accountId: string;
  threadId: string;
  requestedById?: string;
  count?: number; // Number of suggestions to generate
  tone?: "professional" | "friendly" | "concise";
};

// Generate multiple suggestions in parallel
const suggestions = await Promise.all(
  Array(count || 3).fill(null).map(() =>
    AIService.generateReplySuggestion(accountId, threadId, conversationHistory, { tone })
  )
);
```

**Testing:**
```bash
# Manual test
curl -X POST http://localhost:3000/api/v1/threads/{threadId}/ai \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action":"generate_replies","count":3}'
```

---

### Task 1.2: Complete Orders Sync Worker (3-4 hours)

**File:** `src/lib/queue/workers/orders-sync.worker.ts`

**Current State:** Stub that only logs
**Target:** Full order creation, contact linking, thread association

#### Step 1.2.1: Add Service Imports (5 min)
```typescript
import { db } from "@/lib/db";
import { orders, contacts, threads, threadOrderLinks } from "@/lib/db/schema";
import { ContactsService, ThreadsService, EventsService } from "@/lib/services";
import { eq, and } from "drizzle-orm";
```

#### Step 1.2.2: Implement Find/Create Contact (1 hour)
```typescript
async function findOrCreateContact(
  accountId: string,
  channelConnectionId: string,
  customerData: any
) {
  let contactId: string | null = null;

  if (!customerData) {
    return null;
  }

  // Try to find existing contact by email or phone
  let contact = null;

  if (customerData.email) {
    contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.accountId, accountId),
        eq(contacts.email, customerData.email)
      ),
    });
  }

  if (!contact && customerData.phone) {
    contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.accountId, accountId),
        eq(contacts.phone, customerData.phone)
      ),
    });
  }

  // Create new contact if not found
  if (!contact) {
    contact = await ContactsService.create({
      accountId,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
    });

    console.log(`Created new contact: ${contact.id}`);
  } else {
    console.log(`Found existing contact: ${contact.id}`);
  }

  // Log contact event
  await EventsService.logContactEvent(
    accountId,
    contact.id,
    "order_linked",
    "Contact updated from order sync",
    {
      channelType: jobData.channelType,
      orderId: jobData.orderData.externalOrderId
    }
  );

  return contact.id;
}
```

#### Step 1.2.3: Implement Order Creation/Update (1.5 hours)
```typescript
// Map order data to schema
const orderInput = {
  accountId,
  channelConnectionId,
  source: channelType === "shopify" ? "shopify" as const : "tiktok_shop" as const,
  externalOrderId: orderData.externalOrderId || orderData.orderId,
  orderNumber: orderData.orderNumber,
  contactId,
  status: mapOrderStatus(orderData.status),
  fulfillmentStatus: orderData.fulfillmentStatus || "unfulfilled",
  currency: orderData.currency || "USD",
  totalAmount: orderData.totalAmount.toString(),
  subtotalAmount: orderData.subtotalAmount?.toString(),
  taxAmount: orderData.taxAmount?.toString(),
  shippingAmount: orderData.shippingAmount?.toString(),
  discountAmount: orderData.discountAmount?.toString(),
  lineItems: orderData.lineItems || orderData.items || [],
  shippingAddress: orderData.shippingAddress,
  billingAddress: orderData.billingAddress,
  customerEmail: orderData.customer?.email,
  customerPhone: orderData.customer?.phone,
  customerName: orderData.customer?.name,
  trackingNumber: orderData.trackingNumber,
  trackingUrl: orderData.trackingUrl,
  metadata: {
    channelType,
    webhookTopic: jobData.webhookTopic,
    ...orderData.metadata,
  },
  placedAt: new Date(orderData.placedAt || orderData.createdAt),
  fulfilledAt: orderData.fulfilledAt ? new Date(orderData.fulfilledAt) : null,
  cancelledAt: orderData.cancelledAt ? new Date(orderData.cancelledAt) : null,
};

// Check if order exists
const existingOrder = await db.query.orders.findFirst({
  where: and(
    eq(orders.accountId, accountId),
    eq(orders.externalOrderId, orderInput.externalOrderId)
  ),
});

let orderId: string;

if (existingOrder) {
  // Update existing order
  await db
    .update(orders)
    .set({
      ...orderInput,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, existingOrder.id));

  orderId = existingOrder.id;
  console.log(`✓ Updated order: ${orderInput.orderNumber}`);
} else {
  // Create new order
  const [newOrder] = await db
    .insert(orders)
    .values(orderInput)
    .returning();

  orderId = newOrder.id;
  console.log(`✓ Created new order: ${orderInput.orderNumber}`);
}
```

#### Step 1.2.4: Implement Thread Linking (45 min)
```typescript
// Link order to thread if contact exists
if (contactId) {
  // Find or create active thread for this contact
  const activeThread = await ThreadsService.findOrCreate({
    accountId,
    contactId,
    channelConnectionId,
    metadata: {
      channelType,
    },
  });

  // Check if link already exists
  const existingLink = await db.query.threadOrderLinks.findFirst({
    where: and(
      eq(threadOrderLinks.threadId, activeThread.id),
      eq(threadOrderLinks.orderId, orderId)
    ),
  });

  if (!existingLink) {
    // Create thread-order link
    await db.insert(threadOrderLinks).values({
      threadId: activeThread.id,
      orderId,
    });

    console.log(`✓ Linked order to thread: ${activeThread.id}`);
  }

  // Log thread event
  await EventsService.logThreadEvent(
    accountId,
    activeThread.id,
    "order_linked",
    `Order ${orderInput.orderNumber} linked to thread`,
    { orderId, orderNumber: orderInput.orderNumber }
  );
}
```

#### Step 1.2.5: Add Order Status Mapping (15 min)
```typescript
function mapOrderStatus(status: string): "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" {
  const statusMap: Record<string, any> = {
    "pending": "pending",
    "confirmed": "confirmed",
    "paid": "confirmed",
    "processing": "processing",
    "fulfilled": "shipped",
    "shipped": "shipped",
    "delivered": "delivered",
    "completed": "delivered",
    "cancelled": "cancelled",
    "canceled": "cancelled",
    "refunded": "refunded",
  };

  return statusMap[status?.toLowerCase()] || "pending";
}
```

**Testing:**
```bash
# Trigger from Shopify webhook
curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Hmac-SHA256: SIGNATURE" \
  -d @fixtures/shopify-order.json
```

---

### Task 1.3: Complete Tasks/Notifications Worker (2 hours)

**File:** `src/lib/queue/workers/tasks-notifications.worker.ts`

**Current State:** Only unsnooze implemented
**Target:** All notification types working

#### Step 1.3.1: Add Schema Check for Notifications (15 min)
```typescript
// First, verify notifications schema
import { notifications } from "@/lib/db/schema";

// Check what fields are available
// Based on schema: accountId, userId, type, title, message, status, threadId, taskId
```

#### Step 1.3.2: Implement SLA Warning Notifications (30 min)
```typescript
case "sla_warning": {
  if (!threadId) {
    throw new Error("threadId required for sla_warning");
  }

  const thread = await db.query.threads.findFirst({
    where: and(
      eq(threads.id, threadId),
      eq(threads.accountId, accountId)
    ),
  });

  if (!thread) {
    return { skipped: true, reason: "thread_not_found" };
  }

  if (!thread.assignedToId) {
    return { skipped: true, reason: "thread_not_assigned" };
  }

  // Create notification
  await db.insert(notifications).values({
    accountId,
    userId: thread.assignedToId,
    type: "sla_warning",
    title: "SLA Warning",
    message: `Thread "${thread.subject}" is approaching SLA deadline`,
    threadId: thread.id,
  });

  await EventsService.logThreadEvent(
    accountId,
    threadId,
    "sla_warning_sent",
    "SLA warning notification sent",
    { assignedTo: thread.assignedToId }
  );

  console.log(`✓ SLA warning notification sent for thread ${threadId}`);
  return { notificationSent: true, threadId };
}
```

#### Step 1.3.3: Implement Task Reminder Notifications (30 min)
```typescript
case "task_reminder": {
  if (!taskId) {
    throw new Error("taskId required for task_reminder");
  }

  const task = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.id, taskId),
      eq(tasks.accountId, accountId)
    ),
  });

  if (!task) {
    return { skipped: true, reason: "task_not_found" };
  }

  if (task.status === "completed" || task.status === "cancelled") {
    return { skipped: true, reason: `task_already_${task.status}` };
  }

  if (!task.assignedToId) {
    return { skipped: true, reason: "task_not_assigned" };
  }

  // Create notification
  await db.insert(notifications).values({
    accountId,
    userId: task.assignedToId,
    type: "task_due",
    title: "Task Reminder",
    message: task.title,
    taskId: task.id,
    threadId: task.threadId || undefined,
  });

  console.log(`✓ Task reminder sent for task ${taskId}`);
  return { notificationSent: true, taskId };
}
```

#### Step 1.3.4: Implement Thread Assignment Notifications (30 min)
```typescript
case "thread_assigned": {
  if (!threadId || !userId) {
    throw new Error("threadId and userId required for thread_assigned");
  }

  const thread = await db.query.threads.findFirst({
    where: and(
      eq(threads.id, threadId),
      eq(threads.accountId, accountId)
    ),
  });

  if (!thread) {
    return { skipped: true, reason: "thread_not_found" };
  }

  // Create notification
  await db.insert(notifications).values({
    accountId,
    userId,
    type: "thread_assigned",
    title: "Thread Assigned",
    message: `You've been assigned to thread "${thread.subject}"`,
    threadId: thread.id,
  });

  await EventsService.logThreadEvent(
    accountId,
    threadId,
    "assigned",
    `Thread assigned to user ${userId}`,
    { assignedTo: userId, assignedBy: data?.assignedBy }
  );

  console.log(`✓ Assignment notification sent to user ${userId}`);
  return { notificationSent: true, threadId, userId };
}
```

**Testing:**
```typescript
// Test SLA warning
await addJob("tasksNotifications", "sla-warning", {
  type: "sla_warning",
  accountId: "test-account",
  threadId: "test-thread",
});
```

---

## 🟡 PHASE 2: TESTING INFRASTRUCTURE (10-12 hours)

### Task 2.1: Set Up Test Framework (2 hours)

#### Step 2.1.1: Install Dependencies (15 min)
```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  msw \
  @faker-js/faker
```

#### Step 2.1.2: Create Vitest Config (30 min)
**File:** `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### Step 2.1.3: Create Test Setup (1 hour)
**File:** `src/test/setup.ts`
```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_test';
process.env.CLERK_SECRET_KEY = 'sk_test_test';

// Mock Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ userId: 'test-user-id' })),
  currentUser: vi.fn(() => ({
    id: 'test-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    fullName: 'Test User',
    imageUrl: 'https://example.com/avatar.jpg',
  })),
}));
```

**File:** `src/test/factories.ts`
```typescript
import { faker } from '@faker-js/faker';

export const createMockContact = (overrides = {}) => ({
  id: faker.string.uuid(),
  accountId: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  whatsappId: faker.string.numeric(10),
  instagramId: faker.internet.userName(),
  tiktokUserId: faker.string.alphanumeric(10),
  tags: [faker.word.noun(), faker.word.noun()],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockThread = (overrides = {}) => ({
  id: faker.string.uuid(),
  accountId: faker.string.uuid(),
  contactId: faker.string.uuid(),
  channelConnectionId: faker.string.uuid(),
  subject: faker.lorem.sentence(),
  status: 'open' as const,
  pipelineStage: 'lead' as const,
  isRead: false,
  isStarred: false,
  hasUnreadMessages: true,
  isSlaCritical: false,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockMessage = (overrides = {}) => ({
  id: faker.string.uuid(),
  accountId: faker.string.uuid(),
  threadId: faker.string.uuid(),
  externalMessageId: faker.string.alphanumeric(20),
  type: 'text' as const,
  content: faker.lorem.paragraph(),
  direction: 'inbound' as const,
  status: 'delivered' as const,
  senderId: faker.string.alphanumeric(10),
  senderType: 'contact' as const,
  senderName: faker.person.fullName(),
  sentAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
```

#### Step 2.1.4: Update package.json (15 min)
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

---

### Task 2.2: Write Service Tests (4 hours)

#### Step 2.2.1: ContactsService Tests (1.5 hours)
**File:** `src/lib/services/__tests__/contacts.service.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactsService } from '../contacts.service';
import { db } from '@/lib/db';
import { createMockContact } from '@/test/factories';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      contacts: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

describe('ContactsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new contact', async () => {
      const mockContact = createMockContact();

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockContact]),
        }),
      } as any);

      const result = await ContactsService.create({
        accountId: mockContact.accountId,
        name: mockContact.name,
        email: mockContact.email,
        phone: mockContact.phone,
      });

      expect(result).toEqual(mockContact);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('findOrCreate', () => {
    it('should return existing contact if found by email', async () => {
      const mockContact = createMockContact();

      vi.mocked(db.query.contacts.findFirst).mockResolvedValue(mockContact);

      const result = await ContactsService.findOrCreate({
        accountId: mockContact.accountId,
        email: mockContact.email,
      });

      expect(result).toEqual(mockContact);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should create new contact if not found', async () => {
      const mockContact = createMockContact();

      vi.mocked(db.query.contacts.findFirst).mockResolvedValue(null);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockContact]),
        }),
      } as any);

      const result = await ContactsService.findOrCreate({
        accountId: mockContact.accountId,
        email: mockContact.email,
      });

      expect(result).toEqual(mockContact);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search contacts by name', async () => {
      const mockContacts = [createMockContact(), createMockContact()];

      vi.mocked(db.query.contacts.findMany).mockResolvedValue(mockContacts);

      const results = await ContactsService.search('account-id', 'John', 10);

      expect(results).toHaveLength(2);
      expect(db.query.contacts.findMany).toHaveBeenCalled();
    });
  });
});
```

#### Step 2.2.2: ThreadsService Tests (1.5 hours)
**File:** `src/lib/services/__tests__/threads.service.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThreadsService } from '../threads.service';
import { createMockThread } from '@/test/factories';

describe('ThreadsService', () => {
  describe('markAsRead', () => {
    it('should mark thread as read', async () => {
      // Test implementation
    });
  });

  describe('snooze', () => {
    it('should snooze thread until specified date', async () => {
      // Test implementation
    });
  });

  describe('assign', () => {
    it('should assign thread to user', async () => {
      // Test implementation
    });
  });
});
```

#### Step 2.2.3: MessagesService Tests (1 hour)
**File:** `src/lib/services/__tests__/messages.service.test.ts`

---

### Task 2.3: Write API Route Tests (3 hours)

#### Step 2.3.1: Contacts API Tests (1 hour)
**File:** `src/app/api/v1/contacts/__tests__/route.test.ts`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

describe('/api/v1/contacts', () => {
  describe('GET', () => {
    it('should return list of contacts', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/contacts');
      const response = await GET(req, {});

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('contacts');
    });
  });

  describe('POST', () => {
    it('should create a new contact', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Contact',
          email: 'test@example.com',
        }),
      });

      const response = await POST(req, {});

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
    });
  });
});
```

#### Step 2.3.2: Threads API Tests (1 hour)
#### Step 2.3.3: Messages API Tests (1 hour)

---

### Task 2.4: Write Integration Tests (2 hours)

#### Step 2.4.1: Webhook Integration Tests (1 hour)
**File:** `src/app/api/webhooks/__tests__/whatsapp.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '../whatsapp/route';

describe('WhatsApp Webhook', () => {
  it('should queue inbound message', async () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            metadata: { phone_number_id: '123' },
            messages: [{
              id: 'msg_123',
              from: '1234567890',
              type: 'text',
              text: { body: 'Hello' },
              timestamp: Date.now(),
            }],
          },
        }],
      }],
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('queued');
  });
});
```

#### Step 2.4.2: Worker Integration Tests (1 hour)
**File:** `src/lib/queue/workers/__tests__/inbound-message.test.ts`

---

### Task 2.5: Write Component Tests (1 hour)

#### Step 2.5.1: ThreadList Component Test (30 min)
**File:** `src/components/inbox/__tests__/thread-list.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThreadList } from '../thread-list';
import { createMockThread } from '@/test/factories';

describe('ThreadList', () => {
  it('should render list of threads', () => {
    const threads = [
      createMockThread(),
      createMockThread(),
    ];

    render(<ThreadList threads={threads} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('should show unread badge for unread threads', () => {
    const thread = createMockThread({ hasUnreadMessages: true });

    render(<ThreadList threads={[thread]} />);

    expect(screen.getByText(/unread/i)).toBeInTheDocument();
  });
});
```

---

## 🟢 PHASE 3: INFRASTRUCTURE IMPROVEMENTS (10-12 hours)

### Task 3.1: Structured Logging System (2-3 hours)

#### Step 3.1.1: Install Pino Logger (15 min)
```bash
npm install pino pino-pretty
```

#### Step 3.1.2: Create Logger Service (1 hour)
**File:** `src/lib/logger/index.ts`
```typescript
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  ...(!isDevelopment && {
    formatters: {
      level: (label) => ({ level: label }),
    },
  }),
});

// Create child loggers for different modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};

// Typed logging functions
export const logApi = createLogger('api');
export const logWorker = createLogger('worker');
export const logWebhook = createLogger('webhook');
export const logDatabase = createLogger('database');
export const logAuth = createLogger('auth');
```

#### Step 3.1.3: Replace console.log Calls (1-1.5 hours)
```bash
# Find all console.log calls
grep -r "console\." src --include="*.ts" --include="*.tsx" | wc -l

# Replace in workers
# Before:
console.log("Processing message:", messageId);

# After:
import { logWorker } from '@/lib/logger';
logWorker.info({ messageId }, 'Processing message');
```

**Pattern for structured logging:**
```typescript
// Info
logger.info({ userId, action: 'login' }, 'User logged in');

// Error with stack trace
logger.error({ error, userId }, 'Failed to process request');

// Debug
logger.debug({ query, results: results.length }, 'Database query');

// Warn
logger.warn({ threadId, slaDeadline }, 'SLA deadline approaching');
```

#### Step 3.1.4: Add Request ID Middleware (30 min)
**File:** `src/lib/logger/middleware.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export function withRequestId(
  handler: (req: NextRequest, requestId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const requestId = req.headers.get('x-request-id') || uuidv4();

    const response = await handler(req, requestId);

    response.headers.set('x-request-id', requestId);
    return response;
  };
}
```

---

### Task 3.2: Rate Limiting (3-4 hours)

#### Step 3.2.1: Install Dependencies (15 min)
```bash
npm install @upstash/ratelimit ioredis
```

#### Step 3.2.2: Create Rate Limiter Service (1 hour)
**File:** `src/lib/rate-limit/index.ts`
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  token: process.env.REDIS_TOKEN,
});

// Different limits for different operations
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

export const webhookRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 webhooks per minute
  analytics: true,
});

export const aiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 AI requests per minute
  analytics: true,
});

// Helper to check rate limit
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
) {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    },
  };
}
```

#### Step 3.2.3: Add Rate Limit Middleware (1.5 hours)
**File:** `src/lib/api/rate-limit.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { getAuthContext } from '@/lib/auth';

export function withRateLimit<T>(
  handler: (req: NextRequest, context: any) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest, context: any) => {
    // Get identifier (accountId or IP)
    const auth = await getAuthContext();
    const identifier = auth?.accountId || req.ip || 'anonymous';

    // Check rate limit
    const { success, headers } = await checkRateLimit(identifier, apiRateLimit);

    if (!success) {
      return NextResponse.json(
        {
          error: {
            message: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
          },
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Call handler
    const response = await handler(req, context);

    // Add rate limit headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}
```

#### Step 3.2.4: Apply to API Routes (1 hour)
```typescript
// Before
export const GET = withErrorHandling(
  withAuth(async (req, context) => {
    // Handler
  })
);

// After
export const GET = withRateLimit(
  withErrorHandling(
    withAuth(async (req, context) => {
      // Handler
    })
  )
);
```

#### Step 3.2.5: Add Rate Limit Dashboard (30 min)
**File:** `src/app/api/admin/rate-limits/route.ts`
```typescript
export async function GET(req: NextRequest) {
  const auth = await requireRole('owner');

  // Get rate limit stats from Redis
  const stats = await redis.hgetall('ratelimit:analytics');

  return NextResponse.json({ stats });
}
```

---

### Task 3.3: S3 File Upload System (3-4 hours)

#### Step 3.3.1: Install AWS SDK (15 min)
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

#### Step 3.3.2: Create S3 Service (1.5 hours)
**File:** `src/lib/storage/s3.service.ts`
```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

export class S3Service {
  /**
   * Upload file to S3
   */
  static async uploadFile(
    file: Buffer,
    filename: string,
    contentType: string,
    folder = 'uploads'
  ): Promise<{ key: string; url: string }> {
    const key = `${folder}/${uuidv4()}-${filename}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
    );

    const url = `https://${BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;

    return { key, url };
  }

  /**
   * Get signed URL for temporary access
   */
  static async getSignedUrl(
    key: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<void> {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );
  }

  /**
   * Upload message attachment
   */
  static async uploadAttachment(
    accountId: string,
    threadId: string,
    file: Buffer,
    filename: string,
    contentType: string
  ) {
    return this.uploadFile(
      file,
      filename,
      contentType,
      `attachments/${accountId}/${threadId}`
    );
  }

  /**
   * Upload export file
   */
  static async uploadExport(
    accountId: string,
    userId: string,
    data: string,
    filename: string,
    contentType: string
  ) {
    const buffer = Buffer.from(data, 'utf-8');

    return this.uploadFile(
      buffer,
      filename,
      contentType,
      `exports/${accountId}/${userId}`
    );
  }
}
```

#### Step 3.3.3: Add File Upload API Route (1 hour)
**File:** `src/app/api/v1/uploads/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withErrorHandling } from '@/lib/api';
import { S3Service } from '@/lib/storage/s3.service';

export const POST = withErrorHandling(
  withAuth(async (req: NextRequest, { auth }) => {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'video/mp4',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Upload to S3
    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, url } = await S3Service.uploadFile(
      buffer,
      file.name,
      file.type,
      `uploads/${auth.accountId}`
    );

    return NextResponse.json({
      key,
      url,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    });
  })
);
```

#### Step 3.3.4: Update Exports Worker to Use S3 (1 hour)
```typescript
// In exports.worker.ts
import { S3Service } from '@/lib/storage/s3.service';

// After generating export data
const { key, url } = await S3Service.uploadExport(
  accountId,
  userId,
  exportData,
  exportFilename,
  contentType
);

// TODO: Send email notification with download link
console.log(`Export uploaded: ${url}`);

return {
  success: true,
  filename: exportFilename,
  recordCount,
  downloadUrl: url,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
};
```

---

### Task 3.4: Email Notifications (2-3 hours)

#### Step 3.4.1: Install Resend SDK (15 min)
```bash
npm install resend
```

#### Step 3.4.2: Create Email Service (1 hour)
**File:** `src/lib/email/service.ts`
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  /**
   * Send export ready notification
   */
  static async sendExportReady(
    to: string,
    exportType: string,
    downloadUrl: string,
    expiresAt: Date
  ) {
    await resend.emails.send({
      from: 'DM Sales Desk <notifications@yourdomain.com>',
      to,
      subject: `Your ${exportType} export is ready`,
      html: `
        <h1>Export Ready</h1>
        <p>Your ${exportType} export is ready for download.</p>
        <p><a href="${downloadUrl}">Download Export</a></p>
        <p>This link will expire on ${expiresAt.toLocaleString()}.</p>
      `,
    });
  }

  /**
   * Send SLA warning
   */
  static async sendSlaWarning(
    to: string,
    threadSubject: string,
    deadline: Date
  ) {
    await resend.emails.send({
      from: 'DM Sales Desk <alerts@yourdomain.com>',
      to,
      subject: `SLA Warning: ${threadSubject}`,
      html: `
        <h1>SLA Warning</h1>
        <p>Thread "${threadSubject}" is approaching its SLA deadline.</p>
        <p>Deadline: ${deadline.toLocaleString()}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/inbox">View Thread</a></p>
      `,
    });
  }

  /**
   * Send task reminder
   */
  static async sendTaskReminder(
    to: string,
    taskTitle: string,
    dueAt: Date
  ) {
    await resend.emails.send({
      from: 'DM Sales Desk <reminders@yourdomain.com>',
      to,
      subject: `Task Reminder: ${taskTitle}`,
      html: `
        <h1>Task Reminder</h1>
        <p>${taskTitle}</p>
        <p>Due: ${dueAt.toLocaleString()}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">View Tasks</a></p>
      `,
    });
  }
}
```

#### Step 3.4.3: Add Email Templates (1-1.5 hours)
**Directory:** `src/lib/email/templates/`
**Files:**
- `export-ready.tsx`
- `sla-warning.tsx`
- `task-reminder.tsx`

Using React Email:
```bash
npm install @react-email/components
```

**File:** `src/lib/email/templates/export-ready.tsx`
```typescript
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components';

interface ExportReadyEmailProps {
  exportType: string;
  downloadUrl: string;
  expiresAt: Date;
}

export const ExportReadyEmail = ({
  exportType,
  downloadUrl,
  expiresAt,
}: ExportReadyEmailProps) => (
  <Html>
    <Head />
    <Preview>Your {exportType} export is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Export Ready</Heading>
        <Text style={text}>
          Your {exportType} export is ready for download.
        </Text>
        <Button style={button} href={downloadUrl}>
          Download Export
        </Button>
        <Text style={footer}>
          This link will expire on {expiresAt.toLocaleString()}.
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: '0 auto', padding: '20px', maxWidth: '600px' };
const h1 = { fontSize: '24px', fontWeight: 'bold' };
const text = { fontSize: '16px', lineHeight: '26px' };
const button = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '12px 20px',
  borderRadius: '5px',
  textDecoration: 'none',
};
const footer = { fontSize: '14px', color: '#8898aa' };
```

---

## 🔵 PHASE 4: ADVANCED FEATURES (10-15 hours)

### Task 4.1: Real-Time Updates with WebSockets (4-5 hours)

#### Step 4.1.1: Install Pusher or Socket.io (15 min)
```bash
npm install pusher pusher-js
# OR
npm install socket.io socket.io-client
```

#### Step 4.1.2: Create Pusher Service (1 hour)
**File:** `src/lib/realtime/pusher.service.ts`
```typescript
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true,
});

export class PusherService {
  /**
   * Send new message event
   */
  static async sendMessageCreated(
    accountId: string,
    threadId: string,
    message: any
  ) {
    await pusher.trigger(
      `account-${accountId}`,
      'message.created',
      {
        threadId,
        message,
      }
    );
  }

  /**
   * Send thread updated event
   */
  static async sendThreadUpdated(
    accountId: string,
    thread: any
  ) {
    await pusher.trigger(
      `account-${accountId}`,
      'thread.updated',
      { thread }
    );
  }

  /**
   * Send notification event
   */
  static async sendNotification(
    accountId: string,
    userId: string,
    notification: any
  ) {
    await pusher.trigger(
      `user-${userId}`,
      'notification.created',
      { notification }
    );
  }
}
```

#### Step 4.1.3: Add Real-Time Client Hook (2 hours)
**File:** `src/hooks/use-realtime.ts`
```typescript
'use client';

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { useAuth } from '@clerk/nextjs';

export function useRealtime(accountId: string) {
  const [pusher, setPusher] = useState<Pusher | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    const initPusher = async () => {
      const token = await getToken();

      const pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
        authEndpoint: '/api/pusher/auth',
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      setPusher(pusherInstance);
    };

    initPusher();

    return () => {
      pusher?.disconnect();
    };
  }, [accountId]);

  return pusher;
}

export function useThreadUpdates(accountId: string, onThreadUpdate: (thread: any) => void) {
  const pusher = useRealtime(accountId);

  useEffect(() => {
    if (!pusher) return;

    const channel = pusher.subscribe(`account-${accountId}`);

    channel.bind('thread.updated', (data: any) => {
      onThreadUpdate(data.thread);
    });

    return () => {
      channel.unbind('thread.updated');
      pusher.unsubscribe(`account-${accountId}`);
    };
  }, [pusher, accountId, onThreadUpdate]);
}

export function useNewMessages(accountId: string, onNewMessage: (message: any) => void) {
  const pusher = useRealtime(accountId);

  useEffect(() => {
    if (!pusher) return;

    const channel = pusher.subscribe(`account-${accountId}`);

    channel.bind('message.created', (data: any) => {
      onNewMessage(data.message);
    });

    return () => {
      channel.unbind('message.created');
    };
  }, [pusher, accountId, onNewMessage]);
}
```

#### Step 4.1.4: Integrate into Components (1-1.5 hours)
```typescript
// In inbox page
'use client';

import { useThreadUpdates, useNewMessages } from '@/hooks/use-realtime';

export function InboxPage() {
  const [threads, setThreads] = useState([]);
  const { accountId } = useAuth();

  useThreadUpdates(accountId, (updatedThread) => {
    setThreads(prev =>
      prev.map(t => t.id === updatedThread.id ? updatedThread : t)
    );
  });

  useNewMessages(accountId, (newMessage) => {
    // Update thread with new message
    setThreads(prev =>
      prev.map(t =>
        t.id === newMessage.threadId
          ? { ...t, lastMessage: newMessage, hasUnreadMessages: true }
          : t
      )
    );
  });

  // ... rest of component
}
```

#### Step 4.1.5: Add to Workers (30 min)
```typescript
// In inbound-message.worker.ts
import { PusherService } from '@/lib/realtime/pusher.service';

// After creating message
await PusherService.sendMessageCreated(
  accountId,
  thread.id,
  newMessage
);

// After updating thread
await PusherService.sendThreadUpdated(
  accountId,
  thread
);
```

---

### Task 4.2: Advanced Search (3-4 hours)

#### Step 4.2.1: Add Full-Text Search to Schema (1 hour)
**Update:** `src/lib/db/schema/contacts.ts`
```typescript
// Add to contacts table
searchVector: text("search_vector"),

// Add index
(table) => ({
  searchVectorIdx: index("contacts_search_vector_idx").using(
    "gin",
    sql`to_tsvector('english', ${table.name} || ' ' || ${table.email} || ' ' || ${table.phone})`
  ),
})
```

#### Step 4.2.2: Create Search Service (1.5 hours)
**File:** `src/lib/services/search.service.ts`
```typescript
import { db } from '@/lib/db';
import { contacts, threads, messages } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';

export class SearchService {
  /**
   * Search across all entities
   */
  static async searchAll(
    accountId: string,
    query: string,
    options: {
      limit?: number;
      types?: ('contacts' | 'threads' | 'messages')[];
    } = {}
  ) {
    const { limit = 20, types = ['contacts', 'threads', 'messages'] } = options;

    const results = await Promise.all([
      types.includes('contacts') ? this.searchContacts(accountId, query, limit) : [],
      types.includes('threads') ? this.searchThreads(accountId, query, limit) : [],
      types.includes('messages') ? this.searchMessages(accountId, query, limit) : [],
    ]);

    return {
      contacts: results[0],
      threads: results[1],
      messages: results[2],
    };
  }

  /**
   * Search contacts with full-text search
   */
  static async searchContacts(accountId: string, query: string, limit = 20) {
    return db.query.contacts.findMany({
      where: and(
        eq(contacts.accountId, accountId),
        sql`to_tsvector('english', ${contacts.name} || ' ' || ${contacts.email} || ' ' || ${contacts.phone}) @@ plainto_tsquery('english', ${query})`
      ),
      limit,
    });
  }

  /**
   * Search threads
   */
  static async searchThreads(accountId: string, query: string, limit = 20) {
    return db.query.threads.findMany({
      where: and(
        eq(threads.accountId, accountId),
        sql`to_tsvector('english', ${threads.subject}) @@ plainto_tsquery('english', ${query})`
      ),
      limit,
    });
  }

  /**
   * Search messages
   */
  static async searchMessages(accountId: string, query: string, limit = 20) {
    return db.query.messages.findMany({
      where: and(
        eq(messages.accountId, accountId),
        sql`to_tsvector('english', ${messages.content}) @@ plainto_tsquery('english', ${query})`
      ),
      limit,
    });
  }
}
```

#### Step 4.2.3: Add Search API Route (1 hour)
**File:** `src/app/api/v1/search/route.ts`

#### Step 4.2.4: Add Search UI (30 min)
**File:** `src/components/search/global-search.tsx`

---

### Task 4.3: Analytics Dashboard (3-4 hours)

#### Step 4.3.1: Create Analytics Service (2 hours)
**File:** `src/lib/services/analytics.service.ts`
```typescript
export class AnalyticsService {
  /**
   * Get dashboard metrics
   */
  static async getDashboardMetrics(accountId: string) {
    // Active conversations
    const activeConversations = await db.query.threads.findMany({
      where: and(
        eq(threads.accountId, accountId),
        eq(threads.status, 'open')
      ),
    }).length;

    // Total contacts
    const totalContacts = await db.query.contacts.findMany({
      where: eq(contacts.accountId, accountId),
    }).length;

    // Conversion rate
    const convertedThreads = await db.query.threads.findMany({
      where: and(
        eq(threads.accountId, accountId),
        eq(threads.pipelineStage, 'converted')
      ),
    }).length;

    // Response time
    // ... calculate average response time

    return {
      activeConversations,
      totalContacts,
      conversionRate: (convertedThreads / totalContacts) * 100,
      avgResponseTime: '2m 15s',
    };
  }

  /**
   * Get channel performance
   */
  static async getChannelPerformance(accountId: string) {
    // Count messages by channel
    // ...
  }

  /**
   * Get agent performance
   */
  static async getAgentPerformance(accountId: string) {
    // Count threads by agent
    // ...
  }
}
```

---

## 📊 IMPLEMENTATION ROADMAP

### Week 1: Critical Workers
- Day 1-2: AI Suggestions Worker
- Day 2-3: Orders Sync Worker
- Day 3: Tasks/Notifications Worker
- Day 4-5: Testing all workers

### Week 2: Testing Infrastructure
- Day 1-2: Set up test framework + service tests
- Day 3: API route tests
- Day 4: Integration tests
- Day 5: Component tests

### Week 3: Infrastructure
- Day 1: Structured logging
- Day 2: Rate limiting
- Day 3-4: S3 uploads
- Day 5: Email notifications

### Week 4: Advanced Features
- Day 1-2: Real-time updates
- Day 2-3: Advanced search
- Day 4-5: Analytics dashboard

---

## ✅ SUCCESS CRITERIA

Each task is complete when:
- [ ] Code written and type-safe (0 TypeScript errors)
- [ ] Tests written and passing (>80% coverage)
- [ ] Documentation updated
- [ ] Manual testing passed
- [ ] Committed to git with descriptive message

---

## 📈 PRIORITY MATRIX

```
HIGH PRIORITY (Do First):
├── AI Suggestions Worker ⭐⭐⭐
├── Orders Sync Worker ⭐⭐⭐
├── Tasks/Notifications Worker ⭐⭐⭐
└── Basic Tests ⭐⭐

MEDIUM PRIORITY (Do Next):
├── Structured Logging ⭐⭐
├── Rate Limiting ⭐⭐
└── S3 Uploads ⭐⭐

LOW PRIORITY (Nice to Have):
├── Email Notifications ⭐
├── Real-Time Updates ⭐
├── Advanced Search ⭐
└── Analytics Dashboard ⭐
```

---

## 🎯 FINAL DELIVERABLES

1. **All Workers Fully Functional** (3 stubbed workers completed)
2. **Test Coverage >80%** (Service + API + Integration tests)
3. **Production-Ready Logging** (Structured logging with Pino)
4. **Rate Limiting Active** (Protect API endpoints)
5. **File Uploads Working** (S3 integration complete)
6. **Email Notifications** (Exports, SLA warnings, reminders)
7. **Real-Time Features** (WebSocket integration)
8. **Advanced Search** (Full-text search)
9. **Analytics Dashboard** (Key metrics visualization)

**TOTAL: From 78% → 100% Production Ready**
