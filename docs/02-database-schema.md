# TechLancer — Database Schema (Supabase / PostgreSQL)

## Overview

All tables live in the `public` schema. Supabase Auth manages `auth.users` automatically.
Every table has **RLS enabled** and appropriate policies.

---

## 1. profiles

Extends `auth.users`. Created automatically via trigger on signup.

```sql
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  phone         TEXT,
  date_of_birth DATE,
  role          TEXT NOT NULL CHECK (role IN ('client', 'agent')),
  is_active     BOOLEAN DEFAULT true,
  
  -- Location
  city          TEXT,
  country       TEXT DEFAULT 'PT',
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  
  -- Metadata
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: Users can read any profile (public for agent discovery)
- `INSERT`: Only via trigger (on auth.user creation)
- `UPDATE`: Users can only update their own profile
- `DELETE`: Users can only delete their own profile

---

## 2. agent_profiles

Extra info for users with `role = 'agent'`. One-to-one with `profiles`.

```sql
CREATE TABLE public.agent_profiles (
  id                  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio                 TEXT,
  
  -- Verification
  verification_status TEXT DEFAULT 'unverified' 
                      CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  verified_at         TIMESTAMPTZ,
  
  -- Service area
  service_radius_km   INTEGER DEFAULT 50,
  service_cities      TEXT[],            -- Array of city names
  
  -- Subscription
  subscription_tier   TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_expires_at TIMESTAMPTZ,
  highlight_credits   INTEGER DEFAULT 0,
  
  -- Stats (denormalized for performance)
  avg_rating          NUMERIC(3,2) DEFAULT 0,
  total_reviews       INTEGER DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  total_earnings      NUMERIC(10,2) DEFAULT 0,
  
  -- Stripe Connect
  stripe_account_id   TEXT,              -- Stripe Connected Account ID
  stripe_onboarded    BOOLEAN DEFAULT false,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- `SELECT`: Anyone can read (agent profiles are public)
- `INSERT`: Only the agent themselves
- `UPDATE`: Only the agent themselves
- `DELETE`: Only the agent themselves

---

## 3. categories

Pre-defined service categories.

```sql
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,       -- e.g. 'hardware_repair'
  label_pt    TEXT NOT NULL,              -- 'Reparação de Hardware'
  label_en    TEXT NOT NULL,              -- 'Hardware Repair'
  icon        TEXT,                       -- Icon name or emoji
  description TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Seed Data:**

| name | label_pt | label_en |
| --- | --- | --- |
| `hardware_repair` | Reparação de Hardware | Hardware Repair |
| `software_support` | Suporte de Software | Software Support |
| `web_development` | Desenvolvimento Web | Web Development |
| `mobile_development` | Desenvolvimento Mobile | Mobile Development |
| `networking` | Redes e Wi-Fi | Networking & Wi-Fi |
| `cctv` | Videovigilância | Video Surveillance (CCTV) |
| `data_recovery` | Recuperação de Dados | Data Recovery |
| `it_consulting` | Consultoria IT | IT Consulting |
| `other` | Outros | Other |

**RLS Policies:**
- `SELECT`: Anyone can read categories
- `INSERT/UPDATE/DELETE`: Only admins (via service_role key)

---

## 4. agent_categories

Many-to-many: which agents serve which categories.

```sql
CREATE TABLE public.agent_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agent_id, category_id)
);
```

**RLS Policies:**
- `SELECT`: Anyone can read (for discovery)
- `INSERT/DELETE`: Only the agent themselves

---

## 5. locations

User-saved places (Home, Office, or custom). Used when creating tickets.

```sql
CREATE TABLE public.locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,             -- 'home', 'office', or custom display name
  address       TEXT,
  city          TEXT NOT NULL,
  country       TEXT DEFAULT 'PT',
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  postal_code   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_locations_user_id ON public.locations(user_id);
```

**RLS Policies:**
- `SELECT`: Users can only read their own locations
- `INSERT`: Users can only insert for themselves (user_id = auth.uid())
- `UPDATE`: Users can only update their own locations
- `DELETE`: Users can only delete their own locations

---

## 6. tickets

Service requests created by clients.

```sql
CREATE TABLE public.tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES public.categories(id),
  
  -- Ticket info
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  
  -- Guided form fields (optional, depends on category)
  device_brand    TEXT,                 -- e.g. 'Apple', 'Dell', 'Samsung'
  device_model    TEXT,                 -- e.g. 'MacBook Pro 2023'
  urgency         TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'urgent')),
  
  -- Location (denormalized from locations or inline)
  location_id     UUID REFERENCES public.locations(id),  -- Optional audit: which saved location was used
  city            TEXT,
  address         TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  is_remote       BOOLEAN DEFAULT false, -- Can be done remotely
  
  -- Status flow: open → bidding → accepted → in_progress → completed → reviewed
  --              open → cancelled (by client)
  --              in_progress → disputed
  status          TEXT DEFAULT 'open' CHECK (status IN (
                    'open', 'bidding', 'accepted', 'in_progress',
                    'completed', 'reviewed', 'cancelled', 'disputed'
                  )),
  
  -- After a bid is accepted
  accepted_bid_id UUID,                 -- FK added after bids table
  accepted_agent_id UUID REFERENCES public.profiles(id),
  accepted_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  
  -- Counts (denormalized)
  bid_count       INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_tickets_client_id ON public.tickets(client_id);
