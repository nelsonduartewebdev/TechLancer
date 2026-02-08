# TechLancer — Business Logic & Rules

## Overview

This document defines the core business rules, state machines, pricing logic, and edge cases that govern the TechLancer platform.

---

## 1. User Roles & Permissions

### Role: Client
- Can create tickets
- Can upload media (photos/video) to own tickets
- Can view bids on own tickets
- Can accept a bid on own ticket
- Can chat with assigned agent
- Can make payments (escrow)
- Can mark service as completed
- Can open disputes
- Can leave reviews (for agent)
- Cannot bid on tickets
- Cannot access agent feed

### Role: Agent
- Can browse ticket feed (filtered by categories)
- Can view ticket details
- Can submit bids (one per ticket)
- Can promote bids (paid highlight)
- Can chat with client (after bid accepted)
- Can receive payments (via Stripe Connect)
- Can leave reviews (for client)
- Cannot create tickets
- Cannot accept bids

### Role: Admin (Future — via Supabase dashboard or separate admin panel)
- Can view all users, tickets, bids, payments
- Can verify/reject agents
- Can resolve disputes
- Can issue refunds
- Can manage categories
- Can view platform analytics

---

## 2. Ticket State Machine

```
                 ┌──────────────┐
        ┌────────│    OPEN      │────────┐
        │        └──────┬───────┘        │
        │               │                │
        │         Agent submits          Client cancels
        │           first bid             (no bids yet)
        │               │                │
        │        ┌──────▼───────┐        │
        │        │   BIDDING    │────────┤
        │        └──────┬───────┘        │
        │               │                │
        │         Client accepts         Client cancels
        │             a bid              (before accept)
        │               │                │
        │        ┌──────▼───────┐        │
        │        │   ACCEPTED   │        │
        │        └──────┬───────┘        │
        │               │                │
        │         Payment completed      │
        │               │                │
        │        ┌──────▼───────┐        │
        │        │ IN_PROGRESS  │────────┤
        │        └──────┬───────┘        │
        │          │           │         │
        │    Client marks    Client opens │
        │    as complete      dispute     │
        │          │           │         │
        │   ┌──────▼──────┐  ┌▼────────┐│
        │   │  COMPLETED  │  │DISPUTED ││
        │   └──────┬──────┘  └─────────┘│
        │          │                     │
        │    Both review                 │
        │          │                     │
        │   ┌──────▼──────┐             │
        │   │  REVIEWED   │             │
        │   └─────────────┘             │
        │                               │
        │        ┌──────────────┐       │
        └────────│  CANCELLED   │◄──────┘
                 └──────────────┘
```

### Status Transitions

| From | To | Trigger | Actor |
| --- | --- | --- | --- |
| `open` | `bidding` | First bid submitted | System (automatic) |
| `open` | `cancelled` | Client cancels | Client |
| `bidding` | `accepted` | Client accepts a bid | Client |
| `bidding` | `cancelled` | Client cancels | Client (confirm: "You have {n} bids, are you sure?") |
| `accepted` | `in_progress` | Payment captured (escrow) | System (after Stripe confirm) |
| `in_progress` | `completed` | Client marks complete | Client |
| `in_progress` | `disputed` | Client or agent opens dispute | Either party |
| `completed` | `reviewed` | Both parties reviewed | System (after both reviews) |
| `disputed` | `completed` | Admin resolves (release payment) | Admin |
| `disputed` | `cancelled` | Admin resolves (full refund) | Admin |

### Rules
- A ticket can only be cancelled if status is `open` or `bidding`
- Once a bid is accepted, the ticket cannot be cancelled (payment flow starts)
- Only the **client** can mark a service as completed
- A ticket moves to `reviewed` only after **both** parties have reviewed
- A disputed ticket is frozen until admin resolves it

---

## 3. Bid State Machine

```
    ┌──────────────┐
    │   PENDING    │
    └──────┬───────┘
      │    │     │
      │    │     └──── Agent withdraws ──→ WITHDRAWN
      │    │
      │    └──── Client rejects ──→ REJECTED
      │
      └──── Client accepts ──→ ACCEPTED
                                  │
                       (all other bids → REJECTED)
```

