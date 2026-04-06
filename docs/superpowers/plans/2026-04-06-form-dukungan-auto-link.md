# Form Dukungan Auto-Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-link form dukungan submissions to alumni records using fuzzy trigram matching with three confidence tiers, an admin review queue on the alumni page, and dashboard exclusion for rejected non-alumni.

**Architecture:** New migration adds `is_non_alumni` column and `pending_alumni_matches` table. The public register endpoint gains a fuzzy-match step after member creation. A new `/api/alumni/review` endpoint handles the review queue. The alumni page gets a collapsible review panel. All dashboard queries filter out `is_non_alumni = true` members.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL with pg_trgm), TypeScript, React

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260406_auto_link_alumni.sql` | Migration: `is_non_alumni` column + `pending_alumni_matches` table + RLS |
| Create | `src/app/api/alumni/review/route.ts` | GET pending matches, POST resolve match |
| Modify | `src/app/api/public/register/route.ts` | Add fuzzy alumni matching after member create/update |
| Modify | `src/app/(dashboard)/admin/alumni/page.tsx` | Add review panel + badge |
| Modify | `src/app/api/alumni/route.ts` | Filter `is_non_alumni` members from stats |
| Modify | `src/app/api/alumni/stats/route.ts` | Filter `is_non_alumni` from linked count |
| Modify | `src/app/(dashboard)/page.tsx` | Filter `is_non_alumni` from dashboard stats |
| Modify | `src/app/(dashboard)/leaderboard/page.tsx` | Filter `is_non_alumni` from leaderboard |
| Modify | `src/app/(dashboard)/anggota/page.tsx` | Filter `is_non_alumni` from member list |
| Modify | `src/app/api/targets/route.ts` | Filter `is_non_alumni` from targets |
| Modify | `src/app/api/assignments/monitor/route.ts` | Filter `is_non_alumni` from monitor |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260406_auto_link_alumni.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add is_non_alumni flag to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_non_alumni BOOLEAN DEFAULT FALSE;

-- Create index for filtering non-alumni
CREATE INDEX IF NOT EXISTS idx_members_is_non_alumni ON members(is_non_alumni) WHERE is_non_alumni = TRUE;

-- Create pending alumni matches table
CREATE TABLE IF NOT EXISTS pending_alumni_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  alumni_id UUID NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  similarity FLOAT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one pending match per member at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_alumni_matches_member
  ON pending_alumni_matches(member_id) WHERE status = 'pending';

-- Fast lookup of pending items
CREATE INDEX IF NOT EXISTS idx_pending_alumni_matches_status
  ON pending_alumni_matches(status) WHERE status = 'pending';

-- RLS policies
ALTER TABLE pending_alumni_matches ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view pending matches
CREATE POLICY "Authenticated users can view pending_alumni_matches"
  ON pending_alumni_matches FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/super_admin can insert (via service role, so this is for safety)
CREATE POLICY "Service role can insert pending_alumni_matches"
  ON pending_alumni_matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admin/super_admin can update (resolve matches)
CREATE POLICY "Admin can update pending_alumni_matches"
  ON pending_alumni_matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260406_auto_link_alumni.sql
git commit -m "feat: add is_non_alumni column and pending_alumni_matches table"
```

---

### Task 2: Alumni Review API Endpoint

**Files:**
- Create: `src/app/api/alumni/review/route.ts`

- [ ] **Step 1: Create the review API route**

