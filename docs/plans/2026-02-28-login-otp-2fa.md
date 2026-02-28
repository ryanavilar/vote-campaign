# Login OTP 2FA + User Deactivation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace single-step password login with two-step server-verified login (password then email OTP), add user deactivation, set JWT to 6 hours.

**Architecture:** Server-side verified 2FA — two new API routes handle password verification and OTP verification separately. No session is created until both steps pass. User deactivation uses Supabase's built-in ban system. Middleware's existing `getUser()` check handles session invalidation for banned/deleted users.

**Tech Stack:** Next.js App Router, Supabase Auth (signInWithPassword, signInWithOtp, verifyOtp, admin.updateUserById), @supabase/ssr

---

### Task 1: Create POST /api/auth/login (password verification + OTP send)

**Files:**
- Create: `src/app/api/auth/login/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email dan password wajib diisi" },
      { status: 400 }
    );
  }

  // Create a temporary client to verify password (not the SSR client — we don't want cookies set)
  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Step 1: Verify password
  const { data: signInData, error: signInError } =
    await tempClient.auth.signInWithPassword({ email, password });

  if (signInError) {
    // Check if user is banned
    if (signInError.message.includes("banned") || signInError.message.includes("disabled")) {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan. Hubungi admin." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Email atau password salah." },
      { status: 401 }
    );
  }

  // Immediately sign out — we don't want to persist this session
  await tempClient.auth.signOut();

  // Step 2: Send OTP to email
  const { error: otpError } = await tempClient.auth.signInWithOtp({ email });

  if (otpError) {
    return NextResponse.json(
      { error: "Gagal mengirim kode OTP: " + otpError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Verify file exists and is syntactically correct**

Run: `npx tsc --noEmit src/app/api/auth/login/route.ts 2>&1 || true`

**Step 3: Commit**

```bash
git add src/app/api/auth/login/route.ts
git commit -m "feat: add /api/auth/login for password verification + OTP send"
```

---

### Task 2: Create POST /api/auth/verify-otp (OTP verification + session creation)

**Files:**
- Create: `src/app/api/auth/verify-otp/route.ts`

**Step 1: Create the API route**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, token } = await request.json();

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email dan kode OTP wajib diisi" },
      { status: 400 }
    );
  }

  // Use server client with cookie handling so session persists
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return NextResponse.json(
      { error: "Kode OTP salah atau sudah kadaluarsa." },
      { status: 401 }
    );
  }

  if (!data.session) {
    return NextResponse.json(
      { error: "Gagal membuat sesi. Silakan coba lagi." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/verify-otp/route.ts
git commit -m "feat: add /api/auth/verify-otp for OTP verification + session"
```

---

### Task 3: Create POST /api/auth/resend-otp (resend OTP code)

**Files:**
- Create: `src/app/api/auth/resend-otp/route.ts`

