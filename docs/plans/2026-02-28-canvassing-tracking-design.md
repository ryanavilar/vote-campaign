# Canvassing Tracking — Design Document

**Date:** 2026-02-28

## Overview

Implement angkatan-based auto-assignment of alumni targets to Tim Sukses (campaigners), with a redesigned Target page that tracks the full canvassing flowchart: Kontak → Dukungan → Grup → DPT → Vote.

## Flowchart Stages

```
Alumni → Dibagi per Angkatan → Kontak → Dukung?
  ├─ Dukung → Gabung Grup? → Masuk Grup / Tidak Masuk Grup
  ├─ Ragu-ragu
  └─ Milih Sebelah → Berhasil Terkonvert
All paths → DPT → Milih (Vote)
```

## Data Model

### New Table: `campaigner_angkatan`

```sql
CREATE TABLE campaigner_angkatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  angkatan INTEGER NOT NULL CHECK (angkatan >= 1 AND angkatan <= 35),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, angkatan)
);
```

- Many Tim Sukses can share the same angkatan
- One Tim Sukses can have multiple angkatans

### New Column on `members`

```sql
ALTER TABLE members ADD COLUMN dukungan TEXT;
-- Values: 'dukung' | 'ragu_ragu' | 'milih_sebelah' | 'terkonvert' | null
```

### Existing Fields Used

| Field | Table | Values | Flowchart Step |
|-------|-------|--------|----------------|
| `sudah_dikontak` | members | Sudah / Belum | Kontak |
| `dukungan` | members (NEW) | dukung / ragu_ragu / milih_sebelah / terkonvert | Dukung? |
| `masuk_grup` | members | Sudah / Belum | Gabung grup? |
| `status_dpt` | members | Sudah / Belum | DPT |
| `vote` | members | Sudah / Belum | Milih |

## Admin Users Page — Angkatan Assignment

- For each user with role `campaigner`, show a multi-select angkatan field
- Admin can assign one or more angkatan numbers (1-35)
- Changes save immediately via PATCH `/api/roles` with `action: "set_angkatan"`
- Non-campaigner users don't show angkatan field

### API Changes to `/api/roles`

- **GET**: Include `angkatan: number[]` from `campaigner_angkatan` for each user
- **PATCH**: New action `{ user_id, action: "set_angkatan", angkatan: [5, 6, 7] }` — replaces all angkatan assignments

## Target Page — Redesigned UI

### Query Logic

Tim Sukses opens `/target` → system looks up angkatan(s) from `campaigner_angkatan` → query:

```
alumni WHERE angkatan IN (user's angkatans)
LEFT JOIN members ON alumni.id = members.alumni_id
```

- Alumni without a member record shown with empty statuses
- First field update on an alumni auto-creates a member record

### Header Stats Bar

6 summary cards: Total Alumni | Sudah Kontak | Dukung | Ragu-ragu | Milih Sebelah | Masuk Grup

### Filter Bar

- Filter by angkatan (if multiple assigned)
- Search by name
- Filter by status

### Table Layout

```
| Nama | Angkatan | No HP (editable) | Kontak | Dukungan | Grup | DPT | Vote |
```

### Interaction Model (Minimal Clicks)

- **No HP**: Click cell → inline text input → auto-save on Enter/blur (500ms debounce)
- **Kontak**: Single tap toggles Sudah ↔ Belum
- **Dukungan**: Tap cycles: — → Dukung → Ragu-ragu → Milih Sebelah → Terkonvert → —
  - Colors: 🟢 green = Dukung, 🟡 yellow = Ragu-ragu, 🔴 red = Milih Sebelah, 🔵 blue = Terkonvert
- **Grup, DPT, Vote**: Single tap toggles Sudah ↔ Belum

### Server Load Optimization

- Optimistic UI updates (instant visual feedback)
- Each field change → single PATCH to `/api/members/[id]`
- Lazy member creation: POST on first update for alumni without member record
- Phone input debounced at 500ms

## API Endpoints Affected

| Endpoint | Change |
|----------|--------|
| `GET /api/roles` | Include `angkatan: number[]` per user |
| `PATCH /api/roles` | New `set_angkatan` action |
| `GET /api/targets` | Rewrite: query by angkatan, LEFT JOIN members |
| `POST /api/targets` | Auto-create member for alumni on first update |
| `PATCH /api/members/[id]` | Add `dukungan` to allowed fields |

## Existing System Compatibility

- `campaigner_targets` table remains for any legacy/manual assignments
- Existing admin assignments page continues to work
- New system runs parallel — angkatan-based for Tim Sukses, manual for edge cases
