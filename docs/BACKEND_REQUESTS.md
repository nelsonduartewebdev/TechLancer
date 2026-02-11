# Backend API – What it has now vs what we need to change

## What it has now

- **GET /api/tickets/** – Exists. App sends query params: `search`, `status`, `category_id`, `urgency`, `is_remote`, `page`.
- **GET /api/tickets/:id** – Exists. App fetches one ticket by id.
- **POST /api/tickets/** – Exists. App sends body: `title`, `description`, `category_id` (and optionally `location_id`, `device_brand`, `device_model`, `urgency`, `is_remote`).
- All requests are sent with `Authorization: Bearer <token>`.

(We don’t know yet: whether GET list is filtered by current user, what status values are used, or the exact response shape.)

---

## What we need to change

**GET /api/tickets/**
- For **client** users: return only tickets created by the current user (e.g. filter by `client_id` or `created_by`).
- Support **query param `status`**: `open` (active tab) and `closed` (history tab). If the backend uses different values (e.g. `pending`, `completed`), either use `open`/`closed` or tell us the mapping.
- Support **query param `search`** (optional): filter by title/description.
- **Response**: the app accepts any of: raw array `[...]`, or `{ tickets: [...] }`, or `{ data: [...] }`. Each ticket must have: `id`, `title`, `description`, `status`, `created_at`, and either `category` (e.g. `{ name, label_pt, label_en }`) or `category_id`.

**GET /api/tickets/:id**
- For **client** users: return 403 (or 404) if the ticket is not owned by the current user.

**POST /api/tickets/**
- Create the ticket for the **authenticated user** as the client/owner. Set initial status to something the app will treat as “open” (e.g. `open`). Return the created ticket (with `id`, etc.).
- **Location**: Accept either `location_id` (UUID; copy city/address/lat/lng from that location into the ticket) or inline `city`, `address`, `latitude`, `longitude`. Optionally accept `location_id` for audit when inline is used.

---

## Locations API (required for location picker)

- **GET /api/locations/** — List the authenticated user's saved locations. Response: array of `{ id, label, address, city, country, latitude, longitude, postal_code, created_at }`.
- **POST /api/locations/** — Create a location. Body: `label` (required), `address`, `city` (required), `country`, `latitude`, `longitude`, `postal_code`. Return created location.
- **PATCH /api/locations/:id** — Update a location (user's own only). Body: same fields as create (partial OK).
- **DELETE /api/locations/:id** — Delete a location (user's own only). Return 204 or empty JSON.

---

## Optional (not blocking)

- **GET /api/categories** – If we stop using Supabase for categories: return `[{ id, name, label_pt, label_en }]`.
- **Ticket photos** – Way to upload and attach up to 5 images per ticket.
- **GET /api/tickets/counts** – e.g. `?status=open` and `?status=closed` returning counts for the tabs.
