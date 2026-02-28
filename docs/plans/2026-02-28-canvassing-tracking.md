# Canvassing Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement angkatan-based auto-assignment of alumni targets to Tim Sukses with a redesigned Target page that tracks the full canvassing flowchart (Kontak → Dukungan → Grup → DPT → Vote).

**Architecture:** New `campaigner_angkatan` junction table links campaigners to batch years. Target page queries alumni by angkatan with LEFT JOIN to members. Status updates create member records lazily and use optimistic UI with single-field PATCH calls.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + Auth), TypeScript, Tailwind CSS v4, lucide-react icons

---

### Task 1: Database Migration — Create `campaigner_angkatan` table + add `dukungan` column

**Files:**
- Create: `src/app/api/seed/canvassing-migration/route.ts`

**Step 1: Create the migration API route**

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Create campaigner_angkatan table
  const { error: tableError } = await adminClient.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS campaigner_angkatan (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        angkatan INTEGER NOT NULL CHECK (angkatan >= 1 AND angkatan <= 35),
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, angkatan)
      );
    `,
  });

  // Add dukungan column to members
  const { error: colError } = await adminClient.rpc("exec_sql", {
    sql: `
      ALTER TABLE members ADD COLUMN IF NOT EXISTS dukungan TEXT;
    `,
  });

  // Disable RLS (using service role key for all access)
  const { error: rlsError } = await adminClient.rpc("exec_sql", {
    sql: `
      ALTER TABLE campaigner_angkatan ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "Service role full access" ON campaigner_angkatan
        FOR ALL USING (true) WITH CHECK (true);
    `,
  });

  return NextResponse.json({
    success: !tableError && !colError,
    tableError: tableError?.message || null,
    colError: colError?.message || null,
    rlsError: rlsError?.message || null,
  });
}
```

NOTE: If the project doesn't have an `exec_sql` RPC function, run the SQL directly in Supabase dashboard instead:

```sql
-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS campaigner_angkatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  angkatan INTEGER NOT NULL CHECK (angkatan >= 1 AND angkatan <= 35),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, angkatan)
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS dukungan TEXT;
```

**Step 2: Run migration**

Call `POST /api/seed/canvassing-migration` or execute SQL in Supabase dashboard.

**Step 3: Commit**

```bash
git add src/app/api/seed/canvassing-migration/route.ts
git commit -m "feat: add campaigner_angkatan table and dukungan column migration"
```

---

### Task 2: Update `Member` type + add `dukungan` to allowed PATCH fields

**Files:**
- Modify: `src/lib/types.ts` (line 3-21)
- Modify: `src/app/api/members/[id]/route.ts` (line 54-63)

**Step 1: Add `dukungan` to Member interface**

In `src/lib/types.ts`, add after line 16 (`vote: StatusValue;`):

```typescript
  dukungan: string | null;
```

So the Member interface becomes:
```typescript
export interface Member {
  id: string;
  no: number;
  nama: string;
  angkatan: number;
  no_hp: string;
  pic: string | null;
  email: string | null;
  domisili: string | null;
  harapan: string | null;
  status_dpt: StatusValue;
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
  dukungan: string | null;
  referred_by: string | null;
  referral_name: string | null;
  assigned_to: string | null;
  alumni_id: string | null;
}
```

**Step 2: Add `dukungan` to allowed PATCH fields**

In `src/app/api/members/[id]/route.ts`, update the `allowedFields` array (line 54-63):

```typescript
  const allowedFields = [
    "no_hp",
    "pic",
    "status_dpt",
    "sudah_dikontak",
    "masuk_grup",
    "vote",
    "dukungan",
    "referral_name",
    "alumni_id",
  ];
```

**Step 3: Commit**

```bash
git add src/lib/types.ts "src/app/api/members/[id]/route.ts"
git commit -m "feat: add dukungan field to Member type and PATCH allowed fields"
```

---

### Task 3: Update `GET /api/roles` to include angkatan assignments

**Files:**
- Modify: `src/app/api/roles/route.ts` (GET handler, lines 13-69)

**Step 1: Fetch angkatan assignments and include in response**

After fetching roles (line 27) and before the `adminClient` usage, add a query to `campaigner_angkatan`. Then include in the combined response.

