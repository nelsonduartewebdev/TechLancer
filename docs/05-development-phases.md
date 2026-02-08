# TechLancer — Development Phases & Roadmap

## Overview

The MVP is divided into **6 phases**, building from foundations to launch. Each phase produces a working increment. Estimated total: **14-20 weeks** for a solo/small team.

---

## Phase 0: Project Reset & Foundations (Week 1)

### Goal
Clean up the existing codebase, upgrade dependencies, set up the new Supabase schema, and establish the project foundation.

### Tasks

- [ ] **Upgrade Expo SDK 51 → 52** and all dependencies
  - Update `package.json` (expo, react-native, expo-router v4, etc.)
  - Run `npx expo install --fix`
  - Test that the app still builds and runs
- [ ] **Clean up old code**
  - Remove old API endpoints from `lib/api.ts` (players, matches, etc.)
  - Remove references to old backend
  - Keep: `lib/supabase.ts`, `lib/auth.ts`, `lib/validation.ts`, `lib/rateLimiter.ts`, `lib/logger.ts`
- [ ] **Apply TechLancer database migrations** (see `02-database-schema.md`)
  - Create all tables: profiles, agent_profiles, categories, tickets, etc.
  - Create indexes
  - Enable RLS on all tables
  - Create RLS policies
  - Create triggers and functions
  - Seed categories table
- [ ] **Set up Supabase Storage buckets**
  - Create: `avatars`, `ticket-media`, `chat-media`, `agent-portfolios`
  - Configure size limits and allowed MIME types
- [ ] **Install new dependencies**
  - `expo-image-picker`, `expo-camera`, `expo-location`
  - `expo-notifications`, `expo-secure-store`, `expo-haptics`
  - `expo-image`, `expo-av`, `expo-file-system`
  - `react-native-reanimated`, `react-native-gesture-handler`
  - `@gorhom/bottom-sheet`
  - `@stripe/stripe-react-native`
- [ ] **Set up folder structure**
  - Create `app/(auth)/`, `app/(client)/`, `app/(agent)/`, `app/(shared)/`
  - Create `components/` folder
  - Create `lib/` service files (tickets.ts, bids.ts, chat.ts, payments.ts)
  - Create `hooks/` folder (useAuth, useProfile, useTickets, etc.)
  - Create `constants/` folder (colors, categories, config)
  - Create `types/` folder (TypeScript interfaces)
- [ ] **Generate TypeScript types from Supabase**
  - Run `supabase gen types typescript` and save to `types/database.ts`

### Deliverable
✅ Clean project with new schema, all dependencies, and folder structure ready.

---

## Phase 1: Authentication & Profiles (Weeks 2-3)

### Goal
Complete auth flow with role selection, profile management, and agent onboarding.

### Tasks

- [ ] **Auth Provider & Context**
  - Create `AuthProvider` context wrapping the app
  - Manage auth state (session, user, profile, role)
  - Handle token refresh automatically
  - Store session in expo-secure-store
  - Create `useAuth()` hook
- [ ] **Refactor Root Layout** (`app/_layout.tsx`)
  - Wrap with `AuthProvider`, `SafeAreaProvider`
  - Handle splash screen (hide when auth state resolved)
  - Font loading (if custom fonts)
- [ ] **Role-based routing** (`app/index.tsx`)
  - If not authenticated → `/(auth)/welcome`
  - If client → `/(client)/home`
  - If agent → `/(agent)/feed`
- [ ] **Welcome Screen** (`(auth)/welcome.tsx`)
  - "Get Started" → Register
  - "I have an account" → Login
- [ ] **Login Screen** (`(auth)/login.tsx`)
  - Refactor existing login screen
  - Add social login buttons (Google, Apple)
  - Keep rate limiting
  - Proper error handling
- [ ] **Register Screen** (`(auth)/register.tsx`)
  - Refactor existing register screen
  - Add role selection (Client / Agent toggle)
  - Pass role in signUp metadata
  - Trigger creates profile + agent_profiles automatically
  - Keep password strength, validation
- [ ] **Forgot Password Screen** (`(auth)/forgot-password.tsx`)
  - Email input
  - Send reset email via Supabase
  - Success state
