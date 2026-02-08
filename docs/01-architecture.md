# TechLancer — Architecture & Tech Stack

## 1. Overview

TechLancer is a **tech-service marketplace** where **clients** open support tickets for tech problems and **agents** (technicians/developers) grab those tickets, submit quotes, and deliver the service. The platform handles escrow payments, mutual ratings, and in-app communication.

### Core Flow

```
Client creates Ticket → Agents see Feed → Agent submits Bid
→ Client accepts Bid → Chat opens → Escrow Payment
→ Service Delivered → Mutual Rating → Payment Released
```

---

## 2. Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | React Native + Expo SDK 52+ | Cross-platform mobile app (iOS + Android) |
| **Routing** | expo-router v4 | File-based navigation |
| **Backend API** | Express.js (Node.js) | REST API server with business logic |
| **Backend / DB** | Supabase (Postgres) | Database, Auth, Storage, Realtime |
| **Auth** | Supabase Auth | Email/password + Google/Apple OAuth |
| **File Storage** | Supabase Storage | Ticket photos/videos, avatars, portfolios |
| **Realtime** | Supabase Realtime | Live chat, ticket status updates, notifications |
| **Payments** | Stripe (via Express API) | Escrow payments, payouts, refunds |
| **Push Notifications** | Expo Notifications | New bids, messages, status changes |
| **Email** | Resend (via Express API) | Transactional emails (welcome, receipt, etc.) |
| **Media** | expo-image-picker, expo-camera | Photo/video capture for tickets |
| **Maps/Location** | expo-location | Agent proximity, client location |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────┐
│              React Native App               │
│         (Expo SDK 52 + expo-router)         │
│                                             │
│  ┌─────────┐ ┌──────────┐ ┌─────────────┐   │
│  │ Client  │ │  Agent   │ │   Shared    │   │
│  │ Screens │ │ Screens  │ │ Components  │   │
│  └────┬────┘ └────┬─────┘ └──────┬──────┘   │
│       └───────────┼──────────────┘          │
│                   │                         │
│  ┌────────────────▼─────────────────────┐   │
│  │         lib/ (Services Layer)        │   │
│  │  api.ts | auth.ts | tickets.ts      │   │
│  │  bids.ts | chat.ts | payments.ts     │   │
│  │  notifications.ts                    │   │
│  └────────────────┬─────────────────────┘   │
└───────────────────┼─────────────────────────┘
                    │ HTTP/REST
        ┌───────────▼───────────┐
        │   Express API Server  │
        │      (Node.js)        │
        │                       │
        │  ┌─────────────────┐  │
        │  │  REST Endpoints │  │
        │  │  /api/tickets   │  │
        │  │  /api/bids      │  │
        │  │  /api/chat     │  │
        │  │  /api/payments │  │
        │  └─────────────────┘  │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │      Supabase         │
        │                       │
        │  ┌─────────────────┐  │
        │  │   PostgreSQL    │  │
        │  │   (Database)    │  │
        │  └─────────────────┘  │
        │  ┌─────────────────┐  │
        │  │   Auth Service  │  │
        │  └─────────────────┘  │
        │  ┌─────────────────┐  │
        │  │  Storage (S3)   │  │
        │  └─────────────────┘  │
        │  ┌─────────────────┐  │
        │  │    Realtime     │  │
        │  │  (WebSockets)   │  │
        │  └─────────────────┘  │
        └───────────┬───────────┘
                    │
          ┌─────────▼─────────┐
          │   Stripe API      │
          │  (Payments)       │
          └───────────────────┘
```

---

## 4. Frontend Architecture

### 4.1 Folder Structure

```
app/
├── _layout.tsx                    # Root layout (auth provider, theme)
├── index.tsx                      # Landing / splash screen
├── login.tsx                      # Login screen
├── register.tsx                   # Registration screen
├── (client)/                      # Client-only screens
│   ├── _layout.tsx                # Client tab layout
│   ├── home.tsx                   # Client dashboard / my tickets
│   ├── create-ticket.tsx          # Create new ticket (guided form)
│   ├── ticket/[id].tsx            # Ticket detail + bids list
│   ├── chat/[conversationId].tsx  # Chat with agent
│   ├── review/[ticketId].tsx      # Leave review
│   └── profile.tsx                # Client profile
├── (agent)/                       # Agent-only screens
│   ├── _layout.tsx                # Agent tab layout
│   ├── feed.tsx                   # Available tickets feed
│   ├── ticket/[id].tsx            # Ticket detail + submit bid
│   ├── my-bids.tsx                # My submitted bids
│   ├── jobs.tsx                   # Active/completed jobs
│   ├── chat/[conversationId].tsx  # Chat with client
│   ├── review/[ticketId].tsx      # Leave review
│   └── profile.tsx                # Agent profile (public)
└── (shared)/                      # Shared screens
    ├── settings.tsx               # App settings
    ├── notifications.tsx          # Notifications list
    └── agent-profile/[id].tsx     # View agent public profile
