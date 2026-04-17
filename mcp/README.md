# Vote Campaign MCP Server

MCP (Model Context Protocol) server exposing admin-scope read/write access to the
Ikastara Kita campaign Supabase database.

**No delete operations** — all mutations are insert/update/upsert.

Uses the Supabase **service role key**, so all calls bypass RLS and run with full
admin privileges. Treat the running process as `super_admin`.

## Tools

### Reads

| Tool | Purpose |
|------|---------|
| `list_members` | Filter members by angkatan, status fields, dukungan, has_phone, name search |
| `get_member` | Fetch by id / no / no_hp / nama |
| `list_alumni` | Filter alumni; can scope to linked / unlinked / missing_nosis |
| `fuzzy_search_alumni` | Find alumni candidates for a given name (typo resolution) |
| `get_stats` | Funnel counts (kontak → dukungan → grup → DPT → vote) |
| `get_leaderboard` | Per-campaigner aggregated score |
| `list_events` | Filter by jenis / status / upcoming |
| `list_event_attendance` | Check-in records for an event |
| `list_form_submissions` | Public dukungan/event form log |
| `list_wa_group_members` | WAHA-synced WhatsApp group members |

### Writes (no delete)

| Tool | Purpose |
|------|---------|
| `update_member_status` | status_dpt / sudah_dikontak / masuk_grup / vote / isi_form_dpt / registrasi_website_dpt / dukungan |
| `update_member_contact` | nama / no_hp / alt_phones / email / domisili / pic |
| `upsert_alumni` | Create or update alumni (matches on lower(trim(nama)) + angkatan) |
| `mark_alumni_deceased` | Set is_deceased flag |
| `link_member_to_alumni` | Set members.alumni_id |
| `unlink_member_alumni` | Clear members.alumni_id |
| `create_event` / `update_event` | Manage events |
| `check_in_attendance` | Record event attendance |
| `upsert_campaigner_angkatan` | Assign campaigner to an angkatan |
| `seed_from_rows` | Bulk idempotent upsert from form rows {nama, nosis, wa} — mirrors the TN 23 DPT verification pipeline |

## Setup

1. `cd mcp && npm install`
2. Copy `.env.example` → `.env.local` and fill in:
   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>
   ```
3. Smoke test:
   ```
   npm start
   ```
   Should sit on stdin waiting for JSON-RPC. Ctrl-C to exit.

## Register with Claude Code

```
claude mcp add vote-campaign --scope user -- \
  node --env-file=/abs/path/to/vote-campaign/mcp/.env.local /abs/path/to/vote-campaign/mcp/server.mjs
```

Then `claude mcp list` should show `vote-campaign: ... ✓ Connected`. Tools appear
in the next session as `mcp__vote_campaign__<tool_name>`.

## Notes

- The service role key bypasses RLS — anyone with this MCP server enabled has admin
  rights. Don't expose `.env.local`.
- `fuzzy_search_alumni` currently falls back to ILIKE on the first word; for true
  trigram ranking, add a Postgres function `exec_fuzzy_alumni(name text, ang int)`
  using `pg_trgm.similarity()` and the server will pick it up.
- `seed_from_rows` matches by normalized name first (the alumni table's unique key),
  NOSIS only as fallback. This avoids overwriting an unrelated record when a form
  submitter mistypes their NOSIS.