- [ ] **Client Profile Screen** (`(client)/profile.tsx`)
  - Display profile info from `profiles` table
  - Edit name, phone, city
  - Avatar upload (expo-image-picker + Supabase Storage)
  - Logout button
- [ ] **Agent Profile Screen** (`(agent)/profile.tsx`)
  - Everything from client profile +
  - Bio editor
  - Category multi-select (from `categories` table)
  - Service area (cities + radius)
  - Verification status display
  - Public profile preview

### Deliverable
✅ Users can register (as client or agent), login, manage their profiles.

---

## Phase 2: Ticket Creation & Management (Weeks 4-6)

### Goal
Clients can create tickets with guided forms, photos/video, and manage them.

### Tasks

- [ ] **Categories Service** (`lib/categories.ts`)
  - Fetch all categories
  - Cache locally
- [ ] **Tickets Service** (`lib/tickets.ts`)
  - Create ticket (with media upload)
  - Get my tickets (with pagination)
  - Get ticket detail (with bids)
  - Cancel ticket
  - Delete ticket
- [ ] **Create Ticket — Category Selection** (`create-ticket/index.tsx`)
  - Grid of category cards with icons
  - Selection state
  - "Next" button
- [ ] **Create Ticket — Details** (`create-ticket/details.tsx`)
  - Title input
  - Description input (multi-line)
  - Category-specific fields (conditional)
  - Urgency selector (segmented control)
- [ ] **Create Ticket — Media** (`create-ticket/media.tsx`)
  - Take photo (expo-image-picker camera)
  - Choose from gallery (expo-image-picker library)
  - Record short video
  - Media grid with previews
  - Remove media
  - Max 5 items
- [ ] **Create Ticket — Location** (`create-ticket/location.tsx`)
  - "Use current location" (expo-location)
  - City text input
  - Address text input
  - "Can be done remotely" toggle
- [ ] **Create Ticket — Review** (`create-ticket/review.tsx`)
  - Summary of all entered data
  - Edit links per section
  - "Submit" → upload media → create ticket → navigate to ticket detail
  - Loading state during submission
- [ ] **My Tickets List** (`tickets/index.tsx`)
  - FlatList with TicketCard components
  - Segment control: Active / Completed / All
  - Pull-to-refresh
  - Infinite scroll pagination
  - Empty state
- [ ] **Ticket Detail** (`tickets/[id].tsx`)
  - Full ticket info display
  - Media carousel (swipeable)
  - Status timeline
  - Bid count display
  - Actions based on status (cancel, view bids, etc.)
- [ ] **Client Dashboard** (`(client)/home.tsx`)
  - Greeting header
  - "Create Ticket" CTA card
  - Active tickets count
  - Recent tickets list (last 5)
  - Notification bell with badge

### Deliverable
✅ Clients can create detailed tickets with photos/video and manage them.

---

## Phase 3: Agent Feed & Bidding (Weeks 7-9)

### Goal
Agents can discover tickets, view details, and submit bids. Clients can view and accept bids.

### Tasks

- [ ] **Bids Service** (`lib/bids.ts`)
  - Submit bid (with fee calculation)
  - Get my bids (agent)
  - Get bids for ticket (client)
  - Withdraw bid
  - Accept bid (via RPC)
- [ ] **Agent Feed** (`(agent)/feed.tsx`)
  - FlatList with TicketCard components
  - Uses `get_agent_feed` RPC function
  - Filter bar: categories, urgency, distance, remote toggle
  - Sort options: newest, urgency, nearest
  - Pull-to-refresh
  - Infinite scroll
  - Realtime: subscribe to new tickets in agent's categories
  - Empty state
- [ ] **Agent Ticket Detail** (`(agent)/ticket/[id].tsx`)
  - Full ticket info + media
  - Client info (name, city)
  - If not yet bid:
    - Bid form (amount, message, estimated days)
    - Fee calculator (show breakdown)
    - "Promote bid" toggle
    - "Submit Bid" button
  - If already bid:
    - Show bid status
    - Withdraw option
- [ ] **My Bids List** (`(agent)/bids/index.tsx`)
  - Segment control: Pending / Accepted / All
  - BidCard components (ticket title, amount, status)
  - Tap to view bid detail / ticket