```typescript
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserRole, canManageUsers } from "@/lib/roles";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * GET /api/alumni/review — Fetch all pending alumni matches for admin review
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data, error } = await adminClient
      .from("pending_alumni_matches")
      .select(`
        id,
        similarity,
        created_at,
        member:members!member_id(id, nama, angkatan, no_hp),
        alumni:alumni!alumni_id(id, nama, angkatan)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      pending: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pending matches" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alumni/review — Resolve a pending alumni match
 * Body: { match_id, action: "link" | "reject" | "relink", alumni_id? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { match_id, action, alumni_id } = body;

    if (!match_id || !action) {
      return NextResponse.json({ error: "match_id and action required" }, { status: 400 });
    }

    if (!["link", "reject", "relink"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "relink" && !alumni_id) {
      return NextResponse.json({ error: "alumni_id required for relink" }, { status: 400 });
    }

    // Fetch the pending match
    const { data: match, error: matchError } = await adminClient
      .from("pending_alumni_matches")
      .select("id, member_id, alumni_id, status")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "pending") {
      return NextResponse.json({ error: "Match already resolved" }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === "link") {
      // Link member to the matched alumni
      await adminClient
        .from("members")
        .update({ alumni_id: match.alumni_id })
        .eq("id", match.member_id);

      await adminClient
        .from("pending_alumni_matches")
        .update({ status: "linked", reviewed_by: user.id, reviewed_at: now })
        .eq("id", match_id);

    } else if (action === "reject") {
      // Mark member as non-alumni
      await adminClient
        .from("members")
        .update({ is_non_alumni: true })
        .eq("id", match.member_id);

      await adminClient
        .from("pending_alumni_matches")
        .update({ status: "rejected", reviewed_by: user.id, reviewed_at: now })
        .eq("id", match_id);

    } else if (action === "relink") {
      // Link member to a different alumni chosen by admin
      await adminClient
        .from("members")
        .update({ alumni_id })
        .eq("id", match.member_id);

      await adminClient
        .from("pending_alumni_matches")
        .update({ status: "linked", reviewed_by: user.id, reviewed_at: now })
        .eq("id", match_id);
    }

    return NextResponse.json({ success: true, action });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve match" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/alumni/review/route.ts
git commit -m "feat: add /api/alumni/review endpoint for pending match resolution"
```

---

### Task 3: Add Fuzzy Matching to Form Submission

**Files:**
- Modify: `src/app/api/public/register/route.ts`

- [ ] **Step 1: Add alumni fuzzy matching after member create/update**

After the referral handling block (after line 151), and before the event registration block (line 154), add the alumni matching logic. Insert the following code between the referral block and the `// For event registration` comment:

```typescript
    // ── Alumni auto-link via fuzzy matching ──
    // Skip if member already linked to alumni or marked as non-alumni
    const { data: memberCheck } = await supabaseAdmin
      .from("members")
      .select("alumni_id, is_non_alumni")
      .eq("id", memberId)
      .single();

    if (!memberCheck?.alumni_id && !memberCheck?.is_non_alumni) {
      try {
        // Use pg_trgm similarity() for fuzzy name matching within same angkatan
        const { data: alumniMatches } = await supabaseAdmin.rpc("match_alumni_fuzzy", {
          p_nama: nama.trim(),
          p_angkatan: Number(angkatan),
          p_threshold: 0.6,
        });

        if (alumniMatches && alumniMatches.length > 0) {
          const bestMatch = alumniMatches[0];

          if (bestMatch.sim >= 0.9) {
            // High confidence — auto-link
            await supabaseAdmin
              .from("members")
              .update({ alumni_id: bestMatch.id })
              .eq("id", memberId);
          } else {
            // Medium confidence — queue for review
            await supabaseAdmin
              .from("pending_alumni_matches")
              .upsert(
                {
                  member_id: memberId,
                  alumni_id: bestMatch.id,
                  similarity: bestMatch.sim,
                  status: "pending",
                },
                { onConflict: "member_id", ignoreDuplicates: true }
              );
          }
        }
      } catch {
        // Non-fatal — member was still created, matching can happen later
      }
    }
```

- [ ] **Step 2: Create the PostgreSQL RPC function for fuzzy matching**

Add to the migration file `supabase/migrations/20260406_auto_link_alumni.sql` (append):

```sql
-- RPC function for fuzzy alumni matching
CREATE OR REPLACE FUNCTION match_alumni_fuzzy(
  p_nama TEXT,
  p_angkatan INTEGER,
  p_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE(id UUID, nama TEXT, angkatan INTEGER, sim FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.nama,
    a.angkatan,
    similarity(LOWER(TRIM(a.nama)), LOWER(TRIM(p_nama)))::FLOAT AS sim
  FROM alumni a
  WHERE a.angkatan = p_angkatan
    AND similarity(LOWER(TRIM(a.nama)), LOWER(TRIM(p_nama))) >= p_threshold
  ORDER BY sim DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260406_auto_link_alumni.sql src/app/api/public/register/route.ts
git commit -m "feat: add fuzzy alumni matching to form dukungan submission"
```

---

### Task 4: Review Panel on Alumni Page

**Files:**
- Modify: `src/app/(dashboard)/admin/alumni/page.tsx`

- [ ] **Step 1: Add imports and types**

Add `ClipboardCheck` to the lucide-react import list (alongside existing icons).

Add after the existing `AlumniStats` interface (around line 74):

```typescript
interface PendingMatch {
  id: string;
  similarity: number;
  created_at: string;
  member: { id: string; nama: string; angkatan: number; no_hp: string | null };
  alumni: { id: string; nama: string; angkatan: number };
}
```

- [ ] **Step 2: Add review state and handlers**

Add after the `resetAddForm` function and before `handleAddAlumni`:

```typescript
  // Review panel state
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [relinkSearch, setRelinkSearch] = useState("");
  const [relinkResults, setRelinkResults] = useState<{ id: string; nama: string; angkatan: number }[]>([]);
  const [relinkSearchLoading, setRelinkSearchLoading] = useState(false);

  const loadPendingMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/alumni/review");
      if (res.ok) {
        const json = await res.json();
        setPendingMatches(json.pending || []);
      }
    } catch {
      // silent fail
    }
  }, []);

  // Load pending matches on mount
  useEffect(() => {
    if (!canManageUsers || roleLoading) return;
    loadPendingMatches();
  }, [canManageUsers, roleLoading, loadPendingMatches]);

  const handleResolve = async (matchId: string, action: "link" | "reject", alumniId?: string) => {
    setResolvingId(matchId);
    try {
      const res = await fetch("/api/alumni/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: matchId,
          action: alumniId ? "relink" : action,
          alumni_id: alumniId,
        }),
      });
      if (res.ok) {
        const actionLabel = action === "link" ? "dihubungkan" : action === "reject" ? "ditolak" : "dihubungkan";
        showToast(`Alumni berhasil ${actionLabel}`, "success");
        setPendingMatches((prev) => prev.filter((m) => m.id !== matchId));
        setRelinkingId(null);
        setRelinkSearch("");
        setRelinkResults([]);
        if (action === "link" || alumniId) {
          loadData(); // refresh alumni table
        }
      } else {
        const result = await res.json();
        showToast(result.error || "Gagal memproses", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    }
    setResolvingId(null);
  };

  const handleRelinkSearch = async (query: string) => {
    setRelinkSearch(query);
    if (query.length < 2) { setRelinkResults([]); return; }
    setRelinkSearchLoading(true);
    try {
      const res = await fetch(`/api/alumni/search?q=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const json = await res.json();
        setRelinkResults((json.data || []).map((a: { id: string; nama: string; angkatan: number }) => ({
          id: a.id, nama: a.nama, angkatan: a.angkatan,
        })));
      }
    } catch {
      // silent
    }
    setRelinkSearchLoading(false);
  };
