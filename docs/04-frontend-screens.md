# TechLancer — Frontend Screens & Navigation

## Overview

The app uses **expo-router v4** with file-based routing. Navigation is split by user role:
- **Client** sees ticket management, bid review, and communication screens
- **Agent** sees a feed of available jobs, bid management, and job tracking
- **Shared** screens are accessible by both roles

---

## 1. Navigation Structure

```
app/
├── _layout.tsx                      # RootLayout: AuthProvider, ThemeProvider, SplashScreen
├── index.tsx                        # EntryPoint: Redirect based on auth + role
│
├── (auth)/                          # Unauthenticated screens (no tabs)
│   ├── _layout.tsx                  # Stack layout (no header or minimal)
│   ├── welcome.tsx                  # Welcome / onboarding carousel
│   ├── login.tsx                    # Email + social login
│   ├── register.tsx                 # Registration with role selection
│   └── forgot-password.tsx          # Password reset
│
├── (client)/                        # Client role screens
│   ├── _layout.tsx                  # Tab layout: Home, My Tickets, Messages, Profile
│   ├── home.tsx                     # Client dashboard (quick actions + recent tickets)
│   ├── create-ticket/               # Multi-step ticket creation
│   │   ├── index.tsx                # Step 1: Category selection
│   │   ├── details.tsx              # Step 2: Title, description, device info
│   │   ├── media.tsx                # Step 3: Photos/video upload
│   │   ├── location.tsx             # Step 4: Location + remote option
│   │   └── review.tsx               # Step 5: Review & submit
│   ├── tickets/
│   │   ├── index.tsx                # My tickets list (tabs: Active, Completed, All)
│   │   └── [id].tsx                 # Ticket detail: info + bids list + accept
│   ├── messages/
│   │   ├── index.tsx                # Conversations list
│   │   └── [conversationId].tsx     # Chat screen
│   ├── review/[ticketId].tsx        # Leave review for agent
│   ├── payment/[ticketId].tsx       # Stripe payment screen
│   └── profile.tsx                  # Client profile & settings
│
├── (agent)/                         # Agent role screens
│   ├── _layout.tsx                  # Tab layout: Feed, My Bids, Messages, Profile
│   ├── feed.tsx                     # Available tickets feed (filterable)
│   ├── ticket/[id].tsx              # Ticket detail + submit bid form
│   ├── bids/
│   │   ├── index.tsx                # My bids (tabs: Pending, Accepted, All)
│   │   └── [id].tsx                 # Bid detail
│   ├── jobs/
│   │   ├── index.tsx                # Active jobs list
│   │   └── [id].tsx                 # Job detail (in-progress ticket)
│   ├── messages/
│   │   ├── index.tsx                # Conversations list
│   │   └── [conversationId].tsx     # Chat screen
│   ├── review/[ticketId].tsx        # Leave review for client
│   ├── earnings.tsx                 # Earnings dashboard
│   ├── stripe-setup.tsx             # Stripe Connect onboarding
│   └── profile.tsx                  # Agent profile (edit public profile)
│
└── (shared)/                        # Shared screens (modal / pushed)
    ├── _layout.tsx                  # Stack layout (modal presentation)
    ├── agent-profile/[id].tsx       # View agent public profile + reviews
    ├── notifications.tsx            # Notifications list
    ├── settings.tsx                 # App settings (language, notifications, etc.)
    └── support.tsx                  # Help & support
```

---

## 2. Screen Details

### 2.1 Auth Screens

#### `(auth)/welcome.tsx` — Onboarding
- App logo + tagline
- 3-step carousel: "Find Help" → "Trusted Agents" → "Secure Payments"
- CTA buttons: "Get Started" / "I already have an account"
- Social login buttons (Google, Apple)

#### `(auth)/login.tsx` — Login
- Email input
- Password input (show/hide toggle)
- "Log In" button
- "Forgot password?" link
- Social login (Google, Apple)
- "Don't have an account? Register" link
- Rate limiting indicator