- [ ] **Client: View Bids on Ticket** (part of `(client)/tickets/[id].tsx`)
  - Bids section (when status = bidding)
  - Promoted bids at top with highlight
  - Each bid: agent avatar, name, verified badge, rating, price breakdown, message
  - "Accept Bid" button → confirmation bottom sheet
  - "View Agent Profile" link
- [ ] **Accept Bid Flow**
  - Confirmation modal: "Accept {agent}'s bid for €{total}?"
  - Call `accept_bid` RPC
  - Auto-creates conversation
  - Navigate to conversation
  - Notify agent (push + in-app)
  - Reject notifications to other bidders
- [ ] **Agent Profile View** (`(shared)/agent-profile/[id].tsx`)
  - Public profile: avatar, name, bio, verified badge
  - Categories, service area
  - Stats: rating, reviews, jobs completed
  - Reviews list
- [ ] **Price Breakdown Component** (`components/PriceBreakdown.tsx`)
  - Service amount
  - Platform fee (15% + €0.70)
  - Total for client
  - Clear visual separation

### Deliverable
✅ Agents can browse tickets, submit bids. Clients can review bids, view agent profiles, and accept a bid.

---

## Phase 4: Chat & Communication (Weeks 10-11)

### Goal
Real-time messaging between client and agent after a bid is accepted.

### Tasks

- [ ] **Chat Service** (`lib/chat.ts`)
  - Get conversations
  - Get messages (paginated)
  - Send message
  - Send image message
  - Mark conversation as read
  - Subscribe to new messages (Realtime)
  - Subscribe to conversation updates (Realtime)
- [ ] **Conversations List** (`messages/index.tsx`) — shared for both roles
  - ConversationRow components
  - Other person's avatar + name
  - Ticket title (context)
  - Last message preview
  - Unread badge
  - Sorted by last message
  - Realtime: update when new messages arrive
- [ ] **Chat Screen** (`messages/[conversationId].tsx`)
  - FlatList (inverted) of messages
  - MessageBubble component (left/right alignment)
  - System messages (centered, different style)
  - Image messages (tappable to view full)
  - Day separators
  - Auto-scroll to bottom on new messages
  - **Input bar**:
    - Auto-expanding text input
    - Attach image button (expo-image-picker)
    - Send button
  - Keyboard-aware view
  - Pull to load older messages
  - Realtime subscription (Supabase Realtime)
  - Mark as read on open
- [ ] **Notification Badge on Tab Bar**
  - Total unread conversations count
  - Update in real-time
- [ ] **Push Notifications for Messages**
  - Register Expo push token on login
  - Store token in `profiles` table
  - Edge Function sends push when message received (if app backgrounded)

### Deliverable
✅ Client and agent can chat in real-time after bid acceptance.

---

## Phase 5: Payments, Completion & Reviews (Weeks 12-15)

### Goal
Implement the escrow payment flow, service completion, and mutual reviews.

### Tasks

- [ ] **Stripe Setup**
  - Create Stripe account
  - Set up Stripe Connect (for agent payouts)
  - Install `@stripe/stripe-react-native` in the app
  - Configure Stripe publishable key
- [ ] **Stripe Connect Onboarding** (`(agent)/stripe-setup.tsx`)
  - Edge Function: `setup-stripe-connect`
  - Agent fills Stripe onboarding (redirect to Stripe)
  - Return to app → update `stripe_onboarded` status
  - Show onboarding status in agent profile
- [ ] **Payment Edge Functions**
  - `create-payment-intent`: Create Stripe PI with escrow (manual capture)
  - `confirm-payment`: Capture authorized payment
  - `complete-service`: Release escrow → transfer to agent
  - `webhook-stripe`: Handle Stripe events
- [ ] **Payment Screen** (`(client)/payment/[ticketId].tsx`)
  - Price breakdown summary
  - Stripe Payment Sheet integration
  - Card input (or saved cards)
  - "Pay €{total}" button
  - Loading state
  - Success → navigate to ticket (now in_progress)
  - Failure → error message + retry
- [ ] **Service Completion Flow**
  - Client taps "Mark as Completed" on ticket detail
  - Confirmation: "Are you satisfied with the service?"
  - Calls `complete-service` Edge Function
  - Escrow released to agent
  - Ticket status → `completed`
  - Both parties prompted to review
