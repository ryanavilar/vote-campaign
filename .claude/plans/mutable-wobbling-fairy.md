# Onboarding Page + Edit User / Change Password

## Context

Two features requested:
1. **Onboarding page** — When a user accepts an email invite from Supabase, they land on the site with a token. They need a page to set their password and complete setup.
2. **Edit user & change password** — Admins should be able to reset/change a user's password and edit user details from the user management page.

Currently there is NO auth callback route — the invite email link has nowhere to land. We need the full flow: callback route (token exchange) → onboarding page (set password).

---

## Part 1: Auth Callback Route

**New file:** `src/app/auth/callback/route.ts`

This is a **Route Handler** (server-side) that handles the redirect from Supabase invite/recovery emails.

Supabase invite emails redirect to `{SITE_URL}/auth/callback?code=...` (when using PKCE flow) or with a hash fragment `#access_token=...&type=invite` (implicit flow).

For the PKCE flow (recommended with `@supabase/ssr`):
- Extract `code` from query params
- Call `supabase.auth.exchangeCodeForSession(code)`
- Check token type — if it's an invite/recovery, redirect to `/onboarding`
- Otherwise redirect to `/`

Also need to update middleware to allow `/auth/callback` and `/onboarding` as public routes.

**Modify:** `src/middleware.ts`
- Add `/auth/callback` and `/onboarding` to the public route list

**Update Supabase redirect config:**
- The invite email from `auth.admin.inviteUserByEmail()` will redirect to `{SITE_URL}` by default
- We need to configure the site URL in Supabase dashboard to point to `https://ikastara-kita-dashboard.vercel.app` and set the redirect URL to `/auth/callback`

---

## Part 2: Onboarding Page

**New file:** `src/app/onboarding/page.tsx`

A client-side page matching the app's pink/blue brand design where invited users:
1. See a welcome message ("Selamat Datang di Ikastara Kita")
2. Set their password (new password + confirm password)
3. Submit → calls `supabase.auth.updateUser({ password })`
4. On success → redirect to `/` (dashboard)

Design:
- Same pink background as the login page gradient
- Ikastara Kita logo
- Card with password fields + submit button
- Password visibility toggles
- Minimum 6 character validation (matching Supabase config)

---

## Part 3: Admin Change Password API

**New file:** `src/app/api/roles/reset-password/route.ts`

POST endpoint:
- Accepts `user_id` and `new_password`
- Checks `canManageUsers` permission
- Uses `adminClient.auth.admin.updateUserById(user_id, { password: new_password })`
- Returns success

---

## Part 4: Edit User Modal in Admin Page

**Modify:** `src/app/(dashboard)/admin/users/page.tsx`

Add an "Edit" button per user row that opens an inline form/modal with:
- Display email (read-only)
- Change password field (new password input)
- Save button → calls `POST /api/roles/reset-password`
- Toast feedback on success/error

---

## Files Summary

| File | Action |
|------|--------|
| `src/app/auth/callback/route.ts` | **New** — token exchange route |
| `src/app/onboarding/page.tsx` | **New** — set password page |
| `src/middleware.ts` | Add `/auth/callback` and `/onboarding` to public routes |
| `src/app/api/roles/reset-password/route.ts` | **New** — admin change password endpoint |
| `src/app/(dashboard)/admin/users/page.tsx` | Add edit button + password change form |

## Verification

1. `npm run build` — no errors
2. Invite a user via admin page → check email → click invite link → lands on onboarding → set password → redirected to dashboard
3. Admin > Users → click edit on a user → change password → verify login with new password
4. Deploy via `vercel --prod`
