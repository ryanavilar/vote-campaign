# Form Dukungan Auto-Link with Alumni

**Date:** 2026-04-06
**Status:** Approved

## Problem

When someone submits the form dukungan, it creates a member record but does not link to the alumni table. Alumni linking requires a separate manual admin action. This creates extra work and delays data reconciliation.

Additionally, the form is public — anyone can submit, including non-alumni. The system needs to distinguish real alumni from random submissions.

## Solution

Auto-link form submissions to alumni records at submission time using fuzzy matching with three confidence tiers. Unresolved mid-confidence matches go to an admin review queue on the existing alumni page.

## Confidence Tiers

| Similarity | Angkatan | Action |
|---|---|---|
| 90%+ | Must match exactly | Auto-link: set `alumni_id` immediately |
| 60-89% | Must match exactly | Queue for admin review in `pending_alumni_matches` |
| Below 60% | N/A | No match: create member unlinked |

Fuzzy matching uses PostgreSQL trigram similarity (`pg_trgm`), which is already indexed on the alumni table (`idx_alumni_nama_trgm`).

## Data Changes

### New column: `members.is_non_alumni`

```sql
ALTER TABLE members ADD COLUMN is_non_alumni BOOLEAN DEFAULT FALSE;
```

- Set to `true` when admin rejects a pending match
- Excludes the member from ALL dashboard metrics, stats, and leaderboard
- The member record is kept (phone, email, harapan data is still useful for outreach)
- Once flagged, the member never reappears in the review queue

### New table: `pending_alumni_matches`

```sql
CREATE TABLE pending_alumni_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  alumni_id UUID NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  similarity FLOAT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_alumni_matches_status ON pending_alumni_matches(status) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_pending_alumni_matches_member ON pending_alumni_matches(member_id) WHERE status = 'pending';
```

RLS policies:
- Authenticated users can SELECT
- Only admin/super_admin can UPDATE (resolve matches)

## API Changes

### Modified: `POST /api/public/register`

After creating/updating a member, add alumni matching step:

1. Query alumni table: `SELECT id, nama, similarity(LOWER(TRIM(nama)), LOWER(TRIM($submitted_nama))) AS sim FROM alumni WHERE angkatan = $angkatan AND similarity(LOWER(TRIM(nama)), LOWER(TRIM($submitted_nama))) >= 0.6 ORDER BY sim DESC LIMIT 1`
2. If `sim >= 0.9`: set `members.alumni_id` directly
3. If `0.6 <= sim < 0.9`: insert into `pending_alumni_matches` with `status = 'pending'`
4. If no match or `sim < 0.6`: do nothing

Skip matching entirely if the member already has `alumni_id` set (re-submission of an already-linked member).

### New: `/api/alumni/review`

**GET** — Fetch all pending matches

Returns pending matches joined with member and alumni data:
```json
{
  "pending": [
    {
      "id": "match-uuid",
      "member": { "id": "...", "nama": "...", "angkatan": 5, "no_hp": "..." },
      "alumni": { "id": "...", "nama": "...", "angkatan": 5 },
      "similarity": 0.78,
      "created_at": "2026-04-06T..."
    }
  ],
  "count": 3
}
```

Requires: admin or super_admin role.

**POST** — Resolve a pending match

Request body:
```json
{
  "match_id": "uuid",
  "action": "link" | "reject" | "relink",
  "alumni_id": "uuid"  // required only for "relink"
}
```

Actions:
- **link**: Set `members.alumni_id` to the matched alumni. Update match `status = 'linked'`, set `reviewed_by` and `reviewed_at`.
- **reject**: Set `members.is_non_alumni = true`. Update match `status = 'rejected'`, set `reviewed_by` and `reviewed_at`.
- **relink**: Set `members.alumni_id` to the provided `alumni_id` (admin picks a different alumni). Update match `status = 'linked'`, set `reviewed_by` and `reviewed_at`.

Requires: admin or super_admin role.

## Dashboard Exclusion

Add `is_non_alumni IS NOT TRUE` filter to all metric queries:

- **`/api/alumni` (GET)**: Exclude non-alumni members from stats and member counts
- **`/api/targets` (GET)**: Exclude non-alumni from target lists
- **`/api/members` (GET)**: Exclude non-alumni from member counts/stats
- **Dashboard home page stats**: Exclude non-alumni
- **Leaderboard**: Exclude non-alumni from referral/contact counts

The filter uses `IS NOT TRUE` (not `= FALSE`) to handle NULL values correctly — existing members without the column set should still be included.

## UI Changes (Alumni Page)

### Header Badge

Add a badge next to existing buttons showing pending review count:
- Only visible when `count > 0`
- Example: orange badge "3 perlu review"
- Clicking scrolls to / opens the review panel

### Review Panel

Collapsible section between stats bar and alumni table:
- Collapsed by default, expandable
- Auto-expands when badge is clicked

Each pending item shows:
- **Left side**: Submitted data (nama, angkatan, no_hp)
- **Right side**: Matched alumni (nama, angkatan, similarity %)
- **Actions**: Three buttons
  - **Link** (green): Confirm match → links member to alumni
  - **Reject** (red): Mark as non-alumni → excluded from metrics
  - **Pilih Alumni Lain** (blue): Opens alumni search dropdown → admin picks correct alumni, then links

After any action, the item is removed from the panel and count updates.

### Alumni Search for Relink

Reuse the existing trigram search endpoint (`/api/alumni/search`) to let admins search and select a different alumni. Show as an inline dropdown/autocomplete when "Pilih Alumni Lain" is clicked.

## Edge Cases

1. **Re-submission by already-linked member**: Skip matching entirely (member already has `alumni_id`).
2. **Re-submission by rejected non-alumni**: Skip matching (member has `is_non_alumni = true`).
3. **Multiple form submissions matching same alumni**: Each creates its own pending match. Admin resolves individually.
4. **Alumni record deleted while match is pending**: CASCADE delete removes the pending match. Member stays unlinked.
5. **Member already has a pending match**: UNIQUE index prevents duplicate pending entries for the same member.
