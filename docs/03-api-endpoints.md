# TechLancer — Backend API Endpoints & Logic

## Overview

TechLancer uses a **hybrid backend approach**:

1. **Direct Supabase Client** — Most CRUD operations go directly from the app to Supabase via `supabase-js`, protected by RLS policies. No custom API server needed.
2. **Supabase Edge Functions** — Server-side logic that requires elevated privileges (payments, webhooks, notifications, admin actions).

---

## Part A: Direct Supabase Operations (via supabase-js)

These are called directly from the React Native app using the Supabase client library. **No custom endpoints needed** — RLS policies handle authorization.

---

### A1. Authentication

| Operation | Supabase Method | Notes |
| --- | --- | --- |
| Register (email) | `supabase.auth.signUp()` | Pass `role` in `options.data` metadata |
| Login (email) | `supabase.auth.signInWithPassword()` | Returns session + JWT |
| Login (Google) | `supabase.auth.signInWithOAuth()` | Provider: 'google' |
| Login (Apple) | `supabase.auth.signInWithOAuth()` | Provider: 'apple' |
| Logout | `supabase.auth.signOut()` | Clears session |
| Reset password | `supabase.auth.resetPasswordForEmail()` | Sends email |
| Update password | `supabase.auth.updateUser()` | Requires active session |
| Get session | `supabase.auth.getSession()` | Check auth state |
| Listen auth changes | `supabase.auth.onAuthStateChange()` | Realtime auth state |

**Registration Logic (Client Side):**
```typescript
// 1. Sign up with Supabase Auth
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: name,
      role: 'client' | 'agent',
      date_of_birth: '1990-01-15',
    }
  }
});
// 2. Trigger auto-creates profiles + agent_profiles rows
```

---

### A2. Profiles

| Operation | Method | Table | Filter |
| --- | --- | --- | --- |
| Get my profile | `SELECT` | `profiles` | `id = auth.uid()` |
| Update my profile | `UPDATE` | `profiles` | `id = auth.uid()` |
| Get agent profile | `SELECT` | `profiles` JOIN `agent_profiles` | `id = :agentId` |
| Update agent profile | `UPDATE` | `agent_profiles` | `id = auth.uid()` |
| Upload avatar | `storage.upload()` | Bucket: `avatars` | — |
| Get any user profile | `SELECT` | `profiles` | `id = :userId` |

**Example — Update agent categories:**
```typescript
// Delete existing
await supabase.from('agent_categories').delete().eq('agent_id', userId);
// Insert new
await supabase.from('agent_categories').insert(
  categoryIds.map(catId => ({ agent_id: userId, category_id: catId }))
);
```

---

### A3. Categories

| Operation | Method | Table | Filter |
| --- | --- | --- | --- |
| List all categories | `SELECT` | `categories` | `is_active = true` ORDER BY `sort_order` |
| Get agent's categories | `SELECT` | `agent_categories` JOIN `categories` | `agent_id = :id` |

---

### A4. Tickets

| Operation | Method | Table | Details |
| --- | --- | --- | --- |
| Create ticket | `INSERT` | `tickets` | Client only. Status = 'open' |
| Get my tickets | `SELECT` | `tickets` | `client_id = auth.uid()` |
| Get ticket detail | `SELECT` | `tickets` | By `id`, with bids count |
| Update ticket | `UPDATE` | `tickets` | Cancel own ticket (status → 'cancelled') |
| Delete ticket | `DELETE` | `tickets` | Only if status = 'open', no bids |
| **Agent Feed** | `SELECT` | `tickets` | `status IN ('open','bidding')`, filtered by agent's categories & location |

**Create Ticket Flow:**
```typescript
// 1. Insert ticket
const { data: ticket } = await supabase
  .from('tickets')
  .insert({
    client_id: userId,
    category_id: selectedCategory,
    title,
    description,
    device_brand,
    device_model,
    urgency,
    city,
    latitude,
    longitude,
    is_remote,
  })
  .select()
  .single();

// 2. Upload media
for (const file of mediaFiles) {
  const path = `${ticket.id}/${file.name}`;
  await supabase.storage.from('ticket-media').upload(path, file.blob);
  
  await supabase.from('ticket_media').insert({
    ticket_id: ticket.id,
    uploader_id: userId,
    storage_path: path,
    media_type: file.type.startsWith('video') ? 'video' : 'image',
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
  });
}
```

