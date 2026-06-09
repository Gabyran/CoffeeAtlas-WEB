# Taobao DRAFT Admin Review

## Goal

Handle the current production Taobao sync `DRAFT` records and provide a lightweight admin surface inside the existing `apps/api` Next.js app.

## Decisions

- Current 4 production `roaster_beans` rows with `status = 'DRAFT'` should be physically deleted, not archived.
- Admin UI should be implemented as Next.js `/admin/*` routes in `apps/api`, not as a separate Node/HTML service.
- Admin UI is not part of the miniprogram and must remain behind server-side admin token checks for write APIs.

## Requirements

- Query production Supabase for current `roaster_beans.status = 'DRAFT'` rows before deletion.
- Save a local JSON backup of the rows selected for deletion under the task directory.
- Delete only the confirmed current `DRAFT` rows from production.
- Verify production has no remaining `DRAFT` rows after deletion.
- Keep or complete an API-hosted admin page for roaster bean review at `/admin/roaster-beans`.
- Admin API must support listing, updating, and deleting roaster bean rows.
- Admin write APIs must require `ADMIN_API_TOKEN`.

## Non-goals

- Do not add admin pages to the WeChat miniprogram.
- Do not redesign existing miniprogram UI.
- Do not change Taobao sync classification rules unless required to make the admin flow work.
