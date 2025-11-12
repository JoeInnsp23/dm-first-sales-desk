# API Documentation

Base URL: `https://yourdomain.com/api/v1`

All API endpoints require authentication via Clerk session token.

## Authentication

Include the Clerk session token in the Authorization header:

```bash
Authorization: Bearer <clerk-session-token>
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "errors": {
      "field": ["Validation error message"]
    }
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Contacts

### List Contacts

```http
GET /api/v1/contacts
```

**Query Parameters:**
- `limit` (number, default: 50) - Number of contacts to return
- `offset` (number, default: 0) - Pagination offset
- `search` (string) - Search by name, email, or phone
- `tags` (string[]) - Filter by tags

**Response:**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "whatsappId": "1234567890",
      "instagramId": "johndoe",
      "tiktokUserId": "user123",
      "tags": ["vip", "returning"],
      "lifecycleStage": "customer",
      "totalOrderValue": "1250.00",
      "lastSeenAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "hasMore": true
}
```

### Get Contact

```http
GET /api/v1/contacts/:id
```

**Response:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "whatsappId": "1234567890",
  "instagramId": "johndoe",
  "tiktokUserId": "user123",
  "avatarUrl": "https://...",
  "tags": ["vip"],
  "lifecycleStage": "customer",
  "customFields": {},
  "profileData": {},
  "notes": "Customer notes",
  "totalOrderValue": "1250.00",
  "totalOrders": 5,
  "lastSeenAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Create Contact