### Rules
- One bid per agent per ticket (UNIQUE constraint)
- Agent can withdraw own bid if `pending`
- When client accepts one bid, all other bids → `rejected`
- Agents cannot bid on tickets in `accepted`, `in_progress`, `completed`, `cancelled`, `disputed` status
- Promoted bids appear first in the list (sorted by `is_promoted DESC, created_at ASC`)
- Agent can see their own bid status but not other agents' bids
- Client can see all bids on their ticket

---

## 4. Payment / Escrow Flow

### Step-by-Step

```
1. Client accepts bid
     │
2. Client taps "Proceed to Payment"
     │
3. Edge Function: create-payment-intent
     │  → Creates Stripe PaymentIntent (capture_method: 'manual')
     │  → Creates payment record (status: 'pending')
     │  → Returns client_secret
     │
4. Client completes payment (Stripe Payment Sheet)
     │
5. Stripe webhook: payment_intent.succeeded
     │  → Edge Function captures the payment
     │  → Payment status: 'pending' → 'held'
     │  → Ticket status: 'accepted' → 'in_progress'
     │  → Notify agent: "Payment received, start working!"
     │
     ======= SERVICE PERIOD =======
     │
6a. Client marks as completed (happy path)
     │  → Edge Function: complete-service
     │  → Stripe: Create Transfer to agent's connected account
     │  → Payment status: 'held' → 'released' → 'paid_out'
     │  → Ticket status: 'in_progress' → 'completed'
     │  → Prompt both parties to review
     │
6b. Client opens dispute (unhappy path)
     │  → Edge Function: open-dispute
     │  → Payment remains 'held' (funds frozen)
     │  → Ticket status: 'in_progress' → 'disputed'
     │  → Admin notified
     │
     └─→ Admin resolves:
           ├─ Full refund → Stripe refund → Payment 'refunded'
           ├─ Partial refund → Split between agent + refund
           └─ Release to agent → Transfer to agent → Payment 'paid_out'
```

### Pricing Breakdown

| Component | Calculation | Example (€100 service) |
| --- | --- | --- |
| Service Amount | Set by agent | €100.00 |
| Platform Fee | 15% + €0.70 | €15.70 |
| **Total (Client Pays)** | Service + Fee | **€115.70** |
| Agent Receives | Service Amount | €100.00 |
| Platform Revenue | Platform Fee | €15.70 |

### Stripe Configuration
- **Payment method**: Card (via Stripe Payment Sheet)
- **Capture method**: `manual` (authorize first, capture after confirm)
- **Currency**: EUR
- **Stripe Connect**: Standard accounts for agents
- **Application fee**: Platform fee amount (deducted from total)
- **Transfer destination**: Agent's connected Stripe account

### Edge Cases
- **Payment fails**: Payment status → `failed`. Client can retry.
- **Agent not on Stripe**: Must complete Stripe Connect onboarding before receiving payouts.
- **Auto-release**: If client doesn't mark complete within 14 days and no dispute, auto-release funds to agent (via scheduled Edge Function).
- **Refund window**: Disputes must be opened within 7 days of service completion.
- **Stripe fees**: Stripe's own processing fees (~1.4% + €0.25 for EU cards) are absorbed by the platform from the platform fee, or passed to the client (business decision).

---

## 5. Rating System

### Rules
- Both parties rate each other after ticket `completed`
- Rating: 1-5 stars (integer)
- Comment: Optional, max 500 characters
- **One review per direction per ticket** (enforced by UNIQUE constraint)
- Reviews are **permanent** — cannot be edited or deleted
- Reviews are **public** — visible on agent profiles

### Agent Rating Calculation
```
avg_rating = AVG(all client_to_agent reviews for this agent)
total_reviews = COUNT(all client_to_agent reviews for this agent)
```

Updated via database trigger on `INSERT` into `reviews` table.

### Review Prompting
1. After `complete-service` → notification: "Rate your experience!"
2. If no review after 24h → email reminder
3. If no review after 72h → second reminder
4. After 7 days → no more reminders (review still possible anytime)

