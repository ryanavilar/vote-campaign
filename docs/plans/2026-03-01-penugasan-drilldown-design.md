# Penugasan Drill-Down Design

## Context
The admin Penugasan page (`/admin/assignments`) currently shows Tim Sukses ranking cards with aggregate stats but no way to see individual targets. Admin/super_admin need to drill down into each Tim Sukses's work.

## Approach
Reuse `GET /api/targets` with admin impersonation (`?user_id=xyz`).

### Backend
- Add `?user_id=xyz` query param to `GET /api/targets`
- If caller is admin/super_admin, fetch targets for `user_id` instead of authenticated user
- Non-admin callers always get their own targets (param ignored)

### Frontend
- Click a Tim Sukses card header -> expand inline below card
- Fetch `GET /api/targets?user_id={campaigner_id}` on expand
- Render same editable target table as Target Saya page (phone edit, status chips, dukungan dropdown)
- Click card header again to collapse
- Loading spinner while fetching
- Only one card expanded at a time (optional: allow multiple)

## Files Modified
- `src/app/api/targets/route.ts` — add `user_id` param + admin auth check
- `src/app/(dashboard)/admin/assignments/page.tsx` — expandable cards + inline target table

## Files NOT Changed
- Target page, member detail page, alumni page — no changes needed