- [ ] **Dispute Flow**
  - "Report Issue" button on active ticket
  - Reason selection + description
  - Calls `open-dispute` Edge Function
  - Ticket status → `disputed`
  - Notify admin team
- [ ] **Reviews System**
  - Review screen (`review/[ticketId].tsx`)
  - Star rating (1-5) with haptic feedback
  - Optional comment
  - Submit → trigger updates `agent_profiles.avg_rating`
  - Show review prompt in notifications after completion
- [ ] **Earnings Dashboard** (`(agent)/earnings.tsx`)
  - Total earnings, monthly earnings, pending
  - Transaction list
  - Stripe Connect status
  - Link to Stripe dashboard

### Deliverable
✅ Full payment cycle: escrow → service → release. Mutual reviews. Agent earnings tracking.

---

## Phase 6: Notifications, Polish & Launch (Weeks 16-18)

### Goal
Push notifications, polishing UX, testing, and preparing for store submission.

### Tasks

- [ ] **Push Notifications**
  - Register for push permissions (expo-notifications)
  - Store Expo push tokens in profile
  - Edge Function to send push via Expo Push API
  - Notification types: new bid, bid accepted, new message, payment, review, dispute
  - Deep linking: tap notification → navigate to relevant screen
- [ ] **In-App Notifications** (`(shared)/notifications.tsx`)
  - Notifications list screen
  - Read/unread states
  - Tap to navigate
  - Mark all as read
  - Realtime subscription
- [ ] **Email Notifications** (Edge Functions via Resend)
  - Welcome email
  - Bid received (daily digest option)
  - Bid accepted
  - Payment receipt
  - Service completed
  - Review reminder (24h after completion)
- [ ] **Settings Screen** (`(shared)/settings.tsx`)
  - Notification preferences
  - Language toggle (PT/EN)
  - Change password
  - Delete account
  - About, Terms, Privacy
  - Logout
- [ ] **UX Polish**
  - Skeleton loading screens
  - Smooth transitions (reanimated)
  - Haptic feedback on key actions
  - Error boundaries
  - Offline state handling
  - Empty states for all lists
  - Pull-to-refresh everywhere
- [ ] **Testing**
  - Test all flows end-to-end
  - Test edge cases (empty states, errors, offline)
  - Test on both iOS Simulator and Android Emulator
  - Test Stripe payment flow (test mode)
  - Test Realtime chat
  - Test push notifications
- [ ] **Performance**
  - Optimize FlatList rendering (keyExtractor, getItemLayout)
  - Image caching with expo-image
  - Minimize re-renders (React.memo, useMemo)
  - Database query optimization
- [ ] **App Store Preparation**
  - App icon and splash screen design
  - App Store screenshots
  - App description and keywords
  - Privacy policy URL
  - EAS Build configuration
  - Submit to App Store and Play Store

### Deliverable
✅ Production-ready app submitted to app stores.

---

## Timeline Summary

| Phase | Focus | Duration | Cumulative |
| --- | --- | --- | --- |
| 0 | Foundations & Schema | 1 week | Week 1 |
| 1 | Auth & Profiles | 2 weeks | Week 3 |
| 2 | Tickets & Media | 3 weeks | Week 6 |
| 3 | Feed & Bidding | 3 weeks | Week 9 |
| 4 | Chat & Communication | 2 weeks | Week 11 |
| 5 | Payments & Reviews | 4 weeks | Week 15 |
| 6 | Notifications & Launch | 3 weeks | Week 18 |

**Total MVP estimate: 16-20 weeks** (solo developer)
**With 2 developers: 10-14 weeks**

---

## Dependencies Between Phases

```
Phase 0 (Foundations)
  └─→ Phase 1 (Auth)
        └─→ Phase 2 (Tickets)  ──→  Phase 3 (Bidding)
                                        └─→ Phase 4 (Chat)
                                              └─→ Phase 5 (Payments)
                                                    └─→ Phase 6 (Polish)
```

Each phase builds on the previous. However, some work can be parallelized:
- Phase 2 (Tickets UI) and Phase 3 (Feed UI) can overlap if DB is ready
- Phase 4 (Chat) and Phase 5 (Payments) can be developed in parallel by two devs
- Phase 6 (Polish) can start partially during Phase 5