### Display
- Agent profile: avg rating (stars) + total review count
- Bid cards: agent's rating shown to client
- Individual reviews: star rating + comment + client name + date

---

## 6. Agent Verification System

### Levels

| Level | Badge | Requirements |
| --- | --- | --- |
| **Unverified** | None | Just registered |
| **Verified** | ✓ Blue badge | Identity confirmed + portfolio reviewed by admin |
| **Top Agent** | ⭐ Gold badge (future) | Verified + 50+ jobs + 4.5+ avg rating |

### Verification Process (MVP)
1. Agent clicks "Request Verification" in profile
2. Agent uploads:
   - Government ID (photo)
   - Professional certifications (optional)
   - Portfolio / work samples (optional)
3. Status → `pending`
4. Admin reviews (via admin panel or Supabase dashboard)
5. Admin approves → `verified` + `verified_at` timestamp
6. OR Admin rejects → `rejected` + reason
7. Agent notified of result

### Impact of Verification
- Verified agents get a visible badge on profile and bid cards
- Clients see "Verified" status when reviewing bids
- Pro subscribers + verified = highest trust level
- Future: verified agents may get priority in feed

---

## 7. Bid Promotion System

### How It Works
- When submitting a bid, agent can choose to "Promote" it
- Promoted bids appear at the **top** of the client's bid list
- Promoted bids have a visual "Featured" badge

### Pricing
- **Pay-per-use**: €1.99 per promoted bid
- **Pro subscribers**: Get 10-15 free highlight credits per month

### Logic
1. Agent toggles "Promote" when submitting bid
2. If Pro subscriber with credits → deduct 1 credit
3. If no credits / free tier → charge €1.99 via Stripe
4. Set `is_promoted = true`, `promoted_at = now()`
5. Bid appears first in sort order

### Sort Order (Client's bid list)
```
1. Promoted bids (ordered by promoted_at ASC — first promoted = first shown)
2. Non-promoted bids (ordered by created_at ASC — first bid = first shown)
```

---

## 8. Agent Feed Algorithm

### How agents see tickets

```
Input: Agent's categories, Agent's location, Agent's preferences
Output: Sorted list of relevant tickets

Steps:
1. Filter tickets WHERE status IN ('open', 'bidding')
2. Filter WHERE category_id IN (agent's selected categories)
3. Exclude tickets agent has already bid on
4. Calculate distance (if both have coordinates)
5. Sort by:
   a. Urgency: 'urgent' tickets first
   b. Recency: newest first (within same urgency)
   c. Distance: nearest first (optional secondary sort)
```

### Future Enhancements
- Personalized feed based on agent's bid acceptance rate per category
- "Recommended for you" based on past job types
- Location-based push notifications for nearby urgent tickets

---

## 9. Chat Rules

### When Chat Opens
- A conversation is created **automatically** when a bid is accepted
- First message is a system message: "Bid accepted! Coordinate service details here."
- Both parties can send messages from that point

### Message Types
| Type | Description |
| --- | --- |
| `text` | Regular text message |
| `image` | Photo attachment (stored in `chat-media` bucket) |
| `system` | Auto-generated messages (bid accepted, payment made, etc.) |

### System Messages (auto-generated)
| Event | Message |
| --- | --- |
| Bid accepted | "✅ Bid accepted! You can now coordinate the service." |
| Payment made | "💰 Payment received. The service can begin." |
| Service completed | "🎉 Service marked as completed!" |
| Dispute opened | "⚠️ A dispute has been opened for this service." |
| Dispute resolved | "✅ The dispute has been resolved." |

### Rules
- Messages are **immutable** (no edit, no delete)
- Chat is only available between conversation participants
- Chat remains accessible after ticket is completed (for reference)
- Images are stored in `chat-media` Storage bucket (max 10MB)

---

## 10. Notification System

### Notification Types