CREATE INDEX idx_tickets_category_id ON public.tickets(category_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_status_category ON public.tickets(status, category_id);
CREATE INDEX idx_tickets_location ON public.tickets(city);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);
```

**RLS Policies:**
- `SELECT (client)`: Own tickets
- `SELECT (agent)`: Tickets with status `open` or `bidding` (feed), or tickets where agent has bid/is assigned
- `INSERT`: Only clients
- `UPDATE`: Client can update own tickets (status: cancel). Agent can update assigned tickets (status: complete)
- `DELETE`: Client can delete own ticket if status is `open`

---

## 7. ticket_media

Photos and videos attached to tickets.

```sql
CREATE TABLE public.ticket_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id),
  
  storage_path TEXT NOT NULL,            -- Path in Supabase Storage
  media_type   TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  file_name    TEXT,
  file_size    INTEGER,                  -- bytes
  mime_type    TEXT,
  
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ticket_media_ticket_id ON public.ticket_media(ticket_id);
```

**Storage Bucket:** `ticket-media`
- Max file size: 10MB (images), 50MB (videos)
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`

**RLS Policies:**
- `SELECT`: Anyone who can see the ticket
- `INSERT`: Only the ticket creator
- `DELETE`: Only the ticket creator

---

## 8. bids

Agent quotes/proposals on tickets.

```sql
CREATE TABLE public.bids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Pricing
  amount          NUMERIC(10,2) NOT NULL,  -- Agent's price (what they receive)
  platform_fee    NUMERIC(10,2),           -- Calculated: amount * 0.15 + 0.70
  total_price     NUMERIC(10,2),           -- What client pays: amount + platform_fee
  currency        TEXT DEFAULT 'EUR',
  
  -- Proposal
  message         TEXT NOT NULL,            -- Agent's pitch / proposal
  estimated_days  INTEGER,                  -- Estimated completion time in days
  
  -- Promotion
  is_promoted     BOOLEAN DEFAULT false,    -- Paid highlight
  promoted_at     TIMESTAMPTZ,
  
  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN (
                    'pending', 'accepted', 'rejected', 'withdrawn'
                  )),
  
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ticket_id, agent_id)  -- One bid per agent per ticket
);

-- Add FK from tickets to bids (circular reference)
ALTER TABLE public.tickets 
  ADD CONSTRAINT fk_tickets_accepted_bid 
  FOREIGN KEY (accepted_bid_id) REFERENCES public.bids(id);

CREATE INDEX idx_bids_ticket_id ON public.bids(ticket_id);
CREATE INDEX idx_bids_agent_id ON public.bids(agent_id);
CREATE INDEX idx_bids_status ON public.bids(status);
```

**RLS Policies:**
- `SELECT (client)`: Bids on own tickets
- `SELECT (agent)`: Own bids only
- `INSERT`: Only agents, only on tickets with status `open` or `bidding`
- `UPDATE`: Agent can withdraw own bid. Client can accept/reject bids on own tickets
- `DELETE`: Agent can delete own pending bid