```

### 4.2 Key Libraries (Expo SDK 52+)

```
expo-router v4              — File-based routing with typed routes
expo-image                  — Optimized image rendering
expo-image-picker           — Photo/video from camera/gallery
expo-camera                 — Direct camera access
expo-location               — Geolocation for proximity
expo-notifications          — Push notifications
expo-secure-store           — Secure credential storage
expo-haptics                — Tactile feedback on actions
expo-av                     — Video playback (ticket videos)
expo-file-system            — File management for uploads
react-native-reanimated     — Smooth animations
react-native-gesture-handler — Swipe gestures
@gorhom/bottom-sheet        — Bottom sheets for actions
```

---

## 5. Backend Architecture

### 5.1 Express API Server

The **Express.js backend** provides REST API endpoints that the React Native app calls. The Express server handles all business logic, validation, and orchestrates interactions with Supabase and external services.

**API Endpoints Structure:**
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/tickets` - List tickets (with filters)
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/bids` - Submit bid on ticket
- `GET /api/bids` - List bids (agent's bids or ticket bids)
- `PUT /api/bids/:id/accept` - Accept a bid
- `POST /api/chat/conversations` - Create conversation
- `GET /api/chat/conversations/:id/messages` - Get messages
- `POST /api/chat/messages` - Send message
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `POST /api/payments/release` - Release escrow payment
- `POST /api/reviews` - Create review
- `GET /api/profiles/:id` - Get user profile
- `PUT /api/profiles/:id` - Update profile

### 5.2 Supabase Integration

The Express server uses **Supabase client libraries** to interact with:
- **PostgreSQL Database** - All data persistence
- **Supabase Auth** - User authentication and session management
- **Supabase Storage** - File uploads (photos, videos, documents)
- **Supabase Realtime** - WebSocket connections for live updates

### 5.3 External Service Integrations

The Express server handles integrations with:
- **Stripe API** - Payment processing, escrow, payouts
- **Resend API** - Transactional emails
- **Expo Push Notifications** - Mobile push notifications

### 5.3 Database Triggers & Functions

Postgres functions triggered automatically:

| Trigger | Purpose |
| --- | --- |
| `on_user_created` | Create profile row when auth.user registers |
| `on_bid_accepted` | Update ticket status, notify other bidders |
| `on_payment_completed` | Update ticket status to "in_progress" |
| `on_service_completed` | Release payment, prompt reviews |
| `on_review_created` | Update agent average rating |
| `on_message_created` | Increment unread count, send notification |

---

## 6. Security Model

### 6.1 Authentication

- **Express API** handles authentication endpoints (`/api/auth/login`, `/api/auth/register`)
- Express server validates credentials and uses **Supabase Auth** for JWT token generation
- Email/password registration with email confirmation
- Google & Apple OAuth for reduced friction (handled via Express endpoints)
- Session tokens stored in `expo-secure-store`
- JWT tokens sent in `Authorization` header for API requests

### 6.2 Authorization (RLS)

Every table has **Row Level Security** policies:
- Clients can only see/edit their own tickets
- Agents can only see open tickets + their own bids
- Chat messages restricted to conversation participants
- Reviews can only be created by transaction participants
- Payment records visible only to involved parties

### 6.3 Input Validation

- Client-side validation (lib/validation.ts)
- Server-side validation in Express API (request body validation, sanitization)
- Database-level validation via Postgres CHECK constraints
- Rate limiting on Express API endpoints (sensitive operations)
- File upload size limits (10MB photos, 50MB videos)
- Content type validation for uploads

---

## 7. Realtime Architecture

Supabase Realtime channels for live updates:

| Channel | Events |
| --- | --- |
| `tickets:{userId}` | New bids on client's tickets |
| `bids:{agentId}` | Bid status changes (accepted/rejected) |
| `chat:{conversationId}` | New messages in conversation |
| `notifications:{userId}` | General notifications |

---

## 8. Upgrade Path from Current State

### What exists now (to keep):
- ✅ Expo + React Native project structure
- ✅ expo-router setup
- ✅ Auth service (`lib/auth.ts`)
- ✅ Validation utilities (`lib/validation.ts`)
- ✅ Rate limiter (`lib/rateLimiter.ts`)
- ✅ Logger (`lib/logger.ts`)
- ✅ Basic login/register screens

### What needs to change:
- 🔄 Upgrade Expo SDK 51 → 52 (latest)
- 🔄 Restructure `app/` folder for client/agent routing
- 🔄 Add new libraries (expo-image-picker, expo-location, etc.)
- ➕ Create all new screens (tickets, bids, chat, etc.)
- ➕ Integrate Stripe in Express API
- ➕ Set up push notifications via Express API
