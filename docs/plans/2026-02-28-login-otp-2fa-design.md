# Login OTP 2FA + User Deactivation Design

## Overview

Replace single-step password login with two-step server-side verified login (password then email OTP). Add user deactivation feature. Set JWT expiry to 6 hours.

## Login Flow

### Step 1: Password verification

- User enters email + password on login page
- Client calls `POST /api/auth/login` with `{ email, password }`
- Server creates temp Supabase client, calls `signInWithPassword` to verify credentials
- If valid, immediately signs out (no session persisted to client)
- Server calls `signInWithOtp({ email })` to send 6-digit code via Supabase email
- Returns `{ success: true }` — no tokens returned

### Step 2: OTP verification

- Login page transitions to OTP input (6-digit code, 60s resend cooldown)
- User enters code from email
- Client calls `POST /api/auth/verify-otp` with `{ email, token }`
- Server creates Supabase server client with cookie handling
- Calls `verifyOtp({ email, token, type: 'email' })`
- Session cookies are set server-side
- Returns success → client redirects to `/`

### Error handling

- Wrong password → "Email atau password salah"
- Banned/deactivated user → "Akun Anda telah dinonaktifkan"
- Wrong OTP → "Kode OTP salah atau sudah kadaluarsa"
- OTP expired → user can click "Kirim ulang" (60s cooldown)

## JWT Expiry

- Set Supabase JWT expiry to 21600 seconds (6 hours)
- Configure via Supabase dashboard: Authentication → Settings → JWT Expiry

## Session Invalidation

- Middleware calls `getUser()` on every request (already implemented)
- Deleted users: `getUser()` returns null → redirect to `/login`
- Banned users: `getUser()` returns error → redirect to `/login`
- Any existing JWT is immediately invalid when user is deleted/deactivated

## User Deactivation

### API

- `PATCH /api/roles` with `{ user_id, action: 'deactivate' }` → calls `admin.updateUserById(id, { ban_duration: '876000h' })`
- `PATCH /api/roles` with `{ user_id, action: 'activate' }` → calls `admin.updateUserById(id, { ban_duration: 'none' })`
- Distinguished from role change by presence of `action` field
- `GET /api/roles` includes `banned_until` in response

### UI (Users page)

- Toggle button per user: Aktif (green) / Nonaktif (red)
- Deactivated users show "Nonaktif" badge, grayed-out row
- Permission: admin can't deactivate super_admin

## Files

### New files
- `src/app/api/auth/login/route.ts` — Password verification + OTP send
- `src/app/api/auth/verify-otp/route.ts` — OTP verification + session creation

### Modified files
- `src/app/login/page.tsx` — Two-step UI (password → OTP)
- `src/app/api/roles/route.ts` — Add deactivate/activate, include banned_until in GET
- `src/app/(dashboard)/admin/users/page.tsx` — Deactivate toggle, status display