Replace the GET handler's `combined` mapping (lines 51-62) with:

```typescript
  // Fetch angkatan assignments for all campaigners
  const { data: angkatanData } = await adminClient
    .from("campaigner_angkatan")
    .select("user_id, angkatan");

  // Group angkatan by user_id
  const angkatanMap: Record<string, number[]> = {};
  for (const row of angkatanData || []) {
    if (!angkatanMap[row.user_id]) angkatanMap[row.user_id] = [];
    angkatanMap[row.user_id].push(row.angkatan);
  }

  // Combine users with their roles, ban status, and angkatan
  const combined = (users || []).map((user) => {
    const userRole = (roles || []).find((r) => r.user_id === user.id);
    return {
      user_id: user.id,
      email: user.email || "",
      role: userRole?.role || "viewer",
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      banned_until: user.banned_until || null,
      angkatan: angkatanMap[user.id] || [],
    };
  });
```

**Step 2: Add `set_angkatan` action to PATCH handler**

In the PATCH handler, after the `deactivate`/`activate` block (after line 131) and before the `if (!role)` check, add:

```typescript
  // Handle set_angkatan action
  if (action === "set_angkatan") {
    const { angkatan } = body; // number[]
    if (!Array.isArray(angkatan)) {
      return NextResponse.json(
        { error: "angkatan harus berupa array" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // Delete existing angkatan assignments
    await adminClient
      .from("campaigner_angkatan")
      .delete()
      .eq("user_id", user_id);

    // Insert new assignments
    if (angkatan.length > 0) {
      const rows = angkatan.map((a: number) => ({
        user_id: user_id,
        angkatan: a,
      }));
      const { error } = await adminClient
        .from("campaigner_angkatan")
        .insert(rows);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, angkatan });
  }
```

**Step 3: Commit**

```bash
git add src/app/api/roles/route.ts
git commit -m "feat: add angkatan data to roles API and set_angkatan action"
```

---

### Task 4: Add angkatan assignment UI to Admin Users page

**Files:**
- Modify: `src/app/(dashboard)/admin/users/page.tsx`

**Step 1: Update UserWithRole interface**

Add `angkatan` field:

```typescript
interface UserWithRole {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  angkatan: number[];
}
```

**Step 2: Add angkatan state and handler**

Add state after the existing state declarations:

```typescript
  // Angkatan assignment state
  const [angkatanUserId, setAngkatanUserId] = useState<string | null>(null);
  const [angkatanLoading, setAngkatanLoading] = useState(false);
```

Add handler function after `handleToggleActive`:

```typescript
  async function handleSetAngkatan(userId: string, angkatan: number[]) {
    setAngkatanLoading(true);
    try {
      const response = await fetch("/api/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          action: "set_angkatan",
          angkatan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mengatur angkatan");
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === userId ? { ...u, angkatan } : u
        )
      );
      showToast("Angkatan berhasil diatur", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengatur angkatan";
      showToast(message, "error");
    } finally {
      setAngkatanLoading(false);
    }
  }
```

**Step 3: Add angkatan UI in the table**

For each row where `user.role === "campaigner"`, show angkatan chips below the email. Add a expandable row (like the password change row) that shows a multi-select grid of angkatan numbers (1-35) as small toggleable buttons.

In the email `<td>`, after the "Nonaktif" badge, add:

```tsx
{user.role === "campaigner" && user.angkatan.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {user.angkatan.sort((a, b) => a - b).map((a) => (
      <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC] font-medium">
        TN{a}
      </span>
    ))}
  </div>
)}
```

In the actions column, add a button (GraduationCap icon) that toggles the angkatan assignment row. Only show for campaigner users. Import `GraduationCap` from lucide-react.