**Agent Feed Query:**
```typescript
const { data: tickets } = await supabase
  .from('tickets')
  .select(`
    *,
    category:categories(name, label_pt, label_en, icon),
    client:profiles!client_id(full_name, avatar_url, city),
    media:ticket_media(id, storage_path, media_type)
  `)
  .in('status', ['open', 'bidding'])
  .in('category_id', agentCategoryIds)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

---

### A5. Bids

| Operation | Method | Table | Details |
| --- | --- | --- | --- |
| Submit bid | `INSERT` | `bids` | Agent only. Calculate fees |
| Get bids on ticket | `SELECT` | `bids` | `ticket_id = :id` (client sees all, agent sees own) |
| Get my bids | `SELECT` | `bids` | `agent_id = auth.uid()` |
| Withdraw bid | `UPDATE` | `bids` | `status → 'withdrawn'` |
| Accept bid | `UPDATE` | `bids` + `tickets` | Complex — see business logic |
| Reject bid | `UPDATE` | `bids` | `status → 'rejected'` |

**Submit Bid:**
```typescript
// Calculate fees
const platformFee = Math.round((amount * 0.15 + 0.70) * 100) / 100;
const totalPrice = amount + platformFee;

const { data: bid } = await supabase
  .from('bids')
  .insert({
    ticket_id: ticketId,
    agent_id: userId,
    amount,
    platform_fee: platformFee,
    total_price: totalPrice,
    message,
    estimated_days,
  })
  .select()
  .single();