**Step 1: Create the API route**

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json(
      { error: "Email wajib diisi" },
      { status: 400 }
    );
  }

  const tempClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error } = await tempClient.auth.signInWithOtp({ email });

  if (error) {
    return NextResponse.json(
      { error: "Gagal mengirim ulang kode OTP." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/resend-otp/route.ts
git commit -m "feat: add /api/auth/resend-otp for OTP resend"
```

---

### Task 4: Rewrite login page with two-step flow (password → OTP)

**Files:**
- Modify: `src/app/login/page.tsx` (full rewrite)

**Step 1: Rewrite the login page**

Replace the entire file with a two-step login component:

- **State machine:** `step` = `"password"` | `"otp"`
- **Step "password":** Email + password form → calls `/api/auth/login` → on success, set `step = "otp"` and store email
- **Step "otp":** 6 separate digit inputs (auto-focus next on input), resend button with 60s cooldown → calls `/api/auth/verify-otp` → on success, `window.location.href = "/"`
- **UI:** Keep the existing card design, gradient background, logo. Add animated step transition.
- **Resend:** "Kirim ulang kode" button, disabled for 60 seconds after send, calls `/api/auth/resend-otp`
- **Back button:** In OTP step, allow going back to password step
- **Email display:** In OTP step, show masked email like `r***@email.com`

Key state variables:
```typescript
const [step, setStep] = useState<"password" | "otp">("password");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [resendCooldown, setResendCooldown] = useState(0);
```

OTP input: 6 individual `<input>` elements with `maxLength={1}`, auto-advance on input, auto-submit when all 6 filled. Use `inputMode="numeric"`.

Resend cooldown: Start at 60 after OTP is sent. Decrement every second via `setInterval`. Button disabled when > 0.

Mask email function:
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return local[0] + "***@" + domain;
}
```

**Step 2: Build to verify**

Run: `npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: rewrite login page with 2-step password+OTP flow"
```

---

### Task 5: Update middleware to handle banned users explicitly

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Update the user check**

Currently line 32-34:
```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
```

Change the redirect logic (around line 48) to also handle the case where `getUser()` returns an error (banned user):

```typescript
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

// ...existing path allowlist check...

// Redirect to login if not authenticated or banned
if (!user || userError) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
```

**Step 2: Build to verify**

Run: `npx next build`

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "fix: handle banned users in middleware auth check"
```

---

### Task 6: Add deactivate/activate actions to PATCH /api/roles

**Files:**
- Modify: `src/app/api/roles/route.ts` — PATCH handler (line 71-155)

**Step 1: Update PATCH to handle action-based requests**

At the start of the PATCH handler (after line 82 `const body = await request.json()`), add a branch:

```typescript
const body = await request.json();
const { user_id, role, action } = body;

// Handle deactivate/activate actions
if (action === "deactivate" || action === "activate") {
  if (!user_id) {
    return NextResponse.json(
      { error: "user_id wajib diisi" },
      { status: 400 }
    );
  }

  // Prevent self-deactivation
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === user_id) {
    return NextResponse.json(
      { error: "Tidak dapat menonaktifkan akun sendiri" },
      { status: 400 }
    );
  }

  // Admin cannot deactivate super_admin
  if (!isSuperAdmin(currentRole)) {
    const { data: targetUserRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .single();

    if (targetUserRole?.role === "super_admin") {
      return NextResponse.json(
        { error: "Tidak dapat menonaktifkan akun Super Admin" },
        { status: 403 }
      );
    }
  }

  const adminClient = getAdminClient();
  const banDuration = action === "deactivate" ? "876000h" : "none";
  const { error: banError } = await adminClient.auth.admin.updateUserById(
    user_id,
    { ban_duration: banDuration }
  );

  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: action === "deactivate" ? "Akun berhasil dinonaktifkan" : "Akun berhasil diaktifkan kembali",
  });
}

// Existing role change logic below...
```

**Step 2: Commit**

```bash
git add src/app/api/roles/route.ts
git commit -m "feat: add deactivate/activate actions to PATCH /api/roles"
```

---

### Task 7: Include banned_until in GET /api/roles response

**Files:**
- Modify: `src/app/api/roles/route.ts` — GET handler (line 52-61)

**Step 1: Add banned_until to combined user data**

Change the mapping at line 52-61 to include `banned_until`:

```typescript
const combined = (users || []).map((user) => {
  const userRole = (roles || []).find((r) => r.user_id === user.id);
  return {
    user_id: user.id,
    email: user.email || "",
    role: userRole?.role || "viewer",
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    banned_until: user.banned_until || null,
  };
});
```

**Step 2: Commit**

```bash
git add src/app/api/roles/route.ts
git commit -m "feat: include banned_until in GET /api/roles response"
```

---

### Task 8: Add deactivate toggle to Users page

**Files:**
- Modify: `src/app/(dashboard)/admin/users/page.tsx`

**Step 1: Add banned_until to the UserWithRole interface**

```typescript
interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}
```

**Step 2: Add handleToggleActive function**

```typescript
async function handleToggleActive(userId: string, currentlyBanned: boolean) {
  setUpdatingUserId(userId);
  try {
    const response = await fetch("/api/roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        action: currentlyBanned ? "activate" : "deactivate",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Gagal mengubah status akun");
    }

    showToast(data.message, "success");
    await fetchUsers();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal mengubah status akun";
    showToast(message, "error");
  } finally {
    setUpdatingUserId(null);
  }
}
```

**Step 3: Add status indicator and toggle button to each user row**

Helper to check banned status:
```typescript
function isBanned(user: UserWithRole): boolean {
  if (!user.banned_until) return false;
  return new Date(user.banned_until) > new Date();
}
```

In the table row, add a status column showing:
- Active: green "Aktif" badge
- Banned: red "Nonaktif" badge, row has `opacity-60` class

Add a toggle button next to the delete/password buttons:
- Import `Ban` and `ShieldCheck` from lucide-react
- If active → show Ban icon (red) to deactivate
- If banned → show ShieldCheck icon (green) to activate
- Title: "Nonaktifkan akun" / "Aktifkan akun"

**Step 4: Build to verify**

Run: `npx next build`

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/admin/users/page.tsx"
git commit -m "feat: add deactivate/activate toggle to users page"
```

---

### Task 9: Update Supabase JWT expiry to 6 hours

**Step 1: Update JWT expiry via Supabase dashboard**

Go to Supabase dashboard → Authentication → Settings → JWT Expiry → set to `21600` seconds.

This is a manual step that cannot be done via code. The developer must do this in the Supabase project dashboard.

**Step 2: Document the change**

Add a note in the design doc or commit message confirming the setting was changed.

---

### Task 10: Update middleware to allow /api/auth/* routes

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Add /api/auth paths to the allowlist**

The current middleware already allows `/api/` paths (line 39: `request.nextUrl.pathname.startsWith("/api/")`), so `/api/auth/login`, `/api/auth/verify-otp`, and `/api/auth/resend-otp` are already allowed. No change needed.

Verify this is the case and move on.

---

### Task 11: Build, test end-to-end, deploy

**Step 1: Full build**

Run: `npx next build`
Expected: Build succeeds with no errors

**Step 2: Deploy to Vercel**

```bash
vercel --prod
vercel alias set <deployment-url> ikastara-kita-dashboard.vercel.app
```

**Step 3: Manual test checklist**
- [ ] Login with correct password → OTP screen appears
- [ ] Login with wrong password → error message
- [ ] Enter correct OTP → redirected to dashboard
- [ ] Enter wrong OTP → error message
- [ ] Resend OTP works after 60s cooldown
- [ ] Deactivate a user → they get redirected to login
- [ ] Reactivate a user → they can login again
- [ ] Delete a user → their session is invalidated

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: 2FA login (password+OTP), user deactivation, 6h JWT expiry"
```
