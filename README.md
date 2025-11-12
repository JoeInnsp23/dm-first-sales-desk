# DM-First Sales Desk

A unified inbox and lightweight CRM for social-commerce sellers operating through WhatsApp, Instagram DMs, and TikTok Shop Chat.

## Features

- **Unified Inbox**: Manage conversations from WhatsApp, Instagram, and TikTok Shop in one place
- **Auto-Contact Creation**: Automatically create and link contacts across channels
- **Order Integration**: Connect Shopify and TikTok Shop orders to conversations
- **AI-Assisted Replies**: Get AI-powered reply suggestions and sentiment analysis
- **Task Management**: Snooze threads, set reminders, and manage follow-ups
- **Sales Pipeline**: Visualize and manage leads through customizable stages
- **Multi-tenant**: Full account isolation with role-based access control

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: Redis + BullMQ (for background jobs)
- **Auth**: Clerk
- **AI**: Anthropic Claude / OpenAI
- **Storage**: S3-compatible storage

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dm-first-sales-desk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your configuration.

4. Generate and run database migrations:
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The application uses a comprehensive multi-tenant schema with the following key entities:

- **Accounts & Users**: Multi-tenant account management with role-based access
- **Channel Connections**: Store encrypted credentials for WhatsApp, Instagram, TikTok Shop, and Shopify
- **Contacts**: Unified customer profiles across all channels
- **Threads**: Conversation threads with status, assignment, and pipeline tracking
- **Messages**: Canonical message store with deduplication
- **Orders**: Shopify and TikTok Shop order integration
- **Tasks & Notifications**: Reminders, follow-ups, and notification system
- **AI Suggestions**: Store and track AI-generated replies and insights
- **Domain Events**: Audit log for debugging and analytics

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run db:generate` - Generate migration files
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Drizzle Studio

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   │   └── ui/          # shadcn/ui components
│   ├── lib/             # Core utilities and services
│   │   ├── db/          # Database schema and client
│   │   │   └── schema/  # Drizzle schema modules
│   │   ├── services/    # Business logic services
│   │   └── utils/       # Utility functions
│   └── types/           # TypeScript type definitions
├── drizzle/             # Generated migrations
├── public/              # Static assets
└── drizzle.config.ts    # Drizzle ORM configuration
```

## Architecture

The application follows an event-driven architecture:

1. **Webhook Ingestion**: Platform webhooks are received and verified
2. **Job Queue**: Events are pushed to Redis queues via BullMQ
3. **Message Pipeline**: Workers process events, create/update entities
4. **Domain Events**: All changes emit domain events for audit/analytics
5. **API Layer**: RESTful API with multi-tenant security
6. **UI Layer**: React Server Components with client interactivity

## License

ISC