#### `(auth)/register.tsx` — Registration
- Full name
- Email
- Password + strength indicator + requirements checklist
- Confirm password
- Date of birth (DD/MM/YYYY picker)
- **Role selector**: "I need help" (client) / "I provide services" (agent)
- Terms & conditions checkbox
- "Create Account" button
- Rate limiting

---

### 2.2 Client Screens

#### `(client)/home.tsx` — Client Dashboard
- **Header**: "Hello, {name}" + notification bell (badge)
- **Quick Action Card**: "Open a Ticket" (large CTA)
- **Active Tickets Summary**: Count of open/in-progress tickets
- **Recent Tickets**: Last 3-5 tickets with status badges
- **Pull-to-refresh**

#### `(client)/create-ticket/` — Multi-Step Ticket Creation

**Step 1 — Category** (`index.tsx`):
- Grid of category cards with icons
- Categories: Hardware, Software, Web Dev, Mobile Dev, Networking, CCTV, Data Recovery, IT Consulting, Other
- Selected state highlight

**Step 2 — Details** (`details.tsx`):
- Title (required, max 100 chars)
- Description (required, max 2000 chars)
- Conditional fields based on category:
  - Hardware: Device brand (dropdown), Device model (text)
  - Software: OS, Software name
  - CCTV: Number of cameras, Indoor/Outdoor
- Urgency selector: Low / Normal / Urgent

**Step 3 — Media** (`media.tsx`):
- "Take Photo" button (expo-camera)
- "Choose from Gallery" button (expo-image-picker)
- "Record Video" button (max 30 seconds)
- Media grid preview (up to 5 items)
- Drag to reorder
- Tap to remove

**Step 4 — Location** (`location.tsx`):
- "Use my current location" button (expo-location)
- Manual city input
- Address input (optional)
- Toggle: "This can be done remotely"

**Step 5 — Review** (`review.tsx`):
- Summary of all entered info
- Media thumbnails
- Category badge
- "Submit Ticket" button
- "Edit" links for each section

#### `(client)/tickets/index.tsx` — My Tickets
- **Segment control**: Active / Completed / All
- **Ticket cards** showing:
  - Category icon + label
  - Title (truncated)
  - Status badge (color-coded)
  - Bid count: "3 bids received"
  - Time ago: "2h ago"
  - First media thumbnail
- **Empty state**: "No tickets yet. Create your first one!"
- **Pull-to-refresh** + infinite scroll

#### `(client)/tickets/[id].tsx` — Ticket Detail
- **Ticket info**: Title, description, category, urgency, location
- **Media carousel** (swipeable images/video)
- **Status timeline**: open → bidding → accepted → in_progress → completed
- **Bids section** (if status = bidding):
  - Promoted bids at top (highlighted)
  - Each bid card shows:
    - Agent avatar, name, verified badge
    - Rating (stars) + review count
    - Total jobs completed
    - Bid amount + platform fee + total
    - Estimated days
    - Proposal message (expandable)
    - "Accept Bid" button → confirmation modal
    - "View Profile" link
- **Actions**:
  - Cancel ticket (if open/bidding)
  - Mark as completed (if in_progress) → payment flow
  - Open dispute (if in_progress)
  - Leave review (if completed, not yet reviewed)
  - Go to chat (if accepted/in_progress)

#### `(client)/payment/[ticketId].tsx` — Payment
- Summary: service amount, platform fee, total
- Stripe Payment Sheet (via @stripe/stripe-react-native)
- Card input or saved cards
- "Pay €{total}" button
- Success/failure states
- Receipt summary

#### `(client)/review/[ticketId].tsx` — Leave Review
- Agent info card (avatar, name)
- Star rating (1-5, interactive)
- Comment text area (optional, max 500 chars)
- "Submit Review" button
- "Skip" option