---

## 9. conversations

Chat channels between client and agent (created when bid is accepted).

```sql
CREATE TABLE public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES public.tickets(id),
  client_id       UUID NOT NULL REFERENCES public.profiles(id),
  agent_id        UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Unread counts
  client_unread   INTEGER DEFAULT 0,
  agent_unread    INTEGER DEFAULT 0,
  
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ticket_id)  -- One conversation per ticket
);

CREATE INDEX idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX idx_conversations_agent_id ON public.conversations(agent_id);
```

**RLS Policies:**
- `SELECT`: Only participants (client_id or agent_id matches auth.uid())
- `INSERT`: System only (via trigger when bid is accepted)
- `UPDATE`: Only participants (for marking as read)

---

## 10. messages

Individual chat messages.

```sql
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id),
  
  content         TEXT,                    -- Text message
  media_url       TEXT,                    -- Optional image/file attachment
  media_type      TEXT CHECK (media_type IN ('image', 'file', NULL)),
  
  is_read         BOOLEAN DEFAULT false,
  is_system       BOOLEAN DEFAULT false,   -- System messages (bid accepted, etc.)
  
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
```

**RLS Policies:**
- `SELECT`: Only conversation participants
- `INSERT`: Only conversation participants
- No `UPDATE` or `DELETE` (messages are immutable)

---

## 11. payments

Escrow payment tracking (Stripe integration).

```sql
CREATE TABLE public.payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID NOT NULL REFERENCES public.tickets(id),
  bid_id                UUID NOT NULL REFERENCES public.bids(id),
  client_id             UUID NOT NULL REFERENCES public.profiles(id),
  agent_id              UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Amounts
  service_amount        NUMERIC(10,2) NOT NULL,  -- What agent receives
  platform_fee          NUMERIC(10,2) NOT NULL,  -- Platform commission
  total_amount          NUMERIC(10,2) NOT NULL,  -- What client paid
  currency              TEXT DEFAULT 'EUR',
  
  -- Stripe references
  stripe_payment_intent_id  TEXT UNIQUE,
  stripe_charge_id          TEXT,
  stripe_transfer_id        TEXT,          -- Transfer to agent's connected account
  stripe_refund_id          TEXT,
  
  -- Status flow: pending → held → released → paid_out
  --              pending → failed
  --              held → refunded (dispute)
  status                TEXT DEFAULT 'pending' CHECK (status IN (
                          'pending', 'held', 'released', 'paid_out',
                          'failed', 'refunded', 'partially_refunded'
                        )),
  
  held_at               TIMESTAMPTZ,       -- When payment was captured
  released_at           TIMESTAMPTZ,       -- When escrow was released
  paid_out_at           TIMESTAMPTZ,       -- When agent received funds
  
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_ticket_id ON public.payments(ticket_id);
CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_payments_agent_id ON public.payments(agent_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_stripe_pi ON public.payments(stripe_payment_intent_id);
```

**RLS Policies:**
- `SELECT`: Only involved parties (client_id or agent_id)
- `INSERT`: Only via Edge Function (service_role)
- `UPDATE`: Only via Edge Function (service_role)

---

## 12. reviews

Mutual ratings after service completion.

```sql
CREATE TABLE public.reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES public.tickets(id),
  reviewer_id   UUID NOT NULL REFERENCES public.profiles(id),
  reviewee_id   UUID NOT NULL REFERENCES public.profiles(id),
  
  rating        INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       TEXT,
  
  -- Who reviewed whom
  review_type   TEXT NOT NULL CHECK (review_type IN ('client_to_agent', 'agent_to_client')),
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  
  -- One review per direction per ticket
  UNIQUE(ticket_id, reviewer_id, review_type)
);

CREATE INDEX idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX idx_reviews_ticket_id ON public.reviews(ticket_id);
```

**RLS Policies:**
- `SELECT`: Anyone can read reviews (public for trust)
- `INSERT`: Only transaction participants, only after ticket is `completed`
- No `UPDATE` or `DELETE` (reviews are permanent)

---

## 13. notifications

In-app notification log.

