# Brand-Shop AI (GHL Embedded)

This monorepo contains a GoHighLevel-embedded product for AI Store Builder, AI Vision, Distributor Dashboards, Order Routing, and Reputation.

## Apps
- `apps/web`: Next.js embedded UI modules
- `apps/api`: Fastify API for webhooks, orchestration, and routing
- `apps/worker`: BullMQ workers for AI Vision and analytics

## Packages
- `packages/db`: Prisma schema and client
- `packages/shared`: Zod schemas and shared types

## Local setup (outline)
1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies with `pnpm install`.
3. Generate Prisma client: `pnpm --filter @app/db generate`.
4. Start services: `pnpm dev`.

## Supabase
If you use Supabase:
- Set `DATABASE_URL` to the Supabase Postgres connection string.
- Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` for AI Vision uploads.

Supabase values are available in:
- Project Settings → API (URL + Service Role Key)
- Project Settings → Database (Connection string)
- Storage → Buckets (bucket name)

## GHL Embedded URLs (Custom Menu)
Use these URLs in GHL custom menu items:
- `https://brand-shop.ai/dashboard`
- `https://brand-shop.ai/store-builder`
- `https://brand-shop.ai/ai-vision`
- `https://brand-shop.ai/order-routing`
- `https://brand-shop.ai/reputation`
- `https://brand-shop.ai/integrations`

## GHL Integration
- Set up GHL webhooks to call `POST /api/webhooks/ghl`.
- Add GHL custom menu items pointing to embedded routes:
  - `/dashboard`
  - `/store-builder`
  - `/ai-vision`
  - `/order-routing`
  - `/reputation`
  - `/integrations`

## DigitalOcean Deployment (Droplet + Docker)
1. Install Docker and Docker Compose on the droplet.
2. Copy `deploy/docker-compose.yml` and `deploy/Caddyfile` to the droplet.
3. Create a `.env` file on the droplet with runtime secrets.
4. Run `docker compose up -d`.

The Caddy proxy expects:
- `brand-shop.ai` -> web service
- `api.brand-shop.ai` -> API service

## GHL Webhook Setup
- Webhook URL: `https://api.brand-shop.ai/api/webhooks/ghl`
- Add header `X-GHL-Webhook-Secret` (matches `GHL_WEBHOOK_SECRET`).
- GHL also supports `X-Wh-Signature` verification with the public key in `apps/api/src/lib/ghlWebhookVerify.ts`.

## Store Builder Trigger (GHL Workflow)
Use a Custom Webhook action pointing to:
`https://api.brand-shop.ai/api/store-builder/trigger`
Body JSON:
```
{
  "locationId": "<location-id>",
  "storeName": "<store name>",
  "clientName": "<client name>",
  "brandVertical": "<vertical>"
}
```
Use GHL merge fields in place of the placeholders.
Add header `X-GHL-Webhook-Secret` or query param `?secret=` to match `GHL_WEBHOOK_SECRET`.

## Bootstrap a Tenant
Call `POST /api/ghl/connect` with:
```
{
  "tenantName": "Brand-Shop AI",
  "locationId": "<GHL location id>",
  "apiKey": "<GHL API key>"
}
```
The response returns `tenantId` for subsequent calls.