---

### 2.3 Agent Screens

#### `(agent)/feed.tsx` — Ticket Feed
- **Filter bar**: Category filter (multi-select), Urgency filter, Distance slider, Remote toggle
- **Sort**: Newest first / Urgency / Nearest
- **Ticket cards** showing:
  - Category icon + label
  - Title (truncated)
  - Client name + city
  - Urgency badge
  - Distance (if location available)
  - Bid count
  - First media thumbnail
  - "View & Bid" CTA
- **Empty state**: "No tickets matching your categories. Update your profile."
- **Pull-to-refresh** + infinite scroll
- **Realtime**: New tickets appear at top with subtle animation

#### `(agent)/ticket/[id].tsx` — Ticket Detail + Bid
- **Ticket info**: Full details + media carousel
- **Client info**: Name, city (no full address until accepted)
- **Bid form** (bottom sheet or inline):
  - Amount (€) — "What you'll receive"
  - Auto-calculated: Platform fee + Total client pays
  - Proposal message (required, max 1000 chars)
  - Estimated completion days
  - "Promote this bid for €1.99" toggle (or use Pro credits)
  - "Submit Bid" button
- If already bid: show bid status + option to withdraw

#### `(agent)/bids/index.tsx` — My Bids
- **Segment control**: Pending / Accepted / All
- **Bid cards** showing:
  - Ticket title + category
  - Bid amount
  - Status badge
  - Client name
  - Time since submitted
- **Actions per bid**:
  - View ticket
  - Withdraw (if pending)
  - Go to chat (if accepted)

#### `(agent)/jobs/index.tsx` — Active Jobs
- List of in-progress tickets where agent is assigned
- Each card shows:
  - Ticket title + category
  - Client name
  - Days since accepted
  - "Go to Chat" CTA
- **Completed** tab: past jobs with earnings

#### `(agent)/earnings.tsx` — Earnings Dashboard
- **Total earnings** (all time)
- **This month** earnings
- **Pending payouts**
- **Chart**: Monthly earnings (last 6 months)
- **Transaction list**: Individual payouts with dates and amounts
- **Stripe status**: Connected / Setup required
- "Go to Stripe Dashboard" link

#### `(agent)/profile.tsx` — Agent Profile Editor
- Avatar upload
- Full name
- Bio / "About me" (max 500 chars)
- Categories (multi-select from available categories)
- Service area: City list + radius slider
- Phone number
- **Verification section**:
  - Current status badge (Unverified / Pending / Verified)
  - "Request Verification" button (upload certs/portfolio)
- **Subscription section** (Pro):
  - Current plan (Free / Pro)
  - "Upgrade to Pro" CTA
  - Remaining highlight credits
- **Public profile preview** button

---

### 2.4 Shared Screens

#### `messages/index.tsx` — Conversations List (both roles)
- List of active conversations
- Each row shows:
  - Other person's avatar + name
  - Ticket title (context)
  - Last message preview (truncated)
  - Timestamp
  - Unread badge (count)
- Sorted by last message time

#### `messages/[conversationId].tsx` — Chat Screen (both roles)
- **Header**: Other person's name + avatar, ticket title
- **Message list** (FlatList, inverted):
  - Text bubbles (left = other, right = me)
  - System messages (centered, gray)
  - Image messages (tappable to zoom)
  - Timestamps (grouped by day)
- **Input bar**:
  - Text input (auto-expand)
  - "Attach image" button
  - Send button
- **Realtime**: Messages appear instantly via Supabase Realtime
- **Keyboard avoiding view** for proper input positioning

#### `(shared)/agent-profile/[id].tsx` — Public Agent Profile
- Avatar + name + verified badge
- Bio
- Categories (chips)
- Service area
- **Stats**: Rating (stars), Review count, Jobs completed
- **Reviews list**: Recent reviews with star rating + comment + client name
- **CTA** (if viewing from ticket): "View their bid"

