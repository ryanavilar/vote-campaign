#!/usr/bin/env node
/**
 * Vote Campaign MCP server.
 *
 * Exposes admin-scope read/write access to the Ikastara Kita campaign database.
 * No delete operations by design — mutations are update/insert/upsert only.
 *
 * Uses the Supabase service role key, so all calls bypass RLS and run with
 * full admin privileges regardless of the calling user.
 *
 * Run:
 *   node --env-file=.env.local server.mjs
 *
 * Register with Claude Code:
 *   claude mcp add vote-campaign -- node /abs/path/to/mcp/server.mjs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Shared schema fragments
// ---------------------------------------------------------------------------

const STATUS_VALUES = ["Sudah", "Belum"];
const DUKUNGAN_VALUES = ["dukung", "ragu_ragu", "milih_sebelah", "terkonvert"];
const EVENT_JENIS = ["Silaturahmi", "Rapat", "Door-to-door", "Rally", "Sosialisasi", "Lainnya"];
const EVENT_STATUS = ["Terjadwal", "Berlangsung", "Selesai", "Dibatalkan"];

function ok(payload) {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}
function fail(err) {
  const message = err?.message || String(err);
  return { isError: true, content: [{ type: "text", text: `ERROR: ${message}` }] };
}

function pickDefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page++;
    if (page > 50) return null;
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools = [
  // ====== READS ======
  {
    name: "list_members",
    description:
      "List members with optional filters. Returns member rows joined with alumni nosis. Default limit 50.",
    inputSchema: {
      type: "object",
      properties: {
        angkatan: { type: "integer" },
        status_dpt: { type: "string", enum: STATUS_VALUES },
        isi_form_dpt: { type: "string", enum: STATUS_VALUES },
        registrasi_website_dpt: { type: "string", enum: STATUS_VALUES },
        sudah_dikontak: { type: "string", enum: STATUS_VALUES },
        masuk_grup: { type: "string", enum: STATUS_VALUES },
        vote: { type: "string", enum: STATUS_VALUES },
        dukungan: { type: "string", enum: DUKUNGAN_VALUES },
        assigned_to: { type: "string", description: "user_id of assigned campaigner" },
        has_phone: { type: "boolean" },
        search_name: { type: "string", description: "case-insensitive nama substring" },
        limit: { type: "integer", default: 50, maximum: 500 },
        offset: { type: "integer", default: 0 },
      },
    },
    handler: async (args) => {
      let q = supabase
        .from("members")
        .select(
          "id, no, nama, angkatan, no_hp, alt_phones, pic, email, domisili, status_dpt, isi_form_dpt, registrasi_website_dpt, sudah_dikontak, masuk_grup, vote, dukungan, assigned_to, alumni_id, is_non_alumni, alumni:alumni_id(nosis, nama, is_deceased)",
          { count: "exact" }
        )
        .order("no", { ascending: true });

      const eqFields = [
        "angkatan",
        "status_dpt",
        "isi_form_dpt",
        "registrasi_website_dpt",
        "sudah_dikontak",
        "masuk_grup",
        "vote",
        "dukungan",
        "assigned_to",
      ];
      for (const f of eqFields) if (args[f] !== undefined) q = q.eq(f, args[f]);

      if (args.has_phone === true) q = q.not("no_hp", "is", null).neq("no_hp", "");
      if (args.has_phone === false) q = q.or("no_hp.is.null,no_hp.eq.");
      if (args.search_name) q = q.ilike("nama", `%${args.search_name}%`);

      const limit = Math.min(args.limit ?? 50, 500);
      const offset = args.offset ?? 0;
      q = q.range(offset, offset + limit - 1);

      const { data, error, count } = await q;
      if (error) return fail(error);
      return ok({ total: count, returned: data.length, limit, offset, rows: data });
    },
  },
  {
    name: "get_member",
    description: "Fetch a single member by id, no (sequence), no_hp, or exact nama.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        no: { type: "integer" },
        no_hp: { type: "string" },
        nama: { type: "string", description: "exact case-insensitive match" },
      },
    },
    handler: async (args) => {
      let q = supabase
        .from("members")
        .select("*, alumni:alumni_id(id, nosis, nama, angkatan, is_deceased)")
        .limit(5);
      if (args.id) q = q.eq("id", args.id);
      else if (args.no !== undefined) q = q.eq("no", args.no);
      else if (args.no_hp) q = q.eq("no_hp", args.no_hp);
      else if (args.nama) q = q.ilike("nama", args.nama);
      else return fail("Provide one of: id, no, no_hp, nama");
      const { data, error } = await q;
      if (error) return fail(error);
      return ok({ matches: data.length, rows: data });
    },
  },
  {
    name: "list_alumni",
    description: "List alumni with filters (angkatan, linked, is_deceased, missing_nosis).",
    inputSchema: {
      type: "object",
      properties: {
        angkatan: { type: "integer" },
        linked: {
          type: "boolean",
          description: "true = has a linked member; false = no member row",
        },
        is_deceased: { type: "boolean" },
        missing_nosis: { type: "boolean" },
        search_name: { type: "string" },
        limit: { type: "integer", default: 50, maximum: 500 },
        offset: { type: "integer", default: 0 },
      },
    },
    handler: async (args) => {
      let q = supabase
        .from("alumni")
        .select(
          "id, nosis, nama, angkatan, kelanjutan_studi, program_studi, keterangan, is_deceased, members:members(id, no_hp, isi_form_dpt)",
          { count: "exact" }
        )
        .order("angkatan", { ascending: true })
        .order("nama", { ascending: true });
      if (args.angkatan !== undefined) q = q.eq("angkatan", args.angkatan);
      if (args.is_deceased !== undefined) q = q.eq("is_deceased", args.is_deceased);
      if (args.missing_nosis === true) q = q.or("nosis.is.null,nosis.eq.");
      if (args.search_name) q = q.ilike("nama", `%${args.search_name}%`);

      const limit = Math.min(args.limit ?? 50, 500);
      const offset = args.offset ?? 0;
      q = q.range(offset, offset + limit - 1);

      const { data, error, count } = await q;
      if (error) return fail(error);
      let rows = data;
      if (args.linked === true) rows = rows.filter((a) => a.members && a.members.length > 0);
      if (args.linked === false) rows = rows.filter((a) => !a.members || a.members.length === 0);
      return ok({ total: count, returned: rows.length, limit, offset, rows });
    },
  },
  {
    name: "fuzzy_search_alumni",
    description:
      "Find alumni by trigram similarity on nama. Returns top N ranked candidates with similarity score. Useful for resolving name typos in form submissions.",
    inputSchema: {
      type: "object",
      required: ["nama"],
      properties: {
        nama: { type: "string" },
        angkatan: { type: "integer" },
        limit: { type: "integer", default: 5, maximum: 20 },
        min_similarity: { type: "number", default: 0.2 },
      },
    },
    handler: async (args) => {
      const { data, error } = await supabase.rpc("exec_fuzzy_alumni", {}).maybeSingle();
      // RPC helper may not exist — fall back to raw SQL via PostgREST would need a view.
      // We'll emulate with a direct query using ILIKE + a client-side sort by similarity.
      // For real similarity we need a DB function. Use a direct .rpc fallback with a
      // dedicated RPC if available; otherwise use pattern match.
      if (!error) return ok(data);
      // Fallback:
      let q = supabase
        .from("alumni")
        .select("id, nosis, nama, angkatan")
        .ilike("nama", `%${args.nama.split(/\s+/)[0]}%`)
        .limit(Math.min(args.limit ?? 5, 20));
      if (args.angkatan !== undefined) q = q.eq("angkatan", args.angkatan);
      const { data: rows, error: e2 } = await q;
      if (e2) return fail(e2);
      return ok({ note: "Fallback ILIKE match (no trigram RPC). Create a pg function for true similarity ranking.", rows });
    },
  },
  {
    name: "get_stats",
    description:
      "Campaign funnel stats for a given angkatan (or all). Returns counts for kontak → dukungan → WA → DPT → vote.",
    inputSchema: {
      type: "object",
      properties: { angkatan: { type: "integer" } },
    },
    handler: async (args) => {
      const base = supabase.from("members").select("id", { count: "exact", head: true });
      async function count(modifier) {
        let q = modifier(supabase.from("members").select("id", { count: "exact", head: true }));
        if (args.angkatan !== undefined) q = q.eq("angkatan", args.angkatan);
        const { count, error } = await q;
        if (error) throw error;
        return count;
      }
      try {
        const total = await count((q) => q);
        const kontak = await count((q) => q.eq("sudah_dikontak", "Sudah"));
        const dukung = await count((q) => q.eq("dukungan", "dukung"));
        const masukGrup = await count((q) => q.eq("masuk_grup", "Sudah"));
        const isiFormDpt = await count((q) => q.eq("isi_form_dpt", "Sudah"));
        const statusDpt = await count((q) => q.eq("status_dpt", "Sudah"));
        const voted = await count((q) => q.eq("vote", "Sudah"));
        return ok({
          angkatan: args.angkatan ?? "all",
          total,
          kontak,
          dukung,
          masuk_grup: masukGrup,
          isi_form_dpt: isiFormDpt,
          status_dpt: statusDpt,
          vote: voted,
        });
      } catch (e) {
        return fail(e);
      }
    },
  },
  {
    name: "get_leaderboard",
    description:
      "Per-campaigner leaderboard. Aggregates members assigned_to each user with status counts. Top 50.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 50, maximum: 200 } },
    },
    handler: async (args) => {
      // We'll fetch assigned members and aggregate in JS since PostgREST has no GROUP BY.
      const { data, error } = await supabase
        .from("members")
        .select("assigned_to, sudah_dikontak, dukungan, masuk_grup, status_dpt, vote")
        .not("assigned_to", "is", null);
      if (error) return fail(error);
      const byUser = new Map();
      for (const m of data) {
        const key = m.assigned_to;
        if (!byUser.has(key)) {
          byUser.set(key, {
            assigned_to: key,
            total: 0,
            kontak: 0,
            dukung: 0,
            masuk_grup: 0,
            status_dpt: 0,
            vote: 0,
            score: 0,
          });
        }
        const row = byUser.get(key);
        row.total++;
        if (m.sudah_dikontak === "Sudah") row.kontak++;
        if (m.dukungan === "dukung") row.dukung++;
        if (m.masuk_grup === "Sudah") row.masuk_grup++;
        if (m.status_dpt === "Sudah") row.status_dpt++;
        if (m.vote === "Sudah") row.vote++;
        row.score =
          row.kontak * 1 + row.dukung * 2 + row.masuk_grup * 2 + row.status_dpt * 3 + row.vote * 5;
      }
      const rows = Array.from(byUser.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(args.limit ?? 50, 200));
      return ok({ returned: rows.length, rows });
    },
  },
  {
    name: "list_events",
    description: "List campaign events (jenis, status, date range).",
    inputSchema: {
      type: "object",
      properties: {
        jenis: { type: "string", enum: EVENT_JENIS },
        status: { type: "string", enum: EVENT_STATUS },
        upcoming_only: { type: "boolean" },
        limit: { type: "integer", default: 50, maximum: 500 },
        offset: { type: "integer", default: 0 },
      },
    },
    handler: async (args) => {
      let q = supabase
        .from("events")
        .select("*", { count: "exact" })
        .order("tanggal", { ascending: false });
      if (args.jenis) q = q.eq("jenis", args.jenis);
      if (args.status) q = q.eq("status", args.status);
      if (args.upcoming_only) q = q.gte("tanggal", new Date().toISOString());
      const limit = Math.min(args.limit ?? 50, 500);
      const offset = args.offset ?? 0;
      q = q.range(offset, offset + limit - 1);
      const { data, error, count } = await q;
      if (error) return fail(error);
      return ok({ total: count, returned: data.length, rows: data });
    },
  },
  {
    name: "list_event_attendance",
    description: "List check-in records for a given event.",
    inputSchema: {
      type: "object",
      required: ["event_id"],
      properties: { event_id: { type: "string" }, limit: { type: "integer", default: 200 } },
    },
    handler: async (args) => {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("*, member:member_id(id, nama, angkatan, no_hp)")
        .eq("event_id", args.event_id)
        .order("checked_in_at", { ascending: false })
        .limit(args.limit ?? 200);
      if (error) return fail(error);
      return ok({ returned: data.length, rows: data });
    },
  },
  {
    name: "list_form_submissions",
    description: "List public form submissions (type: dukungan | event).",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["dukungan", "event"] },
        angkatan: { type: "integer" },
        since: { type: "string", description: "ISO datetime" },
        limit: { type: "integer", default: 50, maximum: 500 },
        offset: { type: "integer", default: 0 },
      },
    },
    handler: async (args) => {
      let q = supabase
        .from("form_submissions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });
      if (args.type) q = q.eq("type", args.type);
      if (args.angkatan !== undefined) q = q.eq("angkatan", args.angkatan);
      if (args.since) q = q.gte("created_at", args.since);
      const limit = Math.min(args.limit ?? 50, 500);
      const offset = args.offset ?? 0;
      q = q.range(offset, offset + limit - 1);
      const { data, error, count } = await q;
      if (error) return fail(error);
      return ok({ total: count, returned: data.length, rows: data });
    },
  },
  {
    name: "list_wa_group_members",
    description: "List WhatsApp-group membership records synced from WAHA.",
    inputSchema: {
      type: "object",
      properties: {
        linked: { type: "boolean" },
        limit: { type: "integer", default: 100, maximum: 1000 },
        offset: { type: "integer", default: 0 },
      },
    },
    handler: async (args) => {
      let q = supabase
        .from("wa_group_members")
        .select("*, member:member_id(id, nama, angkatan)", { count: "exact" })
        .order("synced_at", { ascending: false });
      if (args.linked === true) q = q.not("member_id", "is", null);
      if (args.linked === false) q = q.is("member_id", null);
      const limit = Math.min(args.limit ?? 100, 1000);
      const offset = args.offset ?? 0;
      q = q.range(offset, offset + limit - 1);
      const { data, error, count } = await q;
      if (error) return fail(error);
      return ok({ total: count, returned: data.length, rows: data });
    },
  },

  // ====== WRITES (no delete) ======
  {
    name: "update_member_status",
    description:
      "Update one or more status fields on a member. All fields optional; only provided ones are changed. Set to null to clear.",
    inputSchema: {
      type: "object",
      required: ["member_id"],
      properties: {
        member_id: { type: "string" },
        status_dpt: { type: ["string", "null"], enum: [...STATUS_VALUES, null] },
        sudah_dikontak: { type: ["string", "null"], enum: [...STATUS_VALUES, null] },
        masuk_grup: { type: ["string", "null"], enum: [...STATUS_VALUES, null] },
        vote: { type: ["string", "null"], enum: [...STATUS_VALUES, null] },
        isi_form_dpt: { type: ["string", "null"], enum: [...STATUS_VALUES, null] },
        registrasi_website_dpt: { type: ["string", "null"], enum: [...STATUS_VALUES, null] },
        dukungan: { type: ["string", "null"], enum: [...DUKUNGAN_VALUES, null] },
      },
    },
    handler: async (args) => {
      const { member_id, ...rest } = args;
      const patch = pickDefined(rest);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const { data, error } = await supabase
        .from("members")
        .update(patch)
        .eq("id", member_id)
        .select()
        .single();
      if (error) return fail(error);
      return ok({ updated: data });
    },
  },
  {
    name: "update_member_contact",
    description:
      "Update contact fields on a member (no_hp, alt_phones, email, domisili, pic, nama).",
    inputSchema: {
      type: "object",
      required: ["member_id"],
      properties: {
        member_id: { type: "string" },
        nama: { type: "string" },
        no_hp: { type: "string" },
        alt_phones: { type: "array", items: { type: "string" } },
        email: { type: ["string", "null"] },
        domisili: { type: ["string", "null"] },
        pic: { type: ["string", "null"] },
      },
    },
    handler: async (args) => {
      const { member_id, ...rest } = args;
      const patch = pickDefined(rest);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const { data, error } = await supabase
        .from("members")
        .update(patch)
        .eq("id", member_id)
        .select()
        .single();
      if (error) return fail(error);
      return ok({ updated: data });
    },
  },
  {
    name: "upsert_alumni",
    description:
      "Insert or update an alumni record. Matches on (LOWER(TRIM(nama)), angkatan). Use id for a specific update.",
    inputSchema: {
      type: "object",
      required: ["nama", "angkatan"],
      properties: {
        id: { type: "string", description: "if provided, update by id instead of upsert-by-name" },
        nama: { type: "string" },
        angkatan: { type: "integer", minimum: 1, maximum: 33 },
        nosis: { type: ["string", "null"] },
        kelanjutan_studi: { type: ["string", "null"] },
        program_studi: { type: ["string", "null"] },
        keterangan: { type: ["string", "null"] },
      },
    },
    handler: async (args) => {
      const { id, ...payload } = args;
      if (id) {
        const patch = pickDefined(payload);
        const { data, error } = await supabase
          .from("alumni")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) return fail(error);
        return ok({ updated: data });
      }
      // Upsert by (nama, angkatan) — emulate because unique index uses LOWER(TRIM(nama)).
      const { data: existing, error: e1 } = await supabase
        .from("alumni")
        .select("id")
        .eq("angkatan", payload.angkatan)
        .ilike("nama", payload.nama.trim())
        .maybeSingle();
      if (e1 && e1.code !== "PGRST116") return fail(e1);
      if (existing) {
        const { data, error } = await supabase
          .from("alumni")
          .update(pickDefined(payload))
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return fail(error);
        return ok({ mode: "update", row: data });
      }
      const { data, error } = await supabase
        .from("alumni")
        .insert(pickDefined(payload))
        .select()
        .single();
      if (error) return fail(error);
      return ok({ mode: "insert", row: data });
    },
  },
  {
    name: "mark_alumni_deceased",
    description: "Set is_deceased on an alumni row.",
    inputSchema: {
      type: "object",
      required: ["alumni_id", "is_deceased"],
      properties: {
        alumni_id: { type: "string" },
        is_deceased: { type: "boolean" },
      },
    },
    handler: async (args) => {
      const { data, error } = await supabase
        .from("alumni")
        .update({ is_deceased: args.is_deceased })
        .eq("id", args.alumni_id)
        .select()
        .single();
      if (error) return fail(error);
      return ok({ updated: data });
    },
  },
  {
    name: "link_member_to_alumni",
    description: "Link a member row to an alumni row (sets members.alumni_id).",
    inputSchema: {
      type: "object",
      required: ["member_id", "alumni_id"],
      properties: {
        member_id: { type: "string" },
        alumni_id: { type: "string" },
      },
    },
    handler: async (args) => {
      const { data, error } = await supabase
        .from("members")
        .update({ alumni_id: args.alumni_id })
        .eq("id", args.member_id)
        .select()
        .single();
      if (error) return fail(error);
      return ok({ updated: data });
    },
  },
  {
    name: "unlink_member_alumni",
    description: "Clear members.alumni_id for a given member (does not delete the member).",
    inputSchema: {
      type: "object",
      required: ["member_id"],
      properties: { member_id: { type: "string" } },
    },
    handler: async (args) => {
      const { data, error } = await supabase
        .from("members")
        .update({ alumni_id: null })
        .eq("id", args.member_id)
        .select()
        .single();
      if (error) return fail(error);
      return ok({ updated: data });
    },
  },
  {
    name: "create_event",
    description: "Create a new campaign event.",
    inputSchema: {
      type: "object",
      required: ["nama", "jenis", "tanggal"],
      properties: {
        nama: { type: "string" },
        jenis: { type: "string", enum: EVENT_JENIS },
        tanggal: { type: "string", description: "ISO datetime" },
        deskripsi: { type: ["string", "null"] },
        lokasi: { type: ["string", "null"] },
        status: { type: "string", enum: EVENT_STATUS, default: "Terjadwal" },
        checkin_code: { type: ["string", "null"] },
      },
    },
    handler: async (args) => {
      const { data, error } = await supabase
        .from("events")
        .insert(pickDefined(args))
        .select()
        .single();
      if (error) return fail(error);
      return ok({ created: data });
    },
  },
  {
    name: "update_event",
    description: "Update an existing event.",
    inputSchema: {
      type: "object",
      required: ["event_id"],
      properties: {
        event_id: { type: "string" },
        nama: { type: "string" },
        jenis: { type: "string", enum: EVENT_JENIS },
        tanggal: { type: "string" },
        deskripsi: { type: ["string", "null"] },
        lokasi: { type: ["string", "null"] },
        status: { type: "string", enum: EVENT_STATUS },
        checkin_code: { type: ["string", "null"] },
      },
    },
    handler: async (args) => {
      const { event_id, ...rest } = args;
      const patch = pickDefined(rest);
      if (Object.keys(patch).length === 0) return fail("Nothing to update");
      const { data, error } = await supabase
        .from("events")
        .update(patch)
        .eq("id", event_id)
        .select()
        .single();
      if (error) return fail(error);
      return ok({ updated: data });
    },
  },
  {
    name: "check_in_attendance",
    description: "Record a member's attendance at an event (insert or update catatan).",
    inputSchema: {
      type: "object",
      required: ["event_id", "member_id"],
      properties: {
        event_id: { type: "string" },
        member_id: { type: "string" },
        catatan: { type: ["string", "null"] },
        checked_in_by: { type: ["string", "null"] },
      },
    },
    handler: async (args) => {
      const { data: existing } = await supabase
        .from("event_attendance")
        .select("id")
        .eq("event_id", args.event_id)
        .eq("member_id", args.member_id)
        .maybeSingle();
      if (existing) {
        const { data, error } = await supabase
          .from("event_attendance")
          .update(pickDefined({ catatan: args.catatan, checked_in_by: args.checked_in_by }))
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return fail(error);
        return ok({ mode: "update", row: data });
      }
      const { data, error } = await supabase
        .from("event_attendance")
        .insert({
          event_id: args.event_id,
          member_id: args.member_id,
          catatan: args.catatan ?? null,
          checked_in_by: args.checked_in_by ?? null,
        })
        .select()
        .single();
      if (error) return fail(error);
      return ok({ mode: "insert", row: data });
    },
  },
  {
    name: "upsert_campaigner_angkatan",
    description: "Assign a campaigner (user_id) to an angkatan (1..33). Idempotent.",
    inputSchema: {
      type: "object",
      required: ["user_id", "angkatan"],
      properties: {
        user_id: { type: "string" },
        angkatan: { type: "integer", minimum: 1, maximum: 33 },
      },
    },
    handler: async (args) => {
      const { data, error } = await supabase
        .from("campaigner_angkatan")
        .upsert(args, { onConflict: "user_id,angkatan" })
        .select()
        .single();
      if (error) return fail(error);
      return ok({ upserted: data });
    },
  },
  {
    name: "create_campaigner_account",
    description:
      "Create a tim sukses (campaigner) account by email. Default flow: create user with a direct password and email auto-confirmed (no magic-link). Pass send_invite_email=true to send a magic-link invite instead. Sets role='campaigner' in user_roles and assigns to the target angkatan. Idempotent — existing auth accounts are reused (password reset if provided), existing non-campaigner roles are preserved, and the angkatan assignment is upserted.",
    inputSchema: {
      type: "object",
      required: ["email", "angkatan"],
      properties: {
        email: { type: "string", description: "Email address" },
        angkatan: { type: "integer", minimum: 1, maximum: 33 },
        nama: { type: "string", description: "Display name (optional, stored in user_metadata)" },
        password: {
          type: "string",
          description:
            "Direct password to set (used when send_invite_email is false, which is the default). If omitted and send_invite_email is false, a default password is used.",
        },
        send_invite_email: {
          type: "boolean",
          default: false,
          description:
            "If true, sends a magic-link invitation email instead of setting a password. Default is false (password flow with email auto-confirmed).",
        },
      },
    },
    handler: async (args) => {
      const email = String(args.email || "").trim().toLowerCase();
      if (!email) return fail("email is required");
      const angkatan = args.angkatan;
      const sendInvite = args.send_invite_email === true;
      const password = args.password || (sendInvite ? undefined : "IkastaraKitaPastiMenang123!!!");

      // 1. Find or create auth user
      let user = null;
      let created = false;
      let passwordSet = false;
      const metadata = args.nama ? { full_name: args.nama } : undefined;

      if (sendInvite) {
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
          data: metadata,
        });
        if (error) {
          if (/already/i.test(error.message || "") || /registered/i.test(error.message || "")) {
            const found = await findUserByEmail(email);
            if (!found) return fail(error);
            user = found;
          } else {
            return fail(error);
          }
        } else {
          user = data.user;
          created = true;
        }
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        });
        if (error) {
          if (/already/i.test(error.message || "") || /registered/i.test(error.message || "")) {
            const found = await findUserByEmail(email);
            if (!found) return fail(error);
            user = found;
            // Reset password + confirm email for existing user
            const { error: upErr } = await supabase.auth.admin.updateUserById(user.id, {
              password,
              email_confirm: true,
              ...(metadata ? { user_metadata: metadata } : {}),
            });
            if (upErr) return fail(upErr);
            passwordSet = true;
          } else {
            return fail(error);
          }
        } else {
          user = data.user;
          created = true;
          passwordSet = true;
        }
      }

      if (!user) return fail("Failed to resolve auth user");

      // 2. Ensure user_roles row (preserve existing role if already set)
      const { data: existingRole, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleErr) return fail(roleErr);

      let role_assigned = existingRole?.role;
      if (!existingRole) {
        const { data: inserted, error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: "campaigner" })
          .select()
          .single();
        if (insErr) return fail(insErr);
        role_assigned = inserted.role;
      }

      // 3. Upsert campaigner_angkatan
      const { data: assignment, error: assignErr } = await supabase
        .from("campaigner_angkatan")
        .upsert(
          { user_id: user.id, angkatan },
          { onConflict: "user_id,angkatan" }
        )
        .select()
        .single();
      if (assignErr) return fail(assignErr);

      return ok({
        user_id: user.id,
        email: user.email,
        auth_user_created: created,
        invited: created && sendInvite,
        password_set: passwordSet,
        role: role_assigned,
        role_preserved: Boolean(existingRole) && existingRole.role !== "campaigner",
        angkatan_assignment: assignment,
      });
    },
  },
  {
    name: "seed_from_rows",
    description:
      "Bulk idempotent upsert of form submissions: given rows of {nama, nosis, wa} for a target angkatan, match each to alumni by normalized name (primary) or NOSIS (fallback), then update/insert members with no_hp and optionally flag fields. Mirrors the TN 23 DPT verification pipeline.",
    inputSchema: {
      type: "object",
      required: ["angkatan", "rows"],
      properties: {
        angkatan: { type: "integer", minimum: 1, maximum: 33 },
        set_isi_form_dpt_sudah: { type: "boolean", default: false },
        set_registrasi_website_dpt_sudah: { type: "boolean", default: false },
        rows: {
          type: "array",
          items: {
            type: "object",
            required: ["nama"],
            properties: {
              nama: { type: "string" },
              nosis: { type: ["string", "null"] },
              wa: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    handler: async (args) => {
      const flags = {};
      if (args.set_isi_form_dpt_sudah) flags.isi_form_dpt = "Sudah";
      if (args.set_registrasi_website_dpt_sudah) flags.registrasi_website_dpt = "Sudah";

      const { data: alumni, error: e1 } = await supabase
        .from("alumni")
        .select("id, nosis, nama")
        .eq("angkatan", args.angkatan);
      if (e1) return fail(e1);

      const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, " ");
      const byName = new Map(alumni.map((a) => [norm(a.nama), a]));
      const byNosis = new Map(alumni.filter((a) => a.nosis).map((a) => [a.nosis, a]));

      const { data: members, error: e2 } = await supabase
        .from("members")
        .select("id, nama, alumni_id")
        .eq("angkatan", args.angkatan);
      if (e2) return fail(e2);
      const memByAlumni = new Map(members.filter((m) => m.alumni_id).map((m) => [m.alumni_id, m]));
      const memByName = new Map(members.map((m) => [norm(m.nama), m]));

      const { data: maxRow, error: e3 } = await supabase
        .from("members")
        .select("no")
        .order("no", { ascending: false })
        .limit(1);
      if (e3) return fail(e3);
      let nextNo = (maxRow?.[0]?.no ?? 0) + 1;

      const report = { resolved: 0, unresolved: [], updated: 0, inserted: 0, errors: [] };

      for (const r of args.rows) {
        const nm = norm(r.nama);
        // Match alumni: name first (primary key per DB), NOSIS fallback
        let alu = byName.get(nm);
        if (!alu && r.nosis) alu = byNosis.get(String(r.nosis).trim());
        if (!alu) {
          report.unresolved.push({ nama: r.nama, nosis: r.nosis || null });
          continue;
        }
        report.resolved++;

        // Find or create member
        let mem = memByAlumni.get(alu.id) || memByName.get(norm(alu.nama));
        const wa = r.wa ? String(r.wa).trim() : "";
        if (mem) {
          const patch = { alumni_id: alu.id, ...flags };
          if (wa) patch.no_hp = wa;
          if (norm(mem.nama) !== norm(alu.nama)) patch.nama = alu.nama;
          const { error } = await supabase.from("members").update(patch).eq("id", mem.id);
          if (error) report.errors.push({ nama: r.nama, error: error.message });
          else report.updated++;
        } else {
          const payload = {
            no: nextNo++,
            nama: alu.nama,
            angkatan: args.angkatan,
            no_hp: wa || "",
            alumni_id: alu.id,
            ...flags,
          };
          const { error } = await supabase.from("members").insert(payload);
          if (error) {
            report.errors.push({ nama: r.nama, error: error.message });
            nextNo--;
          } else {
            report.inserted++;
          }
        }
      }
      return ok(report);
    },
  },
];

// ---------------------------------------------------------------------------
// MCP plumbing
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "vote-campaign", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) return fail(`Unknown tool: ${req.params.name}`);
  try {
    return await tool.handler(req.params.arguments || {});
  } catch (e) {
    return fail(e);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
