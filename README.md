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

## Pages & Features

### 📊 Dashboard (`/dashboard`)
- **Key Metrics**: Active conversations, total contacts, conversion rate, SLA at-risk
- **Pipeline Visualization**: Progress bars showing distribution across stages
- **Quick Actions**: Needs attention and recent activity summaries

### 📥 Unified Inbox (`/inbox`)
- **Thread List**: All conversations with channel indicators, unread badges, SLA warnings
- **Message View**: Full conversation history with bubble UI
- **Compose**: Send messages with AI suggestions
- **Actions**: Star, close, archive, assign threads
- **Search**: Find conversations quickly

### 👥 Contacts (`/contacts`)
- **Contact Cards**: Grid view with all contact information
- **Multi-Channel**: Shows which platforms each contact uses
- **Search**: Find contacts by name, email, or phone
- **Tags**: Visual tag system for categorization
- **Last Contacted**: Relative timestamps for engagement tracking

### 📈 Sales Pipeline (`/pipeline`)
- **Kanban Board**: Four-column view (Lead → Engaged → Converted → Lost)
- **Visual Cards**: Thread cards with contact info and channel indicators
- **Stage Metrics**: Count and percentage per stage
- **Quick Navigation**: Click cards to jump to inbox

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
- `npm run worker` - Start background job workers
- `npm run worker:dev` - Start workers in development mode

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

## Deployment

### Environment Variables

Required for all deployments:

```bash
# Database (required)
DATABASE_URL="postgresql://user:password@host:5432/database"

# Auth (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxx"
CLERK_SECRET_KEY="sk_live_xxx"

# App (required)
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
```

Optional but recommended:

```bash
# Redis (required for background jobs)
REDIS_URL="redis://host:6379"

# AI (required for AI features)
ANTHROPIC_API_KEY="sk-ant-xxx"
# or
OPENAI_API_KEY="sk-xxx"

# Channel Integrations (per channel)
WHATSAPP_API_TOKEN="xxx"
WHATSAPP_PHONE_NUMBER_ID="xxx"
INSTAGRAM_APP_ID="xxx"
INSTAGRAM_APP_SECRET="xxx"
TIKTOK_APP_KEY="xxx"
TIKTOK_APP_SECRET="xxx"
SHOPIFY_STORE_DOMAIN="your-store.myshopify.com"
SHOPIFY_ACCESS_TOKEN="xxx"

# Storage (for exports and attachments)
S3_BUCKET="your-bucket"
S3_ACCESS_KEY_ID="xxx"
S3_SECRET_ACCESS_KEY="xxx"
S3_REGION="us-east-1"
```

### Deployment on Vercel

1. **Push your code to GitHub**

2. **Import project to Vercel**:
   - Connect your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure environment variables**:
   - Add all required environment variables in Vercel dashboard
   - Mark sensitive variables as "Sensitive"

4. **Configure build settings**:
   ```
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

5. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically

6. **Set up PostgreSQL**:
   - Use Vercel Postgres or external provider (Supabase, Neon, Railway)
   - Add `DATABASE_URL` to environment variables

7. **Set up Redis** (for background jobs):
   - Use Upstash Redis (serverless) or external provider
   - Add `REDIS_URL` to environment variables

8. **Run database migrations**:
   ```bash
   # From local machine with production DATABASE_URL
   npm run db:push
   ```

9. **Deploy background workers separately**:
   - Workers cannot run on Vercel (serverless)
   - Deploy to Railway, Render, or any container platform
   - Use the same environment variables
   - Run: `npm run worker`

### Deployment on Railway

Railway supports both the web app and background workers in one project.

1. **Create new project** from GitHub repo

2. **Add PostgreSQL database**:
   - Add "PostgreSQL" service
   - `DATABASE_URL` will be auto-configured

3. **Add Redis database**:
   - Add "Redis" service
   - `REDIS_URL` will be auto-configured

4. **Configure web service**:
   ```
   Build Command: npm run build
   Start Command: npm start
   ```

5. **Add worker service**:
   - Create new service from same repo
   - Set start command: `npm run worker`
   - Share same environment variables

6. **Add environment variables**:
   - Configure all required variables in Railway dashboard

7. **Deploy**:
   - Railway will auto-deploy on git push

### Deployment on Render

1. **Create Web Service**:
   - Connect GitHub repository
   - Build Command: `npm run build`
   - Start Command: `npm start`

2. **Create Background Worker**:
   - Create new "Background Worker" service
   - Build Command: `npm install`
   - Start Command: `npm run worker`

3. **Add PostgreSQL**:
   - Create PostgreSQL database
   - Copy connection string to `DATABASE_URL`

4. **Add Redis**:
   - Create Redis instance
   - Copy connection string to `REDIS_URL`

5. **Configure environment variables** in Render dashboard

### Deployment with Docker

1. **Build the image**:
   ```bash
   docker build -t dm-sales-desk .
   ```

2. **Run web service**:
   ```bash
   docker run -p 3000:3000 \
     -e DATABASE_URL="postgresql://..." \
     -e REDIS_URL="redis://..." \
     -e CLERK_SECRET_KEY="..." \
     dm-sales-desk
   ```

3. **Run workers**:
   ```bash
   docker run \
     -e DATABASE_URL="postgresql://..." \
     -e REDIS_URL="redis://..." \
     dm-sales-desk npm run worker
   ```

4. **Use Docker Compose** (recommended):
   ```yaml
   version: '3.8'
   services:
     web:
       build: .
       ports:
         - "3000:3000"
       env_file: .env

     worker:
       build: .
       command: npm run worker
       env_file: .env

     postgres:
       image: postgres:14
       environment:
         POSTGRES_DB: dm_sales_desk
         POSTGRES_USER: user
         POSTGRES_PASSWORD: password

     redis:
       image: redis:7-alpine
   ```

### Post-Deployment Setup

1. **Configure webhooks**:
   - WhatsApp: `https://yourdomain.com/api/webhooks/whatsapp`
   - Instagram: `https://yourdomain.com/api/webhooks/instagram`
   - TikTok Shop: `https://yourdomain.com/api/webhooks/tiktok`
   - Shopify: `https://yourdomain.com/api/webhooks/shopify`

2. **Test webhook endpoints**:
   ```bash
   curl https://yourdomain.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=test
   ```

3. **Monitor background workers**:
   - Check worker logs for job processing
   - Monitor Redis queues

4. **Set up monitoring** (recommended):
   - Use Sentry for error tracking
   - Use Datadog/New Relic for APM
   - Monitor queue health and job failures

## API Documentation

See [API.md](./API.md) for detailed API documentation.

## License

ISC