#### `(shared)/notifications.tsx` — Notifications
- List of notifications grouped by date
- Types with icons:
  - 🔔 New bid received
  - ✅ Bid accepted
  - 💬 New message
  - ⭐ New review
  - 💰 Payment received
  - ⚠️ Dispute update
- Tap to navigate to relevant screen
- Swipe to dismiss / mark read
- "Mark all as read" action

#### `(shared)/settings.tsx` — Settings
- **Account**: Email, change password
- **Notifications**: Push notification preferences (toggle per type)
- **Language**: PT / EN
- **Privacy**: Delete account
- **About**: App version, terms, privacy policy
- **Logout** button

---

## 3. Component Library

### Shared Components (`components/`)

| Component | Description |
| --- | --- |
| `Button` | Primary, secondary, outline, danger variants |
| `Input` | Text input with label, error, icon support |
| `Card` | Elevated card container |
| `Badge` | Status badges (color + text) |
| `Avatar` | User avatar with fallback initials |
| `StarRating` | Interactive star rating (1-5) |
| `MediaGrid` | Grid of image/video thumbnails |
| `MediaCarousel` | Swipeable full-width media viewer |
| `CategoryChip` | Category tag with icon |
| `TicketCard` | Ticket preview card (used in lists) |
| `BidCard` | Bid preview card with agent info |
| `ConversationRow` | Chat conversation list item |
| `MessageBubble` | Chat message bubble |
| `EmptyState` | Empty list placeholder with icon + text |
| `LoadingSpinner` | Centered loading indicator |
| `ErrorView` | Error state with retry button |
| `BottomSheet` | Reusable bottom sheet (via @gorhom/bottom-sheet) |
| `StepIndicator` | Progress indicator for multi-step flows |
| `PriceBreakdown` | Shows service + fee + total |
| `StatusTimeline` | Vertical timeline for ticket status |
| `VerifiedBadge` | Green checkmark for verified agents |
| `PullToRefresh` | Pull-to-refresh wrapper |
| `InfiniteScroll` | FlatList with pagination loader |

---

## 4. Tab Bar Configuration

### Client Tabs

| Tab | Icon | Screen |
| --- | --- | --- |
| Home | `home` | `(client)/home.tsx` |
| My Tickets | `ticket` | `(client)/tickets/index.tsx` |
| Messages | `message-circle` | `(client)/messages/index.tsx` |
| Profile | `user` | `(client)/profile.tsx` |

### Agent Tabs

| Tab | Icon | Screen |
| --- | --- | --- |
| Feed | `search` | `(agent)/feed.tsx` |
| My Bids | `file-text` | `(agent)/bids/index.tsx` |
| Messages | `message-circle` | `(agent)/messages/index.tsx` |
| Profile | `user` | `(agent)/profile.tsx` |

Both tab bars show **unread message badge** on the Messages tab.

---

## 5. Key UX Patterns

### Role-Based Routing
```typescript
// app/index.tsx — Entry point
export default function Index() {
  const { session, profile } = useAuth();
  
  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (profile?.role === 'agent') return <Redirect href="/(agent)/feed" />;
  return <Redirect href="/(client)/home" />;
}
```

### Optimistic Updates
- Messages appear immediately in chat (before server confirms)
- Bid submission shows "Submitting..." then confirms
- Notifications marked read immediately on tap

### Skeleton Loading
- Ticket lists show skeleton cards while loading
- Profile screens show skeleton layout
- Feed shows animated placeholder cards

### Pull-to-Refresh
- All list screens support pull-to-refresh
- Shows activity indicator in header area

### Haptic Feedback
- `expo-haptics` on: bid submission, payment confirmation, star rating selection, ticket creation

### Safe Areas
- All screens use `react-native-safe-area-context`
- Bottom sheets account for bottom safe area
- Keyboard-aware views for all forms