The expandable row shows a grid of 35 small numbered buttons (1-35). Clicking a number toggles it. A "Simpan" button saves the selection.

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/admin/users/page.tsx"
git commit -m "feat: add angkatan assignment UI for campaigners on Users page"
```

---

### Task 5: Rewrite `GET /api/targets` for angkatan-based query

**Files:**
- Modify: `src/app/api/targets/route.ts` (GET handler, lines 41-94)

**Step 1: Rewrite GET handler**

Replace the existing GET handler with angkatan-based querying:

```typescript
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = getAdminClient();

  // 1. Get user's assigned angkatan(s)
  const { data: angkatanRows, error: angError } = await adminClient
    .from("campaigner_angkatan")
    .select("angkatan")
    .eq("user_id", user.id);

  if (angError) {
    return NextResponse.json({ error: angError.message }, { status: 500 });
  }

  const angkatanList = (angkatanRows || []).map((r) => r.angkatan);

  if (angkatanList.length === 0) {
    // Fallback: try legacy campaigner_targets
    const { data: targets } = await adminClient
      .from("campaigner_targets")
      .select("member_id")
      .eq("user_id", user.id);

    if (!targets || targets.length === 0) {
      return NextResponse.json([]);
    }

    const memberIds = targets.map((t) => t.member_id);
    const members = await fetchAll(adminClient, "members", "*", (q) =>
      q.in("id", memberIds).order("no", { ascending: true })
    );
    return NextResponse.json(members);
  }

  // 2. Fetch alumni for those angkatans
  let alumni;
  try {
    alumni = await fetchAll(adminClient, "alumni", "id, nama, angkatan, nosis, kelanjutan_studi, program_studi, keterangan", (q) =>
      q.in("angkatan", angkatanList).order("angkatan").order("nama")
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alumni" },
      { status: 500 }
    );
  }

  // 3. Get all alumni_ids, fetch linked members
  const alumniIds = alumni.map((a) => a.id);

  let members: Record<string, any> = {};
  if (alumniIds.length > 0) {
    try {
      const memberRows = await fetchAll(adminClient, "members", "*", (q) =>
        q.in("alumni_id", alumniIds)
      );
      for (const m of memberRows) {
        if (m.alumni_id) members[m.alumni_id] = m;
      }
    } catch {
      // Continue without member data
    }
  }

  // 4. Combine: alumni with their member data (if exists)
  const combined = alumni.map((a) => {
    const member = members[a.id];
    return {
      // Alumni fields (always present)
      alumni_id: a.id,
      alumni_nama: a.nama,
      alumni_angkatan: a.angkatan,
      alumni_nosis: a.nosis,
      alumni_kelanjutan_studi: a.kelanjutan_studi,
      // Member fields (null if no member record yet)
      member_id: member?.id || null,
      no: member?.no || null,
      nama: member?.nama || a.nama,
      angkatan: member?.angkatan || a.angkatan,
      no_hp: member?.no_hp || "",
      status_dpt: member?.status_dpt || null,
      sudah_dikontak: member?.sudah_dikontak || null,
      masuk_grup: member?.masuk_grup || null,
      vote: member?.vote || null,
      dukungan: member?.dukungan || null,
    };
  });

  return NextResponse.json(combined);
}
```

**Step 2: Add POST handler for auto-creating members**

Add a new POST action `ensure_member` that creates a member for an alumni if one doesn't exist:

In the existing POST handler, add support for a `{ alumni_id, field, value }` body that:
1. Checks if alumni has a member → creates if not
2. Updates the specified field on the member
3. Returns the updated member

Actually — modify the POST handler to accept an additional pattern. When `field` and `value` are provided alongside `alumni_id`, it auto-creates the member AND applies the update in one call:

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { alumni_id, field, value } = body;

  if (!alumni_id) {
    return NextResponse.json(
      { error: "alumni_id wajib diisi" },
      { status: 400 }
    );
  }

  const adminClient = getAdminClient();

  // Check if alumni exists
  const { data: alumni, error: alumniError } = await adminClient
    .from("alumni")
    .select("id, nama, angkatan")
    .eq("id", alumni_id)
    .single();

  if (alumniError || !alumni) {
    return NextResponse.json(
      { error: "Alumni tidak ditemukan" },
      { status: 404 }
    );
  }

  // Check if alumni already has a linked member
  const { data: existingMember } = await adminClient
    .from("members")
    .select("id, nama")
    .eq("alumni_id", alumni_id)
    .maybeSingle();

  let memberId: string;

  if (existingMember) {
    memberId = existingMember.id;
  } else {
    // Create new member from alumni data
    const { data: maxNoRow } = await adminClient
      .from("members")
      .select("no")
      .order("no", { ascending: false })
      .limit(1)
      .single();

    const nextNo = (maxNoRow?.no || 0) + 1;

    const insertData: Record<string, unknown> = {
      no: nextNo,
      nama: alumni.nama,
      angkatan: alumni.angkatan,
      no_hp: "",
      alumni_id: alumni.id,
      status_dpt: null,
      sudah_dikontak: null,
      masuk_grup: null,
      vote: null,
      dukungan: null,
    };

    // If field + value provided, apply to insert directly
    if (field && field !== "no_hp") {
      insertData[field] = value;
    } else if (field === "no_hp" && value) {
      insertData.no_hp = value;
    }

    const { data: newMember, error: insertError } = await adminClient
      .from("members")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    memberId = newMember.id;

    // Audit log
    await logMemberAudit(adminClient, {
      memberId,
      userId: user.id,
      userEmail: user.email || null,
      field: "member",
      oldValue: null,
      newValue: `${alumni.nama} (TN${alumni.angkatan})`,
      action: "create",
    });

    // If field was applied during insert, audit that too
    if (field && value !== null && value !== undefined) {
      await logMemberAudit(adminClient, {
        memberId,
        userId: user.id,
        userEmail: user.email || null,
        field,
        oldValue: null,
        newValue: String(value),
        action: "update",
      });
    }

    // Fetch full member data
    const { data: fullMember } = await adminClient
      .from("members")
      .select("*")
      .eq("id", memberId)
      .single();

    return NextResponse.json({
      member_id: memberId,
      action: "created",
      member: fullMember,
    }, { status: 201 });
  }

  // If member exists and field+value provided, update it
  if (field && value !== undefined) {
    const { data: updated, error: updateError } = await adminClient
      .from("members")
      .update({ [field]: value })
      .eq("id", memberId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      member_id: memberId,
      action: "updated",
      member: updated,
    });
  }

  // Legacy: just return member info
  const { data: fullMember } = await adminClient
    .from("members")
    .select("*")
    .eq("id", memberId)
    .single();

  return NextResponse.json({
    member_id: memberId,
    action: "existing",
    member: fullMember,
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/targets/route.ts
git commit -m "feat: rewrite targets API for angkatan-based queries with lazy member creation"
```

