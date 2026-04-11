/**
 * Backfill form_submissions from existing members data.
 *
 * Strategy:
 * 1. Members NOT from the initial seed (created_at != '2026-02-11 16:06:36.286884+00')
 *    are treated as form entries — they came through /form/dukungan.
 * 2. Seeded members that have form-specific fields (email, domisili, harapan)
 *    are ALSO included — they were updated via the form after being seeded.
 *    For these, we use their `updated_at` as the submission time.
 *
 * All entries are logged as type: "dukungan" since event registrations were bulk-seeded.
 */

/**
 * Usage: node --env-file=.env.local scripts/backfill-form-submissions.mjs
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SEED_TIMESTAMP = "2026-02-11 16:06:36.286884+00";

async function backfill() {
  // 1. Get all non-seeded members (came through form)
  const { data: formMembers, error: e1 } = await supabase
    .from("members")
    .select("id, nama, angkatan, no_hp, email, domisili, harapan, referral_name, created_at")
    .not("is_non_alumni", "is", true)
    .neq("created_at", SEED_TIMESTAMP)
    .order("created_at", { ascending: true });

  if (e1) {
    console.error("Error fetching form members:", e1.message);
    process.exit(1);
  }

  // 2. Get seeded members that were later updated via form (have email/domisili/harapan)
  const { data: updatedSeeded, error: e2 } = await supabase
    .from("members")
    .select("id, nama, angkatan, no_hp, email, domisili, harapan, referral_name, created_at, updated_at")
    .eq("created_at", SEED_TIMESTAMP)
    .not("is_non_alumni", "is", true)
    .or("domisili.not.is.null,harapan.not.is.null");

  if (e2) {
    console.error("Error fetching updated seeded members:", e2.message);
    process.exit(1);
  }

  console.log(`Form members (non-seeded): ${formMembers.length}`);
  console.log(`Seeded members updated via form: ${updatedSeeded.length}`);

  // Check existing form_submissions to avoid duplicates
  const { count: existingCount } = await supabase
    .from("form_submissions")
    .select("*", { count: "exact", head: true });

  if (existingCount > 0) {
    console.log(`\nform_submissions already has ${existingCount} entries.`);
    console.log("Skipping backfill to avoid duplicates. Clear the table first if you want to re-run.");
    process.exit(0);
  }

  // Build submissions for non-seeded members
  const submissions = formMembers.map((m) => ({
    type: "dukungan",
    member_id: m.id,
    is_new_member: true,
    nama: m.nama,
    angkatan: m.angkatan,
    no_hp: m.no_hp || null,
    email: m.email || null,
    domisili: m.domisili || null,
    harapan: m.harapan || null,
    referral_name: m.referral_name || null,
    event_id: null,
    event_name: null,
    will_attend: null,
    ip_address: null,
    user_agent: null,
    created_at: m.created_at,
  }));

  // Build submissions for seeded members updated via form
  const seededSubmissions = updatedSeeded.map((m) => ({
    type: "dukungan",
    member_id: m.id,
    is_new_member: false, // They already existed (seeded)
    nama: m.nama,
    angkatan: m.angkatan,
    no_hp: m.no_hp || null,
    email: m.email || null,
    domisili: m.domisili || null,
    harapan: m.harapan || null,
    referral_name: m.referral_name || null,
    event_id: null,
    event_name: null,
    will_attend: null,
    ip_address: null,
    user_agent: null,
    created_at: m.updated_at || m.created_at,
  }));

  const allSubmissions = [...submissions, ...seededSubmissions];
  console.log(`\nTotal submissions to backfill: ${allSubmissions.length}`);

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < allSubmissions.length; i += BATCH_SIZE) {
    const batch = allSubmissions.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("form_submissions").insert(batch);

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`Inserted ${inserted}/${allSubmissions.length}`);
  }

  console.log(`\nBackfill complete. ${inserted} form submissions logged.`);
}

backfill();