```

**Accept Bid (requires transaction — via Edge Function or RPC):**
```typescript
// This should be an RPC call for atomicity
const { data } = await supabase.rpc('accept_bid', {
  p_bid_id: bidId,
  p_ticket_id: ticketId,
});
```

---

### A6. Conversations & Messages

| Operation | Method | Table | Details |
| --- | --- | --- | --- |
| Get my conversations | `SELECT` | `conversations` | Where I'm client or agent |
| Get messages | `SELECT` | `messages` | `conversation_id = :id`, paginated |
| Send message | `INSERT` | `messages` | Participant only |
| Mark as read | `UPDATE` | `conversations` | Reset unread count |
| Subscribe to messages | `Realtime` | `messages` | Filter by conversation_id |

**Realtime Chat Subscription:**
```typescript
const channel = supabase
  .channel(`chat:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    addMessage(payload.new);
  })
  .subscribe();
```

---

### A7. Reviews

| Operation | Method | Table | Details |
| --- | --- | --- | --- |
| Submit review | `INSERT` | `reviews` | Only after ticket completed |
| Get reviews for user | `SELECT` | `reviews` | `reviewee_id = :userId` |
| Get reviews for ticket | `SELECT` | `reviews` | `ticket_id = :ticketId` |

---

### A8. Notifications

| Operation | Method | Table | Details |
| --- | --- | --- | --- |
| Get my notifications | `SELECT` | `notifications` | `user_id = auth.uid()` |
| Mark as read | `UPDATE` | `notifications` | `is_read = true` |
| Mark all as read | `UPDATE` | `notifications` | Where `user_id = auth.uid()` |
| Get unread count | `SELECT count` | `notifications` | `is_read = false` |
| Subscribe to notifications | `Realtime` | `notifications` | Filter by user_id |

---

## Part B: Supabase Edge Functions (Server-side)

These handle operations that need **elevated privileges** (service_role key), **external API calls** (Stripe, Resend), or **atomic transactions**.

---

### B1. `accept-bid`

**POST** `/functions/v1/accept-bid`

Atomically accepts a bid and updates all related records.

**Request:**
```json
{
  "bid_id": "uuid",
  "ticket_id": "uuid"
}
```

**Logic:**
1. Verify caller is the ticket's client
2. Verify bid exists and is `pending`
3. Verify ticket status is `open` or `bidding`
4. **Transaction:**
   - Update bid status → `accepted`
   - Reject all other bids on the ticket
   - Update ticket: `status → accepted`, `accepted_bid_id`, `accepted_agent_id`, `accepted_at`
   - Create `conversation` between client and agent
   - Create system message in conversation: "Bid accepted! You can now coordinate."
   - Create notifications for agent (bid accepted) and other bidders (bid not selected)
5. Return conversation ID

**Response:**
```json
{
  "success": true,
  "conversation_id": "uuid",
  "message": "Bid accepted successfully"
}
```

---

### B2. `create-payment-intent`

**POST** `/functions/v1/create-payment-intent`

Creates a Stripe PaymentIntent for escrow payment.

**Request:**
```json
{
  "ticket_id": "uuid",
  "bid_id": "uuid"
}
```

**Logic:**
1. Verify caller is the ticket's client
2. Verify bid is `accepted`
3. Get agent's Stripe Connected Account ID
4. Create Stripe PaymentIntent with:
   - `amount`: total_price (in cents)
   - `currency`: 'eur'
   - `capture_method`: 'manual' (for escrow — authorize now, capture later)
   - `transfer_data.destination`: agent's stripe account
   - `application_fee_amount`: platform_fee (in cents)
5. Create `payment` record in DB (status: 'pending')
6. Return client_secret for frontend

**Response:**
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "payment_id": "uuid"
}
```

---

### B3. `confirm-payment`

**POST** `/functions/v1/confirm-payment`

Called after client completes Stripe payment on frontend.

**Request:**
```json
{
  "payment_id": "uuid",
  "payment_intent_id": "pi_xxx"
}
```

**Logic:**
1. Verify PaymentIntent status with Stripe
2. If successful:
   - Capture the payment (manual capture)
   - Update payment status → `held`
   - Update ticket status → `in_progress`
   - Notify agent: "Payment received. You can start working!"
3. If failed:
   - Update payment status → `failed`
   - Notify client: "Payment failed. Please try again."

---

### B4. `complete-service`

**POST** `/functions/v1/complete-service`

Client marks the service as completed, releasing escrow.

**Request:**
```json
{
  "ticket_id": "uuid"
}
```

**Logic:**
1. Verify caller is the ticket's client
2. Verify ticket status is `in_progress`
3. **Transaction:**
   - Update ticket status → `completed`, set `completed_at`
   - Update payment status → `released`
   - Create Stripe Transfer to agent's connected account
   - Update payment status → `paid_out`
   - Update agent `total_jobs_completed` and `total_earnings`
   - Notify both parties: "Service completed! Please leave a review."
   - Create notification prompting reviews

**Response:**
```json
{
  "success": true,
  "message": "Service completed. Payment released to agent."
}
```

---

### B5. `open-dispute`

**POST** `/functions/v1/open-dispute`

Client or agent opens a dispute on an active service.

**Request:**
```json
{
  "ticket_id": "uuid",
  "reason": "Service not as described",
  "description": "The agent did not fix the issue..."
}
```

**Logic:**
1. Verify caller is a participant
2. Verify ticket is `in_progress`
3. Update ticket status → `disputed`
4. Create `dispute` record
5. Notify the other party
6. Notify admin team (via email)

---

### B6. `resolve-dispute`

**POST** `/functions/v1/resolve-dispute` (Admin only)

**Request:**
```json
{
  "dispute_id": "uuid",
  "resolution": "refund_full" | "refund_partial" | "release_to_agent",
  "resolution_note": "After review...",
  "refund_amount": 50.00
}
```

**Logic:**
1. Verify caller is admin (check custom claim)
2. Based on resolution:
   - `refund_full`: Stripe full refund → payment `refunded`
   - `refund_partial`: Stripe partial refund → payment `partially_refunded`
   - `release_to_agent`: Transfer to agent → payment `paid_out`
3. Update dispute status → `resolved`
4. Update ticket status → `completed` or `cancelled`
5. Notify both parties

---

### B7. `promote-bid`

**POST** `/functions/v1/promote-bid`

Agent pays to highlight their bid.

**Request:**
```json
{
  "bid_id": "uuid"
}
```

**Logic:**
1. Verify caller is the bid's agent
2. Check if agent has highlight credits (Pro subscription)
   - If yes: deduct 1 credit
   - If no: charge €1.99 via Stripe
3. Update bid: `is_promoted = true`, `promoted_at = now()`
4. Return success

---

### B8. `setup-stripe-connect`

**POST** `/functions/v1/setup-stripe-connect`

Onboard agent to Stripe Connect (receive payments).

**Request:**
```json
{
  "return_url": "techlancer://stripe-return",
  "refresh_url": "techlancer://stripe-refresh"
}
```

**Logic:**
1. Verify caller is an agent
2. Create or retrieve Stripe Connected Account
3. Create Stripe Account Link (onboarding URL)
4. Save `stripe_account_id` to `agent_profiles`
5. Return onboarding URL

**Response:**
```json
{
  "url": "https://connect.stripe.com/setup/...",
  "account_id": "acct_xxx"
}
```

---

### B9. `webhook-stripe`

**POST** `/functions/v1/webhook-stripe` (No JWT required)

Handles Stripe webhook events.

**Events Handled:**
| Event | Action |
| --- | --- |
| `payment_intent.succeeded` | Update payment status |
| `payment_intent.payment_failed` | Mark payment as failed, notify client |
| `account.updated` | Update agent `stripe_onboarded` status |
| `transfer.created` | Update payment `paid_out` status |
| `charge.refunded` | Update payment refund status |

---

### B10. `send-push-notification`

**POST** `/functions/v1/send-push-notification`

Internal function (called by other Edge Functions or triggers).

**Request:**
```json
{
  "user_id": "uuid",
  "title": "New bid received!",
  "body": "Agent João submitted a €80 quote",
  "data": {
    "type": "new_bid",
    "ticket_id": "uuid",
    "bid_id": "uuid"
  }
}
```

**Logic:**
1. Get user's Expo push token from profile
2. Send via Expo Push Notification API
3. Create notification record in `notifications` table

---

### B11. `send-email`

**POST** `/functions/v1/send-email`

Internal function for transactional emails via Resend.

**Email Templates:**
| Template | When |
| --- | --- |
| `welcome` | After registration |
| `bid_received` | New bid on client's ticket |
| `bid_accepted` | Agent's bid was accepted |
| `payment_receipt` | After payment |
| `service_completed` | Service marked as done |
| `review_reminder` | 24h after completion if no review |
| `dispute_opened` | Dispute notification |
| `dispute_resolved` | Dispute resolution |

---

### B12. `verify-agent` (Admin)

**POST** `/functions/v1/verify-agent`

Admin verifies or rejects an agent's verification request.

**Request:**
```json
{
  "agent_id": "uuid",
  "action": "verify" | "reject",
  "note": "All certifications confirmed"
}
```

**Logic:**
1. Verify caller is admin
2. Update `agent_profiles.verification_status`
3. If verified: set `verified_at`
4. Notify agent of result
5. Send email

---

## Part C: Postgres RPC Functions

Stored procedures callable via `supabase.rpc()`.

---

### C1. `get_agent_feed`

Returns tickets matching agent's categories and location.

```sql
CREATE OR REPLACE FUNCTION public.get_agent_feed(
  p_agent_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category_name TEXT,
  category_label TEXT,
  category_icon TEXT,
  urgency TEXT,
  city TEXT,
  is_remote BOOLEAN,
  bid_count INTEGER,
  media_count BIGINT,
  client_name TEXT,
  client_avatar TEXT,
  created_at TIMESTAMPTZ,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, t.title, t.description,
    c.name, c.label_pt, c.icon,
    t.urgency, t.city, t.is_remote,
    t.bid_count,
    (SELECT COUNT(*) FROM ticket_media tm WHERE tm.ticket_id = t.id),
    p.full_name, p.avatar_url,
    t.created_at,
    -- Calculate distance if both have coordinates
    CASE WHEN t.latitude IS NOT NULL AND ap.id IS NOT NULL THEN
      earth_distance(
        ll_to_earth(t.latitude, t.longitude),
        ll_to_earth(
          (SELECT pr.latitude FROM profiles pr WHERE pr.id = p_agent_id),
          (SELECT pr.longitude FROM profiles pr WHERE pr.id = p_agent_id)
        )
      ) / 1000.0
    END
  FROM tickets t
  JOIN categories c ON c.id = t.category_id
  JOIN profiles p ON p.id = t.client_id
  LEFT JOIN agent_profiles ap ON ap.id = p_agent_id
  WHERE t.status IN ('open', 'bidding')
    AND t.category_id IN (
      SELECT category_id FROM agent_categories WHERE agent_id = p_agent_id
    )
    -- Exclude tickets agent already bid on
    AND NOT EXISTS (
      SELECT 1 FROM bids b 
      WHERE b.ticket_id = t.id AND b.agent_id = p_agent_id
    )
  ORDER BY t.urgency = 'urgent' DESC, t.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### C2. `accept_bid`

Atomic bid acceptance (must be transactional).

```sql
CREATE OR REPLACE FUNCTION public.accept_bid(
  p_bid_id UUID,
  p_ticket_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_bid RECORD;
  v_ticket RECORD;
  v_conversation_id UUID;
BEGIN
  -- Lock and verify ticket
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id FOR UPDATE;
  IF v_ticket.client_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_ticket.status NOT IN ('open', 'bidding') THEN
    RAISE EXCEPTION 'Ticket is not accepting bids';
  END IF;
  
  -- Lock and verify bid
  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id AND ticket_id = p_ticket_id FOR UPDATE;
  IF v_bid IS NULL THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;
  IF v_bid.status != 'pending' THEN
    RAISE EXCEPTION 'Bid is not pending';
  END IF;
  
  -- Accept the bid
  UPDATE bids SET status = 'accepted', updated_at = now() WHERE id = p_bid_id;
  
  -- Reject all other bids
  UPDATE bids SET status = 'rejected', updated_at = now()
  WHERE ticket_id = p_ticket_id AND id != p_bid_id AND status = 'pending';
  
  -- Update ticket
  UPDATE tickets SET 
    status = 'accepted',
    accepted_bid_id = p_bid_id,
    accepted_agent_id = v_bid.agent_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = p_ticket_id;
  
  -- Create conversation
  v_conversation_id := gen_random_uuid();
  INSERT INTO conversations (id, ticket_id, client_id, agent_id)
  VALUES (v_conversation_id, p_ticket_id, v_ticket.client_id, v_bid.agent_id);
  
  -- Create system message
  INSERT INTO messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conversation_id, v_ticket.client_id, 
    'Bid accepted! You can now coordinate the service details.', true);
  
  RETURN json_build_object(
    'success', true,
    'conversation_id', v_conversation_id,
    'agent_id', v_bid.agent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### C3. `get_ticket_with_bids`

Returns ticket detail with all bids, optimized for client view.

```sql
CREATE OR REPLACE FUNCTION public.get_ticket_with_bids(p_ticket_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'ticket', row_to_json(t),
    'category', row_to_json(c),
    'media', (
      SELECT json_agg(row_to_json(tm))
      FROM ticket_media tm WHERE tm.ticket_id = t.id
    ),
    'bids', (
      SELECT json_agg(
        json_build_object(
          'id', b.id,
          'amount', b.amount,
          'platform_fee', b.platform_fee,
          'total_price', b.total_price,
          'message', b.message,
          'estimated_days', b.estimated_days,
          'is_promoted', b.is_promoted,
          'status', b.status,
          'created_at', b.created_at,
          'agent', json_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url,
            'city', p.city,
            'avg_rating', ap.avg_rating,
            'total_reviews', ap.total_reviews,
            'total_jobs_completed', ap.total_jobs_completed,
            'verification_status', ap.verification_status
          )
        )
        ORDER BY b.is_promoted DESC, b.created_at ASC
      )
      FROM bids b
      JOIN profiles p ON p.id = b.agent_id
      LEFT JOIN agent_profiles ap ON ap.id = b.agent_id
      WHERE b.ticket_id = t.id AND b.status != 'withdrawn'
    )
  ) INTO v_result
  FROM tickets t
  JOIN categories c ON c.id = t.category_id
  WHERE t.id = p_ticket_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Summary: Complete Endpoint List

