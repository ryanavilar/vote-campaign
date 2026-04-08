# Dashboard Batch Progress — Design Spec

## Problem

The current dashboard shows aggregate stats across all angkatan but provides no way to see how each individual batch (TN13, TN15, TN25, etc.) is progressing through the campaign funnel. Admins have to mentally piece together per-batch status from the stacked bar chart and separate page visits. The chart also had a data source bug where it counted from the `members` table instead of the `alumni` table, showing much lower numbers than reality.

## Solution

Add a tabbed dashboard with two views:
1. **Overview** — existing dashboard with layout improvements
2. **Progress per Batch** — new tab showing per-angkatan funnel cards

## Design Decisions

### Tabs in Dashboard Page

- Two tabs rendered under the existing blue header: "Overview" and "Progress per Batch"
- Tab state managed client-side (no URL change needed, but could use query params for shareability)
- Active tab has white text + pink bottom border matching the brand accent (#FE8DA1)
- Inactive tab has 60% opacity white text

### Overview Tab Changes

**Chart goes full width:**
- "Peta Dukungan per Angkatan" chart moves from a 2-column grid to full-width single column
- Progress donuts ("Progress Operasional") move to their own row below the chart
- Donuts render as a 4-column grid (same as current, just in their own row)

**Chart rotated to horizontal:**
- Switch from vertical bars (angkatan on X-axis) to horizontal bars (angkatan on Y-axis, bars go left to right)
- In Recharts: `layout="vertical"` on BarChart, swap XAxis/YAxis dataKey bindings
- Angkatan labels are clean and readable on the left — no more 45-degree rotation
- Total alumni count shown on the right side of each bar
- Stacked segments: Pendukung (green), Ragu (yellow), Pihak Lain (red), Belum Tahu (gray)

### Progress per Batch Tab

**Summary stats row:**
- 4 cards at the top: Total Batch, Total Alumni, Total Dukung, Total Vote
- Aggregated across all angkatan

**Batch cards grid:**
- 2 columns on desktop, 1 column on mobile
- Each card shows:
  - Header: batch name (TN15), PIC/Tim Sukses name if assigned, total alumni count
  - 8-row funnel, each row has: label, horizontal progress bar, count + percentage
  - Progress bar color matches the count text color (not grey)

**Funnel steps per card (in order):**

| Step | Label | Bar Color | Source |
|------|-------|-----------|--------|
| Punya HP | Has phone number | #0B27BC (brand blue) | member.no_hp not empty |
| Kontak | Been contacted | #3b82f6 (blue) | member.sudah_dikontak = "Sudah" |
| Dukung | Supports us | #10b981 (green) | member.dukungan = "dukung" or "terkonvert" |
| Ragu | Undecided | #eab308 (yellow) | member.dukungan = "ragu_ragu" |
| Sebelah | Opposing | #ef4444 (red) | member.dukungan = "milih_sebelah" |
| Grup WA | In WhatsApp group | #84303F (maroon) | wa_group_members linkage |
| DPT | Registered voter | #6366f1 (indigo) | member.status_dpt = "Sudah" |
| Vote | Confirmed voted | #84303F (maroon) | member.vote = "Sudah" |

**Percentage calculation:** Each step's percentage is relative to total alumni for that batch (from the `alumni` table), not relative to linked members. This ensures consistency with the target page numbers.

**Cards are clickable** — opens a detail modal.

### Batch Detail Modal

- Overlay modal with backdrop blur
- Header: batch name, total alumni count, close button
- Larger funnel bars (same 8 steps, bigger for readability)
- Bar colors match count text colors
- Tim Sukses section: shows campaigner names/emails assigned to this angkatan via `campaigner_angkatan` table. Shows "Belum ditugaskan" if none assigned.
- No individual alumni names — aggregates only

## Data Source

### New API endpoint: `GET /api/alumni/stats/per-batch`

Returns per-angkatan stats combining alumni table (total) with members table (funnel progress).

Response shape:
```typescript
interface BatchStats {
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

// GET /api/alumni/stats/per-batch
// Response: BatchStats[]
```

Data assembly:
1. Fetch all alumni grouped by angkatan (total counts)
2. Fetch all members (not is_non_alumni) grouped by angkatan with status counts
3. Fetch wa_group_members for grup WA counts
4. Fetch campaigner_angkatan + user emails for Tim Sukses info
5. Merge: for each angkatan in alumni table, overlay member counts. Angkatan with zero members still appear (with all funnel counts = 0).

### Existing data reuse

The Overview tab continues using:
- `/api/alumni/stats` for totalAlumni, linkedAlumni, alumniByAngkatan (already fixed to use alumni table as baseline)
- Direct `members` table query for battle stats
- `/api/wa-group/stats` for WA group stats

## Component Structure

```
src/app/(dashboard)/page.tsx          — add tab state, render tab content
src/components/BatchProgressTab.tsx   — new: summary stats + card grid
src/components/BatchCard.tsx          — new: single batch funnel card
src/components/BatchDetailModal.tsx   — new: modal with enlarged funnel + Tim Sukses
src/app/api/alumni/stats/per-batch/route.ts — new: per-batch stats API
```

## Mobile Behavior

- Tab bar: horizontally scrollable if needed (unlikely with 2 tabs)
- Batch cards: single column on mobile (< 640px)
- Modal: full-screen on mobile with slide-up animation
- Funnel bars: labels shrink slightly, counts stay readable

## Edge Cases

- Angkatan with zero linked members: card shows all funnel bars at 0%, total alumni count still displays
- Angkatan not in alumni table but in members table: should not happen (members reference alumni), but if it does, skip it
- No Tim Sukses assigned: modal shows "Belum ditugaskan" in muted text
- Large number of angkatan (33 batches): cards grid scrolls naturally, no pagination needed