| Type | Recipient | Trigger |
| --- | --- | --- |
| `new_bid` | Client | Agent submits bid on client's ticket |
| `bid_accepted` | Agent | Client accepts agent's bid |
| `bid_rejected` | Agent | Client accepts another agent's bid |
| `new_message` | Other party | New chat message (if app backgrounded) |
| `payment_received` | Agent | Client completes payment |
| `service_completed` | Both | Service marked as completed |
| `review_received` | Reviewee | Other party left a review |
| `review_reminder` | Both | 24h after completion with no review |
| `dispute_opened` | Other party | Dispute opened |
| `dispute_resolved` | Both | Admin resolves dispute |
| `verification_update` | Agent | Verification status changed |

### Channels
1. **In-App**: Stored in `notifications` table, shown in notifications screen
2. **Push**: Via Expo Push Notification API (when app is backgrounded)
3. **Email**: Via Resend (for important events like payments, disputes)

### Push Notification Deep Links
| Type | Deep Link |
| --- | --- |
| `new_bid` | `/(client)/tickets/[ticketId]` |
| `bid_accepted` | `/(agent)/bids/[bidId]` |
| `new_message` | `/(*/messages/[conversationId]` |
| `payment_received` | `/(agent)/earnings` |
| `review_received` | `/(shared)/agent-profile/[agentId]` |

---

## 11. Data Validation Rules

### Ticket
| Field | Validation |
| --- | --- |
| `title` | Required, 5-100 characters, no HTML |
| `description` | Required, 20-2000 characters, no HTML |
| `category_id` | Required, must exist in categories table |
| `urgency` | Must be: `low`, `normal`, `urgent` |
| `media` | Max 5 files, images ≤ 10MB, videos ≤ 50MB |
| `city` | Max 100 characters |

### Bid
| Field | Validation |
| --- | --- |
| `amount` | Required, min €5.00, max €10,000.00 |
| `message` | Required, 20-1000 characters |
| `estimated_days` | Optional, min 1, max 365 |
| `ticket status` | Must be `open` or `bidding` |
| `agent` | Must not have existing bid on this ticket |

### Review
| Field | Validation |
| --- | --- |
| `rating` | Required, integer 1-5 |
| `comment` | Optional, max 500 characters |
| `ticket status` | Must be `completed` or `reviewed` |
| `reviewer` | Must be a participant of the ticket |

### Profile
| Field | Validation |
| --- | --- |
| `full_name` | Required, 2-100 characters |
| `phone` | Optional, valid phone format |
| `bio` (agent) | Optional, max 500 characters |
| `avatar` | Image only, max 5MB |

---

## 12. Rate Limiting

| Action | Limit | Window |
| --- | --- | --- |
| Login attempts | 5 per email | 15 minutes |
| Registration | 3 per email | 24 hours |
| Create ticket | 10 | per day per user |
| Submit bid | 20 | per day per agent |
| Send message | 60 | per minute per user |
| Upload media | 50 | per day per user |

Rate limiting is applied:
- **Client-side**: Via `lib/rateLimiter.ts` (soft limit, UX only)
- **Server-side**: Via Supabase RLS policies + Edge Function checks (hard limit)

---

## 13. Internationalization (i18n)

### Supported Languages (MVP)
- 🇵🇹 Portuguese (PT) — Primary
- 🇬🇧 English (EN) — Secondary

### Strategy
- Store user language preference in `profiles` table
- Use React Native i18n library (e.g., `i18next` + `react-i18next`)
- Category labels stored in both PT and EN in database
- UI strings in translation files
- Email templates in both languages

---

## 14. Future Features (Post-MVP)

| Feature | Priority | Notes |
| --- | --- | --- |
| Q&A / Community forum | Medium | Agents answer questions, build reputation |
| Logistics integration | Low | Pickup/delivery service for hardware |
| Pro subscriptions (Stripe Billing) | High | Monthly billing for agents |
| Advanced analytics for agents | Medium | Pro dashboard |
| Diagnostic as a product | Low | Paid remote diagnosis service |
| Agent portfolio / gallery | Medium | Showcase past work |
| Recurring tickets | Low | For maintenance contracts |
| Multi-language categories | Medium | Dynamic based on locale |
| Admin panel (web) | High | Web dashboard for admin operations |
| Referral program | Low | Invite friends, earn credits |