### Direct Supabase (RLS-protected, no custom code)

| # | Operation | Table | Method |
| --- | --- | --- | --- |
| 1 | Register | `auth.users` | `signUp()` |
| 2 | Login (email) | `auth.users` | `signInWithPassword()` |
| 3 | Login (OAuth) | `auth.users` | `signInWithOAuth()` |
| 4 | Logout | — | `signOut()` |
| 5 | Get profile | `profiles` | `SELECT` |
| 6 | Update profile | `profiles` | `UPDATE` |
| 7 | Update agent profile | `agent_profiles` | `UPDATE` |
| 8 | Upload avatar | Storage:`avatars` | `upload()` |
| 9 | List categories | `categories` | `SELECT` |
| 10 | Set agent categories | `agent_categories` | `DELETE` + `INSERT` |
| 11 | Create ticket | `tickets` | `INSERT` |
| 12 | Upload ticket media | Storage + `ticket_media` | `upload()` + `INSERT` |
| 13 | Get my tickets | `tickets` | `SELECT` |
| 14 | Get ticket detail | via RPC `get_ticket_with_bids` | `rpc()` |
| 15 | Cancel ticket | `tickets` | `UPDATE` |
| 16 | Delete ticket | `tickets` | `DELETE` |
| 17 | Submit bid | `bids` | `INSERT` |
| 18 | Get my bids | `bids` | `SELECT` |
| 19 | Withdraw bid | `bids` | `UPDATE` |
| 20 | Accept bid | via RPC `accept_bid` | `rpc()` |
| 21 | Get conversations | `conversations` | `SELECT` |
| 22 | Get messages | `messages` | `SELECT` |
| 23 | Send message | `messages` | `INSERT` |
| 24 | Mark conversation read | `conversations` | `UPDATE` |
| 25 | Subscribe to messages | Realtime | `channel.on()` |
| 26 | Submit review | `reviews` | `INSERT` |
| 27 | Get reviews | `reviews` | `SELECT` |
| 28 | Get notifications | `notifications` | `SELECT` |
| 29 | Mark notification read | `notifications` | `UPDATE` |
| 30 | Subscribe to notifications | Realtime | `channel.on()` |