---

### Task 6: Rewrite Target page UI with canvassing tracking

**Files:**
- Modify: `src/app/(dashboard)/target/page.tsx` (full rewrite)

This is the largest task. The Target page gets completely rewritten with:

**Key interface:**
```typescript
interface TargetRow {
  alumni_id: string;
  alumni_nama: string;
  alumni_angkatan: number;
  alumni_nosis: string | null;
  alumni_kelanjutan_studi: string | null;
  member_id: string | null;
  no: number | null;
  nama: string;
  angkatan: number;
  no_hp: string;
  status_dpt: StatusValue;
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
  dukungan: string | null;
}
```

**Header stats (6 cards):**
- Total Alumni (from targets length)
- Sudah Kontak (sudah_dikontak === "Sudah")
- Dukung (dukungan === "dukung")
- Ragu-ragu (dukungan === "ragu_ragu")
- Milih Sebelah (dukungan === "milih_sebelah")
- Masuk Grup (masuk_grup === "Sudah")

**Filter bar:**
- Search by name
- Filter by angkatan (dropdown from user's assigned angkatans)
- Filter by status field

**Table columns:**
1. `#` — row number
2. `Nama` — name + angkatan badge
3. `No HP` — inline editable, click to edit, auto-save on blur/Enter with 500ms debounce
4. `Kontak` — chip toggle: Sudah (green) / Belum (gray). Tap to cycle.
5. `Dukungan` — chip cycle: — / Dukung (green) / Ragu (yellow) / Milih Sebelah (red) / Terkonvert (blue)
6. `Grup` — chip toggle: Sudah (green) / Belum (gray)
7. `DPT` — chip toggle: Sudah (green) / Belum (gray)
8. `Vote` — chip toggle: Sudah (green) / Belum (gray)

**Status chip component (inline):**

For binary fields (Kontak, Grup, DPT, Vote):
```tsx
function StatusChip({ value, onClick }: { value: StatusValue; onClick: () => void }) {
  const isSudah = value === "Sudah";
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
        isSudah
          ? "bg-emerald-100 text-emerald-700"
          : "bg-gray-100 text-gray-500"
      }`}
    >
      {isSudah ? "Sudah" : "Belum"}
    </button>
  );
}
```

For dukungan field:
```tsx
const DUKUNGAN_OPTIONS = [null, "dukung", "ragu_ragu", "milih_sebelah", "terkonvert"] as const;
const DUKUNGAN_STYLES: Record<string, string> = {
  dukung: "bg-emerald-100 text-emerald-700",
  ragu_ragu: "bg-yellow-100 text-yellow-700",
  milih_sebelah: "bg-red-100 text-red-700",
  terkonvert: "bg-blue-100 text-blue-700",
};
const DUKUNGAN_LABELS: Record<string, string> = {
  dukung: "Dukung",
  ragu_ragu: "Ragu",
  milih_sebelah: "Sebelah",
  terkonvert: "Convert",
};
```

**Update handler:**

```typescript
const handleFieldUpdate = useCallback(
  async (row: TargetRow, field: string, value: string | null) => {
    // Optimistic update
    setTargets((prev) =>
      prev.map((t) =>
        t.alumni_id === row.alumni_id ? { ...t, [field]: value } : t
      )
    );

    if (row.member_id) {
      // Member exists — PATCH directly
      try {
        const res = await fetch(`/api/members/${row.member_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (!res.ok) {
          fetchTargets(); // Revert on error
          showToast("Gagal mengupdate", "error");
        }
      } catch {
        fetchTargets();
        showToast("Gagal mengupdate", "error");
      }
    } else {
      // No member yet — POST to create + update
      try {
        const res = await fetch("/api/targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alumni_id: row.alumni_id,
            field,
            value,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // Update row with new member_id
          setTargets((prev) =>
            prev.map((t) =>
              t.alumni_id === row.alumni_id
                ? { ...t, member_id: data.member_id, ...data.member }
                : t
            )
          );
        } else {
          fetchTargets();
          showToast("Gagal membuat data anggota", "error");
        }
      } catch {
        fetchTargets();
        showToast("Gagal membuat data anggota", "error");
      }
    }
  },
  [fetchTargets, showToast]
);
```

**Phone inline edit:**

```tsx
function InlinePhoneEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const save = () => {
    if (draft !== value) {
      onSave(draft);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="text-xs text-left w-full px-2 py-1 rounded hover:bg-gray-50 transition-colors min-w-[100px]"
      >
        {value || <span className="text-gray-300 italic">Tambah HP</span>}
      </button>
    );
  }

  return (
    <input
      type="tel"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && save()}
      autoFocus
      className="text-xs w-full px-2 py-1 border border-[#0B27BC] rounded focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30 min-w-[100px]"
      placeholder="08xxxxxxxxxx"
    />
  );
}
```

**Mobile responsive:** On mobile (<md), show a card layout instead of table. Each card shows name, phone (editable), and status chips in a compact grid.

**Step 1: Implement the full page rewrite**

The page should:
1. Fetch from `GET /api/targets` (which now returns the combined alumni+member data)
2. Calculate stats from the data
3. Render the table with all interactive elements
4. Handle updates via `handleFieldUpdate`

**Step 2: Verify it builds**

Run: `npx next build`
Expected: Build succeeds with no TypeScript errors.

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/target/page.tsx"
git commit -m "feat: rewrite Target page with canvassing tracking UI"
```

---

### Task 7: Build, Deploy, and Verify

**Step 1: Build**

Run: `npx next build`
Expected: Build succeeds with no errors.

**Step 2: Deploy to Vercel**

```bash
vercel --prod
vercel alias <deployment-url> ikastara-kita-dashboard.vercel.app
```

**Step 3: Run the database migration**

Either:
- Call `POST /api/seed/canvassing-migration` from the deployed app
- Or run the SQL directly in Supabase dashboard

**Step 4: Test manually**

1. Log in as admin → go to Users page → assign angkatan to a Tim Sukses user
2. Log in as that Tim Sukses → go to Target page → verify alumni list appears
3. Click phone field → type number → verify auto-save
4. Click status chips → verify toggle/cycle works
5. Verify stats update in real-time

**Step 5: Final commit and push**

```bash
git push origin main
```