```sql
CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  type          TEXT NOT NULL,             -- 'new_bid', 'bid_accepted', 'new_message', etc.
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  
  -- Reference to related entity
  ref_type      TEXT,                      -- 'ticket', 'bid', 'conversation', 'review'
  ref_id        UUID,
  
  is_read       BOOLEAN DEFAULT false,
  
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);
```

**RLS Policies:**
- `SELECT`: Only own notifications
- `UPDATE`: Only own notifications (marking as read)
- `DELETE`: Only own notifications

---

## 14. disputes

For handling service disagreements.

```sql
CREATE TABLE public.disputes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES public.tickets(id),
  payment_id    UUID NOT NULL REFERENCES public.payments(id),
  opened_by     UUID NOT NULL REFERENCES public.profiles(id),
  
  reason        TEXT NOT NULL,
  description   TEXT NOT NULL,
  
  -- Resolution
  status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'escalated')),
  resolution    TEXT,                      -- Admin's resolution note
  resolved_by   UUID REFERENCES public.profiles(id),
  resolved_at   TIMESTAMPTZ,
  
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_disputes_ticket_id ON public.disputes(ticket_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);
```

**RLS Policies:**
- `SELECT`: Only involved parties + admins
- `INSERT`: Only involved parties
- `UPDATE`: Only admins (resolution)

---

## Entity Relationship Diagram

```
auth.users (Supabase managed)
    │
    └──< profiles (1:1)
           │
           ├──< locations (user saved places)
           ├──< agent_profiles (1:1, if role='agent')
           │       │
           │       └──< agent_categories >── categories
           │
           ├──< tickets (client creates)
           │       │
           │       ├──< ticket_media
           │       ├──< bids (agents submit)
           │       ├──  conversations (1:1 after accept)
           │       │       │
           │       │       └──< messages
           │       ├──< payments
           │       ├──< reviews
           │       └──< disputes
           │
           ├──< bids (agent submits)
           ├──< reviews (as reviewer or reviewee)
           └──< notifications
```

---

## Storage Buckets

| Bucket | Purpose | Max Size | Public |
| --- | --- | --- | --- |
| `avatars` | Profile pictures | 5MB | Yes |
| `ticket-media` | Ticket photos/videos | 50MB | No (auth required) |
| `chat-media` | Chat image attachments | 10MB | No (auth required) |
| `agent-portfolios` | Agent work samples | 20MB | Yes |

---

## Database Functions & Triggers

### Trigger: Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  
  -- If agent, also create agent_profiles row
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'agent' THEN
    INSERT INTO public.agent_profiles (id) VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Trigger: Update bid count on ticket

```sql
CREATE OR REPLACE FUNCTION public.update_ticket_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tickets
  SET bid_count = (
    SELECT COUNT(*) FROM public.bids 
    WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
    AND status != 'withdrawn'
  ),
  status = CASE 
    WHEN (SELECT COUNT(*) FROM public.bids 
          WHERE ticket_id = COALESCE(NEW.ticket_id, OLD.ticket_id)
          AND status != 'withdrawn') > 0 
    AND (SELECT status FROM public.tickets WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id)) = 'open'
    THEN 'bidding'
    ELSE (SELECT status FROM public.tickets WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id))
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Trigger: Update agent avg_rating on new review

```sql
CREATE OR REPLACE FUNCTION public.update_agent_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.review_type = 'client_to_agent' THEN
    UPDATE public.agent_profiles
    SET 
      avg_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2) 
        FROM public.reviews 
        WHERE reviewee_id = NEW.reviewee_id 
        AND review_type = 'client_to_agent'
      ),
      total_reviews = (
        SELECT COUNT(*) 
        FROM public.reviews 
        WHERE reviewee_id = NEW.reviewee_id 
        AND review_type = 'client_to_agent'
      ),
      updated_at = now()
    WHERE id = NEW.reviewee_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Calculate platform fee

```sql
CREATE OR REPLACE FUNCTION public.calculate_platform_fee(service_amount NUMERIC)
RETURNS TABLE(platform_fee NUMERIC, total_price NUMERIC) AS $$
BEGIN
  -- 15% commission + €0.70 fixed fee
  platform_fee := ROUND(service_amount * 0.15 + 0.70, 2);
  total_price := service_amount + platform_fee;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```