### Edge Functions (Server-side)

| # | Function | Auth | Purpose |
| --- | --- | --- | --- |
| 1 | `accept-bid` | JWT | Atomic bid acceptance + conversation creation |
| 2 | `create-payment-intent` | JWT | Create Stripe escrow payment |
| 3 | `confirm-payment` | JWT | Confirm and capture payment |
| 4 | `complete-service` | JWT | Release escrow to agent |
| 5 | `open-dispute` | JWT | Open a service dispute |
| 6 | `resolve-dispute` | JWT (Admin) | Resolve dispute with refund/release |
| 7 | `promote-bid` | JWT | Pay to highlight a bid |
| 8 | `setup-stripe-connect` | JWT | Onboard agent to Stripe |
| 9 | `webhook-stripe` | Stripe sig | Handle Stripe webhook events |
| 10 | `send-push-notification` | Service key | Send Expo push notification |
| 11 | `send-email` | Service key | Send transactional email |
| 12 | `verify-agent` | JWT (Admin) | Admin verifies agent |

### Postgres RPC Functions

| # | Function | Purpose |
| --- | --- | --- |
| 1 | `get_agent_feed` | Optimized agent ticket feed |
| 2 | `accept_bid` | Atomic bid acceptance |
| 3 | `get_ticket_with_bids` | Ticket detail with bids + agent info |
| 4 | `calculate_platform_fee` | Fee calculation utility |
