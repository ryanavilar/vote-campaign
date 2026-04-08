# Dashboard Batch Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tabbed dashboard with per-batch funnel progress cards, horizontal chart layout, and batch detail modal.

**Architecture:** New API endpoint `/api/alumni/stats/per-batch` aggregates alumni/member/wa-group data per angkatan. Dashboard page gets tab state switching between existing Overview (with layout tweaks) and new BatchProgressTab component. Three new components: BatchProgressTab, BatchCard, BatchDetailModal.

**Tech Stack:** Next.js, React, Recharts, Supabase, Tailwind CSS, Lucide icons

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/alumni/stats/per-batch/route.ts` | API: per-batch stats aggregation |
| Create | `src/components/BatchProgressTab.tsx` | Summary stats + card grid + modal orchestration |
| Create | `src/components/BatchCard.tsx` | Single batch funnel card |
| Create | `src/components/BatchDetailModal.tsx` | Modal with enlarged funnel + Tim Sukses |
| Modify | `src/app/(dashboard)/page.tsx` | Add tabs, horizontal chart, full-width layout |

---

### Task 1: Create per-batch stats API

**Files:**
- Create: `src/app/api/alumni/stats/per-batch/route.ts`

This API returns funnel stats for every angkatan in the alumni table, merged with member progress data and campaigner assignments.

- [ ] **Step 1: Create the API route file**

```typescript
// src/app/api/alumni/stats/per-batch/route.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T = any>(
  client: SupabaseClient,
  table: string,
  select: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let from = 0;
  while (true) {
    let q = client.from(table).select(select).range(from, from + PAGE - 1);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function GET() {
  const adminClient = getAdminClient();

  try {
    // Parallel fetch: alumni angkatan counts, members, wa_group, campaigner assignments
    const [alumniRows, memberRows, waRows, campaignerRows] = await Promise.all([
      fetchAll(adminClient, "alumni", "angkatan"),
      fetchAll(adminClient, "members",
        "angkatan, no_hp, sudah_dikontak, dukungan, status_dpt, vote, id",
        (q) => q.not("is_non_alumni", "is", true)
      ),
      fetchAll(adminClient, "wa_group_members", "member_id", (q) =>
        q.not("member_id", "is", null)
      ),
      fetchAll(adminClient, "campaigner_angkatan", "user_id, angkatan"),
    ]);

    // Get user emails for campaigners
    const campaignerUserIds = [...new Set(campaignerRows.map((r: { user_id: string }) => r.user_id))];
    const userEmailMap: Record<string, string> = {};
    if (campaignerUserIds.length > 0) {
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      for (const u of users || []) {
        userEmailMap[u.id] = u.email || u.id;
      }
    }

    // Build alumni count per angkatan
    const alumniByAngkatan: Record<number, number> = {};
    for (const a of alumniRows) {
      alumniByAngkatan[a.angkatan] = (alumniByAngkatan[a.angkatan] || 0) + 1;
    }

    // Build WA group member set
    const waLinked = new Set(
      waRows.map((w: { member_id: string }) => w.member_id)
    );

    // Build member stats per angkatan
    const memberStats: Record<number, {
      hasPhone: number; contacted: number; dukung: number;
      ragu: number; sebelah: number; grupWa: number; dpt: number; vote: number;
    }> = {};

    for (const m of memberRows) {
      if (!memberStats[m.angkatan]) {
        memberStats[m.angkatan] = {
          hasPhone: 0, contacted: 0, dukung: 0,
          ragu: 0, sebelah: 0, grupWa: 0, dpt: 0, vote: 0,
        };
      }
      const s = memberStats[m.angkatan];
      if (m.no_hp && m.no_hp.trim() !== "") s.hasPhone++;
      if (m.sudah_dikontak === "Sudah") s.contacted++;
      if (m.dukungan === "dukung" || m.dukungan === "terkonvert") s.dukung++;
      if (m.dukungan === "ragu_ragu") s.ragu++;
      if (m.dukungan === "milih_sebelah") s.sebelah++;
      if (waLinked.has(m.id)) s.grupWa++;
      if (m.status_dpt === "Sudah") s.dpt++;
      if (m.vote === "Sudah") s.vote++;
    }

    // Build campaigner map per angkatan
    const campaignersByAngkatan: Record<number, { user_id: string; email: string }[]> = {};
    for (const r of campaignerRows) {
      if (!campaignersByAngkatan[r.angkatan]) campaignersByAngkatan[r.angkatan] = [];
      campaignersByAngkatan[r.angkatan].push({
        user_id: r.user_id,
        email: userEmailMap[r.user_id] || r.user_id,
      });
    }

    // Merge: one entry per angkatan in alumni table
    const result = Object.entries(alumniByAngkatan)
      .map(([angkatanStr, totalAlumni]) => {
        const angkatan = Number(angkatanStr);
        const ms = memberStats[angkatan] || {
          hasPhone: 0, contacted: 0, dukung: 0,
          ragu: 0, sebelah: 0, grupWa: 0, dpt: 0, vote: 0,
        };
        return {
          angkatan,
          totalAlumni,
          ...ms,
          campaigners: campaignersByAngkatan[angkatan] || [],
        };
      })
      .sort((a, b) => a.angkatan - b.angkatan);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch batch stats" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the API works**

Run: `npm run build`
Expected: Build succeeds with no errors.

Start the dev server and test: `curl http://localhost:3000/api/alumni/stats/per-batch | head -c 500`
Expected: JSON array of objects with `angkatan`, `totalAlumni`, `hasPhone`, etc.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/alumni/stats/per-batch/route.ts
git commit -m "feat: add per-batch alumni stats API endpoint"
```

---

### Task 2: Create BatchCard component

**Files:**
- Create: `src/components/BatchCard.tsx`

A single batch card showing the 8-step funnel with colored progress bars. Clickable to trigger detail modal.

- [ ] **Step 1: Create the BatchCard component**

```typescript
// src/components/BatchCard.tsx
"use client";

import { formatNum } from "@/lib/format";

export interface BatchStats {
  angkatan: number;
  totalAlumni: number;
  hasPhone: number;
  contacted: number;
  dukung: number;
  ragu: number;
  sebelah: number;
  grupWa: number;
  dpt: number;
  vote: number;
  campaigners: { user_id: string; email: string }[];
}

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

function getFunnelSteps(b: BatchStats): FunnelStep[] {
  return [
    { label: "Punya HP", value: b.hasPhone, color: "#0B27BC" },
    { label: "Kontak", value: b.contacted, color: "#3b82f6" },
    { label: "Dukung", value: b.dukung, color: "#10b981" },
    { label: "Ragu", value: b.ragu, color: "#eab308" },
    { label: "Sebelah", value: b.sebelah, color: "#ef4444" },
    { label: "Grup WA", value: b.grupWa, color: "#84303F" },
    { label: "DPT", value: b.dpt, color: "#6366f1" },
    { label: "Vote", value: b.vote, color: "#84303F" },
  ];
}

export { getFunnelSteps };

export function BatchCard({
  batch,
  onClick,
}: {
  batch: BatchStats;
  onClick: () => void;
}) {
  const steps = getFunnelSteps(batch);
  const picName = batch.campaigners.length > 0
    ? batch.campaigners[0].email.split("@")[0]
    : null;

  return (
    <div
      onClick={onClick}
      className="border border-border rounded-xl p-4 bg-white cursor-pointer transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-[#0B27BC]">
            TN{batch.angkatan}
          </span>
          {picName && (
            <span className="text-[11px] text-muted-foreground">
              PIC: {picName}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-[#0B27BC]">
          {formatNum(batch.totalAlumni)} alumni
        </span>
      </div>

      {/* Funnel rows */}
      <div className="flex flex-col gap-[5px]">
        {steps.map((step) => {
          const pct = batch.totalAlumni > 0
            ? Math.round((step.value / batch.totalAlumni) * 100)
            : 0;
          const barWidth = batch.totalAlumni > 0
            ? Math.max(0, (step.value / batch.totalAlumni) * 100)
            : 0;

          return (
            <div key={step.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-[60px] shrink-0 truncate">
                {step.label}
              </span>
              <div className="flex-1 h-[14px] bg-[#f1f5f9] rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: step.color,
                    minWidth: step.value > 0 ? "2px" : "0",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-semibold w-[58px] text-right shrink-0"
                style={{ color: step.color }}
              >
                {formatNum(step.value)} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/BatchCard.tsx
git commit -m "feat: add BatchCard component with funnel progress bars"
```

---

### Task 3: Create BatchDetailModal component

**Files:**
- Create: `src/components/BatchDetailModal.tsx`

Modal overlay showing enlarged funnel bars and Tim Sukses info for a selected batch.

- [ ] **Step 1: Create the BatchDetailModal component**

```typescript
// src/components/BatchDetailModal.tsx
"use client";

import { X } from "lucide-react";
import { formatNum } from "@/lib/format";
import type { BatchStats } from "@/components/BatchCard";
import { getFunnelSteps } from "@/components/BatchCard";

export function BatchDetailModal({
  batch,
  onClose,
}: {
  batch: BatchStats;
  onClose: () => void;
}) {
  const steps = getFunnelSteps(batch);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xl text-[#0B27BC]">
              TN{batch.angkatan}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatNum(batch.totalAlumni)} alumni
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Funnel */}
        <div className="flex flex-col gap-2 mb-5">
          {steps.map((step) => {
            const pct = batch.totalAlumni > 0
              ? Math.round((step.value / batch.totalAlumni) * 100)
              : 0;
            const barWidth = batch.totalAlumni > 0
              ? Math.max(0, (step.value / batch.totalAlumni) * 100)
              : 0;

            return (
              <div key={step.label} className="flex items-center gap-2.5">
                <span className="text-[11px] text-muted-foreground w-[70px] shrink-0">
                  {step.label}
                </span>
                <div className="flex-1 h-[18px] bg-[#f1f5f9] rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: step.color,
                      minWidth: step.value > 0 ? "2px" : "0",
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-bold w-[65px] text-right shrink-0"
                  style={{ color: step.color }}
                >
                  {formatNum(step.value)} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>

        {/* Tim Sukses */}
        <div className="border-t border-border pt-4">
          <p className="text-[11px] text-muted-foreground mb-2">Tim Sukses</p>
          {batch.campaigners.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {batch.campaigners.map((c) => (
                <span
                  key={c.user_id}
                  className="text-[11px] bg-[#0B27BC]/10 text-[#0B27BC] px-2.5 py-1 rounded-full font-medium"
                >
                  {c.email.split("@")[0]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Belum ditugaskan
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/BatchDetailModal.tsx
git commit -m "feat: add BatchDetailModal with funnel detail and Tim Sukses"
```

---

### Task 4: Create BatchProgressTab component

**Files:**
- Create: `src/components/BatchProgressTab.tsx`

Container for the batch progress tab: fetches data from `/api/alumni/stats/per-batch`, renders summary stats row, card grid, and manages modal state.

- [ ] **Step 1: Create the BatchProgressTab component**

```typescript
// src/components/BatchProgressTab.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, GraduationCap, ThumbsUp, Vote, Layers } from "lucide-react";
import { formatNum } from "@/lib/format";
import { BatchCard } from "@/components/BatchCard";
import { BatchDetailModal } from "@/components/BatchDetailModal";
import type { BatchStats } from "@/components/BatchCard";

export function BatchProgressTab() {
  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/alumni/stats/per-batch");
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch {
      // silent fail — empty state shown
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#0B27BC]" />
      </div>
    );
  }

  const totalAlumni = batches.reduce((s, b) => s + b.totalAlumni, 0);
  const totalDukung = batches.reduce((s, b) => s + b.dukung, 0);
  const totalVote = batches.reduce((s, b) => s + b.vote, 0);

  const summaryCards = [
    { label: "Total Batch", value: batches.length, icon: Layers, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
    { label: "Total Alumni", value: totalAlumni, icon: GraduationCap, color: "text-[#0B27BC]", bg: "bg-[#0B27BC]/10" },
    { label: "Total Dukung", value: totalDukung, icon: ThumbsUp, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Total Vote", value: totalVote, icon: Vote, color: "text-[#84303F]", bg: "bg-[#84303F]/10" },
  ];

  return (
    <>
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-border p-3 shadow-sm text-center"
            >
              <div className={`inline-flex p-1.5 rounded-lg ${card.bg} mb-1`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground leading-tight">
                {formatNum(card.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Batch cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {batches.map((batch) => (
          <BatchCard
            key={batch.angkatan}
            batch={batch}
            onClick={() => setSelectedBatch(batch)}
          />
        ))}
      </div>

      {/* Detail modal */}
      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/BatchProgressTab.tsx
git commit -m "feat: add BatchProgressTab with summary stats and card grid"
```

---

### Task 5: Add tabs and layout changes to Dashboard page

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

Add tab state, tab bar UI, horizontal chart, full-width chart layout, and render BatchProgressTab on the second tab.

- [ ] **Step 1: Add tab state and import BatchProgressTab**

At the top of `src/app/(dashboard)/page.tsx`, add to imports:

```typescript
import { BatchProgressTab } from "@/components/BatchProgressTab";
```

Inside the `Dashboard` component (after the existing `useState` calls around line 213), add:

```typescript
const [activeTab, setActiveTab] = useState<"overview" | "batch">("overview");
```

- [ ] **Step 2: Add the tab bar UI under the header**

Replace the pink gradient line (`<div className="h-1 bg-gradient-to-r ...` at line 526) and the closing `</header>` tag with:

```tsx
        {/* Tab bar */}
        <div className="px-4 sm:px-6 flex gap-0">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-5 py-2.5 text-[13px] font-semibold transition-colors ${
              activeTab === "overview"
                ? "text-white border-b-[3px] border-[#FE8DA1]"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`px-5 py-2.5 text-[13px] font-semibold transition-colors ${
              activeTab === "batch"
                ? "text-white border-b-[3px] border-[#FE8DA1]"
                : "text-white/60 hover:text-white/80"
            }`}
          >
            Progress per Batch
          </button>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>
```

- [ ] **Step 3: Wrap existing content in Overview tab, add Batch tab**

Replace the opening `<div className="px-4 sm:px-6 py-6 space-y-4">` (line 529) and its closing `</div>` (before the final `</div>` of the component) with a conditional render:

```tsx
      {activeTab === "overview" ? (
        <div className="px-4 sm:px-6 py-6 space-y-4">
          {/* ... all existing Overview content stays here unchanged ... */}
        </div>
      ) : (
        <div className="px-4 sm:px-6 py-6">
          <BatchProgressTab />
        </div>
      )}
```

- [ ] **Step 4: Make the chart full width and horizontal**

In the Overview content, find the chart grid wrapper (around line 652):

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

Replace the entire chart grid section (chart + donuts) with two separate full-width sections:

```tsx
        {/* ═══════ CHART — FULL WIDTH ═══════ */}
        {bothLoaded ? (
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">
              Peta Dukungan per Angkatan
            </h3>
            <div style={{ height: Math.max(300, angkatanBattle.length * 28 + 60) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={angkatanBattle}
                  layout="vertical"
                  margin={{ top: 5, right: 40, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="angkatan"
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#0B27BC" }}
                    width={45}
                  />
                  <Tooltip content={<AngkatanTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pendukung" name="Pendukung" fill="#10b981" stackId="a" />
                  <Bar dataKey="ragu" name="Ragu" fill="#eab308" stackId="a" />
                  <Bar dataKey="lawan" name="Pihak Lain" fill="#ef4444" stackId="a" />
                  <Bar
                    dataKey="belumTahu"
                    name="Belum Tahu"
                    fill="#cbd5e1"
                    stackId="a"
                    radius={[0, 2, 2, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <ChartSkeleton title="Peta Dukungan per Angkatan" />
        )}

        {/* ═══════ PROGRESS DONUTS — OWN ROW ═══════ */}
        {bothLoaded ? (
          <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4">
              Progress Operasional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {progressData.map((p) => {
                const pct =
                  p.total > 0 ? Math.round((p.value / p.total) * 100) : 0;
                const chartData = [
                  { name: "Done", value: p.value },
                  { name: "Rest", value: Math.max(0, p.total - p.value) },
                ];
                return (
                  <div key={p.label} className="flex flex-col items-center">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {p.label}
                    </p>
                    <div className="w-full h-[100px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={42}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                          >
                            <Cell fill={p.color} />
                            <Cell fill="#f1f5f9" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-lg font-bold text-foreground">{pct}%</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNum(p.value)}/{formatNum(p.total)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <ChartSkeleton title="Progress Operasional" />
        )}
```

Key changes:
- Removed the `grid grid-cols-1 lg:grid-cols-2` wrapper — chart and donuts are now separate full-width sections
- Chart: added `layout="vertical"`, swapped XAxis/YAxis roles, adjusted margins
- Chart height: dynamic based on number of angkatan (`angkatanBattle.length * 28 + 60`)
- Bar radius changed from `[2,2,0,0]` (top) to `[0,2,2,0]` (right side, since horizontal)
- Donuts: changed inner grid from `grid-cols-2` to `grid-cols-2 sm:grid-cols-4` for a single row on desktop

- [ ] **Step 5: Verify the full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Test in dev mode**

Run: `npm run dev`

Verify:
1. Dashboard loads with two tabs visible under the header
2. "Overview" tab shows the existing dashboard with horizontal chart (full width) and donuts below
3. "Progress per Batch" tab shows summary cards and batch funnel cards
4. Clicking a batch card opens the detail modal with enlarged funnel and Tim Sukses
5. Modal closes on X button click and backdrop click

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: add tabbed dashboard with horizontal chart and batch progress tab"
```

---

### Task 6: Final verification and cleanup

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors, no warnings.

- [ ] **Step 2: Test mobile responsiveness**

In dev mode, resize the browser to mobile width (< 640px). Verify:
- Tab bar renders correctly
- Batch cards stack to single column
- Modal is usable on small screens
- Horizontal chart scrolls or scales properly

- [ ] **Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "fix: address any issues found during final verification"
```

Only run this if Step 2 revealed issues that needed fixing. Skip if everything works.