```http
POST /api/v1/contacts
```

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1987654321",
  "whatsappId": "9876543210",
  "tags": ["lead"],
  "lifecycleStage": "lead",
  "notes": "Met at trade show"
}
```

**Response:** Same as Get Contact

### Update Contact

```http
PATCH /api/v1/contacts/:id
```

**Request Body:** Partial contact fields to update

**Response:** Updated contact

### Delete Contact

```http
DELETE /api/v1/contacts/:id
```

**Response:**
```json
{
  "success": true
}
```

## Threads

### List Threads

```http
GET /api/v1/threads
```

**Query Parameters:**
- `limit` (number, default: 50)
- `offset` (number, default: 0)
- `status` (string) - Filter by status: open, snoozed, closed, archived
- `assignedToId` (string) - Filter by assigned user
- `contactId` (string) - Filter by contact
- `pipelineStage` (string) - Filter by stage: lead, engaged, converted, lost
- `isRead` (boolean) - Filter by read status
- `isStarred` (boolean) - Filter by starred status
- `search` (string) - Search by subject

**Response:**
```json
{
  "threads": [
    {
      "id": "uuid",
      "subject": "Order inquiry",
      "status": "open",
      "pipelineStage": "engaged",
      "priority": "medium",
      "assignedToId": "user-uuid",
      "contactId": "contact-uuid",
      "channelConnectionId": "channel-uuid",
      "messageCount": 5,
      "unreadCount": 2,
      "isRead": false,
      "isStarred": false,
      "hasUnreadMessages": true,
      "isSlaCritical": false,
      "tags": ["urgent"],
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "firstMessageAt": "2024-01-15T09:00:00Z",
      "slaDeadline": "2024-01-16T09:00:00Z",
      "closedAt": null,
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ],
  "total": 50,
  "hasMore": false
}
```

### Get Thread

```http
GET /api/v1/threads/:id
```

**Response:** Single thread object (same structure as list)

### Create Thread

```http
POST /api/v1/threads
```

**Request Body:**
```json
{
  "subject": "New inquiry",
  "contactId": "contact-uuid",
  "channelConnectionId": "channel-uuid",
  "pipelineStage": "lead",
  "priority": "medium"
}
```

### Update Thread

```http
PATCH /api/v1/threads/:id
```

**Request Body:**
```json
{
  "status": "closed",
  "pipelineStage": "converted",
  "assignedToId": "user-uuid",
  "tags": ["closed-won"]
}
```

### Thread Actions

```http
POST /api/v1/threads/:id/actions
```

**Request Body:**
```json
{
  "action": "snooze|close|star|unstar|assign|move_stage",
  "snoozedUntil": "2024-01-20T09:00:00Z",
  "assignedToId": "user-uuid",
  "pipelineStage": "engaged"
}
```

## Messages

### List Messages

```http
GET /api/v1/threads/:id/messages
```

**Query Parameters:**
- `limit` (number, default: 50)
- `beforeId` (string) - Cursor-based pagination
- `afterId` (string) - Cursor-based pagination

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "threadId": "thread-uuid",
      "externalMessageId": "msg_123",
      "type": "text",
      "content": "Hello, how can I help?",
      "attachments": [],
      "direction": "inbound",
      "status": "delivered",
      "senderId": "external-id",
      "senderType": "contact",
      "senderName": "John Doe",
      "sentAt": "2024-01-15T10:30:00Z",
      "deliveredAt": "2024-01-15T10:30:05Z",
      "readAt": "2024-01-15T10:31:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "hasMore": true
}
```

### Send Message

```http
POST /api/v1/threads/:id/messages
```

**Request Body:**
```json
{
  "type": "text",
  "content": "Thank you for your inquiry!",
  "attachments": [
    {
      "type": "image",
      "url": "https://...",
      "filename": "product.jpg"
    }
  ]
}
```

**Response:** Created message object

## AI Suggestions

### Generate Suggestions

```http
POST /api/v1/threads/:id/ai
```

**Request Body:**
```json
{
  "action": "generate_replies|analyze_sentiment",
  "count": 3,
  "tone": "professional"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "id": "uuid",
      "threadId": "thread-uuid",
      "type": "reply_suggestion",
      "content": "Thank you for reaching out! I'd be happy to help...",
      "confidence": 0.95,
      "reasoning": "Professional and helpful response",
      "metadata": {
        "tone": "professional",
        "sentiment": "positive"
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Provide Feedback

```http
POST /api/v1/threads/:id/ai/:suggestionId/feedback
```

**Request Body:**
```json
{
  "wasHelpful": true,
  "wasUsed": true,
  "feedbackNote": "Great suggestion!"
}
```

## Webhooks

### WhatsApp Webhook

```http
GET /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

**Verification (GET):**
- `hub.mode=subscribe`
- `hub.verify_token=<your-token>`
- `hub.challenge=<challenge>`

**Webhook Events (POST):**
Receives WhatsApp Business API webhook events and queues them for processing.

### Instagram Webhook

```http
GET /api/webhooks/instagram
POST /api/webhooks/instagram
```

Handles Instagram Messaging API webhook events.

### TikTok Shop Webhook

```http
POST /api/webhooks/tiktok
```

Handles TikTok Shop webhook events including:
- `MESSAGE_NEW` - New chat messages
- `ORDER_STATUS_CHANGE` - Order updates

### Shopify Webhook

```http
POST /api/webhooks/shopify
```

Handles Shopify webhook topics:
- `orders/create`
- `orders/updated`
- `orders/paid`
- `orders/fulfilled`
- `orders/cancelled`
- `customers/create`
- `customers/update`

## Rate Limiting

API endpoints are rate-limited per account:
- 100 requests per minute for read operations
- 50 requests per minute for write operations

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

## Pagination

Use cursor-based pagination for messages:

```http
GET /api/v1/threads/:id/messages?limit=50&beforeId=msg_123
```

Use offset-based pagination for other resources:

```http
GET /api/v1/contacts?limit=50&offset=100
```

## Webhooks Security

All webhooks verify signatures:

**WhatsApp:**
- Header: `X-Hub-Signature-256`
- Method: HMAC SHA256

**Instagram:**
- Header: `X-Hub-Signature-256`
- Method: HMAC SHA256

**TikTok Shop:**
- Header: `X-TTS-Signature`
- Method: HMAC SHA256

**Shopify:**
- Header: `X-Shopify-Hmac-SHA256`
- Method: HMAC SHA256 Base64

## Examples

### Complete Flow: Receiving a Message

1. **Webhook arrives** at `/api/webhooks/whatsapp`
2. **Signature verified** and payload validated
3. **Job queued** to `inbound_message` queue
4. **Worker processes**:
   - Finds or creates contact
   - Finds or creates thread
   - Creates message record
   - Logs domain events
5. **Client polls** `/api/v1/threads` or uses real-time subscription
6. **User views message** via `/api/v1/threads/:id/messages`
7. **AI suggestions generated** via background worker
8. **User sends reply** via `/api/v1/threads/:id/messages`
9. **Outbound worker** sends message via channel API

### Complete Flow: Order Integration

1. **Shopify order created** → webhook to `/api/webhooks/shopify`
2. **Order sync worker**:
   - Creates/updates order record
   - Finds/creates contact from customer data
   - Links order to active thread
3. **Agent views** order details in conversation sidebar
4. **Thread moves** to "converted" pipeline stage
5. **Order updates** sync automatically via webhooks