```

- [ ] **Step 3: Add review badge in header**

In the header `<div className="flex items-center gap-2">` section, add before the "Tambah Alumni" button:

```tsx
{pendingMatches.length > 0 && (
  <button
    onClick={() => setReviewOpen(!reviewOpen)}
    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
  >
    <ClipboardCheck className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">Review</span>
    <span className="bg-white text-amber-600 text-[10px] font-bold rounded-full w-5 h-5 inline-flex items-center justify-center">
      {pendingMatches.length}
    </span>
  </button>
)}
```

- [ ] **Step 4: Add review panel between stats and table**

In the `<div className="px-4 sm:px-6 py-6 space-y-4">` section, after the stats grid (after closing `</div>` of the grid at line ~695) and before the filters section, add:

```tsx
{/* Review Panel */}
{pendingMatches.length > 0 && reviewOpen && (
  <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
    <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4" />
        Perlu Review ({pendingMatches.length})
      </h3>
      <button onClick={() => setReviewOpen(false)} className="p-1 rounded hover:bg-amber-100 transition-colors">
        <X className="w-4 h-4 text-amber-600" />
      </button>
    </div>
    <div className="divide-y divide-border">
      {pendingMatches.map((match) => (
        <div key={match.id} className="px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Submitted data */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-foreground">{match.member.nama}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">TN{match.member.angkatan}</span>
                {match.member.no_hp && (
                  <span className="text-[10px] text-gray-400 font-mono">{match.member.no_hp}</span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center px-2">
              <span className="text-gray-300">&rarr;</span>
            </div>

            {/* Matched alumni */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <GraduationCap className="w-3.5 h-3.5 text-[#0B27BC] shrink-0" />
                <span className="text-sm font-medium text-[#0B27BC]">{match.alumni.nama}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0B27BC]/10 text-[#0B27BC]">TN{match.alumni.angkatan}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${match.similarity >= 0.8 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {Math.round(match.similarity * 100)}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {relinkingId === match.id ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={relinkSearch}
                      onChange={(e) => handleRelinkSearch(e.target.value)}
                      placeholder="Cari alumni..."
                      className="w-40 px-2 py-1 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0B27BC]/30"
                      autoFocus
                    />
                    {relinkResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 mt-1 w-56 bg-white border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {relinkResults.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => handleResolve(match.id, "link", a.id)}
                            disabled={resolvingId === match.id}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center justify-between"
                          >
                            <span className="font-medium truncate">{a.nama}</span>
                            <span className="text-gray-400 shrink-0 ml-2">TN{a.angkatan}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {relinkSearchLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-gray-400" />
                    )}
                  </div>
                  <button
                    onClick={() => { setRelinkingId(null); setRelinkSearch(""); setRelinkResults([]); }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleResolve(match.id, "link")}
                    disabled={resolvingId === match.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {resolvingId === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Link
                  </button>
                  <button
                    onClick={() => handleResolve(match.id, "reject")}
                    disabled={resolvingId === match.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                    Tolak
                  </button>
                  <button
                    onClick={() => setRelinkingId(match.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors"
                  >
                    <Search className="w-3 h-3" />
                    <span className="hidden sm:inline">Pilih Lain</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/admin/alumni/page.tsx
git commit -m "feat: add review panel for pending alumni matches on alumni page"
```

---

### Task 5: Dashboard Exclusion — Filter is_non_alumni from All Metrics

**Files:**
- Modify: `src/app/(dashboard)/page.tsx:232-237`
- Modify: `src/app/(dashboard)/leaderboard/page.tsx:83-87`
- Modify: `src/app/(dashboard)/anggota/page.tsx:46-50`
- Modify: `src/app/api/alumni/route.ts:54`
- Modify: `src/app/api/alumni/stats/route.ts:18-21`
- Modify: `src/app/api/targets/route.ts` (member fetch)
- Modify: `src/app/api/assignments/monitor/route.ts:61`
- Modify: `src/app/api/members/route.ts:16-19`

- [ ] **Step 1: Dashboard home page — filter members fetch**

In `src/app/(dashboard)/page.tsx`, change the members query (line ~233):

```typescript
// Before:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .order("no", { ascending: true });

// After:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .not("is_non_alumni", "is", true)
  .order("no", { ascending: true });
```

- [ ] **Step 2: Leaderboard page — filter members fetch**

In `src/app/(dashboard)/leaderboard/page.tsx`, add the filter to both member query paths.

For the campaigner path (around line 74, inside the `if (isCampaigner)` block):

```typescript
// Before:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .in("id", memberIds)
  .order("nama", { ascending: true });

// After:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .in("id", memberIds)
  .not("is_non_alumni", "is", true)
  .order("nama", { ascending: true });
```

For the else (admin/everyone) path (around line 83):

```typescript
// Before:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .order("nama", { ascending: true });

// After:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .not("is_non_alumni", "is", true)
  .order("nama", { ascending: true });
```

- [ ] **Step 3: Anggota (members) page — filter members fetch**

In `src/app/(dashboard)/anggota/page.tsx`, change the members query (line ~47):

```typescript
// Before:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .order("no", { ascending: true });

// After:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .not("is_non_alumni", "is", true)
  .order("no", { ascending: true });
```

- [ ] **Step 4: Alumni API — filter members from stats**

In `src/app/api/alumni/route.ts`, change the members fetch (line ~54):

```typescript
// Before:
fetchAllRows(adminClient, "members",
  "id, alumni_id, no, nama, no_hp, pic, status_dpt, sudah_dikontak, vote, dukungan"
),

// After:
fetchAllRows(adminClient, "members",
  "id, alumni_id, no, nama, no_hp, pic, status_dpt, sudah_dikontak, vote, dukungan",
  (q) => q.not("is_non_alumni", "is", true)
),
```

- [ ] **Step 5: Alumni stats API — filter linked member count**

In `src/app/api/alumni/stats/route.ts`, change the linked members query (line ~19):

```typescript
// Before:
adminClient
  .from("members")
  .select("alumni_id")
  .not("alumni_id", "is", null),

// After:
adminClient
  .from("members")
  .select("alumni_id")
  .not("alumni_id", "is", null)
  .not("is_non_alumni", "is", true),
```

- [ ] **Step 6: Targets API — filter members**

In `src/app/api/targets/route.ts`, find the members fetch (where it does `fetchAll(adminClient, "members", ...)`). Add the `is_non_alumni` filter to the `applyFilters` callback:

```typescript
// Add .not("is_non_alumni", "is", true) to the query chain in the members fetch
```

- [ ] **Step 7: Assignments monitor API — filter members**

In `src/app/api/assignments/monitor/route.ts`, change the members fetch (line ~61):

```typescript
// Before:
const members = await fetchAll(adminClient, "members", "id, alumni_id, nama, angkatan, no_hp, status_dpt, sudah_dikontak, vote, dukungan", (q) =>
  q.order("angkatan").order("nama")
);

// After:
const members = await fetchAll(adminClient, "members", "id, alumni_id, nama, angkatan, no_hp, status_dpt, sudah_dikontak, vote, dukungan", (q) =>
  q.not("is_non_alumni", "is", true).order("angkatan").order("nama")
);
```

- [ ] **Step 8: Members API — filter members list**

In `src/app/api/members/route.ts`, change the GET query (line ~16):

```typescript
// Before:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .order("no", { ascending: true });

// After:
const { data, error } = await supabase
  .from("members")
  .select("*")
  .not("is_non_alumni", "is", true)
  .order("no", { ascending: true });
```

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx src/app/\(dashboard\)/leaderboard/page.tsx src/app/\(dashboard\)/anggota/page.tsx src/app/api/alumni/route.ts src/app/api/alumni/stats/route.ts src/app/api/targets/route.ts src/app/api/assignments/monitor/route.ts src/app/api/members/route.ts
git commit -m "feat: exclude is_non_alumni members from all dashboard metrics"
```

---

## Task Order & Dependencies

```
Task 1 (Migration) ──→ Task 2 (Review API) ──→ Task 4 (Review Panel UI)
                   └──→ Task 3 (Form Matching) ──┘
                   └──→ Task 5 (Dashboard Exclusion)
```

Tasks 2, 3, and 5 depend on Task 1 (migration). Task 4 depends on Task 2. Tasks 3 and 5 are independent of each other and can be done in parallel after Task 1.
