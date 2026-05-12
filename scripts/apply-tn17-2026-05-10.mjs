/**
 * TN17 update 2026-05-10:
 *   1. Form DPT xlsx (Valid only): set isi_form_dpt='Sudah', create member if missing.
 *   2. PDF DPT terverifikasi (NIS list): set status_dpt='Sudah' AND registrasi_website_dpt='Sudah'.
 *      Unmatched NOSIS → create alumni+member.
 *
 * Usage: node --env-file=.env.local scripts/apply-tn17-2026-05-10.mjs [--apply]
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const ANG = 17;

const XLSX_PATH = '/home/ubuntu/.claude/channels/telegram/inbox/1778415315429-AgADdyQAApQNAAFU.xlsx';
const PDF_NOSIS_PATH = '/tmp/tn17-pdf-nosis.txt';

function normNosis(s) {
  const d = String(s ?? '').replace(/\D+/g, '');
  if (!d) return '';
  return d.length < 6 ? d.padStart(6, '0') : d;
}
function normPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  if (s.startsWith('+')) s = s.slice(1);
  return s || null;
}

async function fetchAllPaged(table, q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(sb.from(table)).range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

// ---------- 1. xlsx Form DPT ----------
console.log('=== STEP 1: Form DPT xlsx (valid-only) ===');
const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Form responses 1'], { defval: null, raw: false });
const valid = rows.filter(r => String(r.Validate || '').trim().toLowerCase() === 'valid');
console.log(`Total: ${rows.length}, valid: ${valid.length}`);

const phoneByNosis = new Map();
const nameByNosis = new Map();
const formNosisSet = new Set();
for (const r of valid) {
  const n = normNosis(r['NOSIS (penulisan tanpa spasi e.g: 999999)']);
  if (!n) continue;
  formNosisSet.add(n);
  const p = normPhone(r['Nomor WhatsApp yang terdaftar di Grup Angkatan']);
  if (p && !phoneByNosis.has(n)) phoneByNosis.set(n, p);
  const nm = String(r['Nama Lengkap'] || '').trim();
  if (nm && !nameByNosis.has(n)) nameByNosis.set(n, nm);
}
const formNosisList = [...formNosisSet];
console.log(`Unique valid NOSIS: ${formNosisList.length}`);

// ---------- 2. PDF NOSIS (DPT terverifikasi) ----------
console.log('\n=== STEP 2: PDF DPT terverifikasi NOSIS ===');
const pdfNosisRaw = readFileSync(PDF_NOSIS_PATH, 'utf8').split('\n').map(s => s.trim()).filter(Boolean).map(normNosis);
const pdfNosisSet = new Set(pdfNosisRaw);
console.log(`PDF NOSIS unique: ${pdfNosisSet.size}`);

// ---------- 3. Fetch existing alumni & members for TN17 ----------
const alumniTn17 = await fetchAllPaged('alumni', q => q.select('id, nosis, nama, angkatan').eq('angkatan', ANG));
const memTn17 = await fetchAllPaged('members', q => q.select('id, alumni_id, nama, no_hp, isi_form_dpt, registrasi_website_dpt, status_dpt').eq('angkatan', ANG));
console.log(`TN17 alumni: ${alumniTn17.length}, members: ${memTn17.length}`);

const alumByNosis = new Map(alumniTn17.map(a => [normNosis(a.nosis), a]));
const memByAlumniId = new Map(memTn17.filter(m => m.alumni_id).map(m => [m.alumni_id, m]));

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const alumByName = new Map(alumniTn17.map(a => [normName(a.nama), a]));

// Resolve form NOSIS by name fallback for unmatched entries (typo tolerance)
const nosisRemap = new Map(); // typedNosis -> actualNosis
for (const nosis of formNosisSet) {
  if (alumByNosis.has(nosis)) continue;
  const nm = nameByNosis.get(nosis);
  if (!nm) continue;
  const a = alumByName.get(normName(nm));
  if (a) {
    const realNosis = normNosis(a.nosis);
    nosisRemap.set(nosis, realNosis);
    console.log(`  name-remap: NOSIS "${nosis}" "${nm}" → ${realNosis} "${a.nama}"`);
  }
}
// Apply remap: replace in formNosisSet, phoneByNosis, nameByNosis
for (const [bad, good] of nosisRemap.entries()) {
  formNosisSet.delete(bad);
  formNosisSet.add(good);
  if (phoneByNosis.has(bad)) {
    if (!phoneByNosis.has(good)) phoneByNosis.set(good, phoneByNosis.get(bad));
    phoneByNosis.delete(bad);
  }
  if (nameByNosis.has(bad)) {
    if (!nameByNosis.has(good)) nameByNosis.set(good, nameByNosis.get(bad));
    nameByNosis.delete(bad);
  }
}

// Combined NOSIS we care about (use remapped formNosisSet, not stale formNosisList)
const allNosis = new Set([...formNosisSet, ...pdfNosisSet]);
const unmatchedNosis = [...allNosis].filter(n => !alumByNosis.has(n));
console.log(`Unmatched NOSIS (need new alumni): ${unmatchedNosis.length}`);
if (unmatchedNosis.length) console.log('  ', unmatchedNosis.join(', '));

// Determine ops
const toCreateAlumni = [];   // for unmatched NOSIS
const toCreateMembers = [];  // alumni without member
const toUpdateMembers = [];  // {id, patch}

// We'll build a map of "intended state" per alumni nosis
function intendedState(nosis) {
  const inForm = formNosisSet.has(nosis);
  const inPdf = pdfNosisSet.has(nosis);
  const patch = {};
  if (inForm) patch.isi_form_dpt = 'Sudah';
  if (inPdf) {
    patch.registrasi_website_dpt = 'Sudah';
    patch.status_dpt = 'Sudah';
  }
  return { inForm, inPdf, patch };
}

// Plan for unmatched NOSIS — create alumni + member
for (const nosis of unmatchedNosis) {
  const nm = nameByNosis.get(nosis) || `Unknown TN17 ${nosis}`;
  toCreateAlumni.push({ nosis, nama: nm, angkatan: ANG });
}

// Plan for matched alumni
for (const nosis of allNosis) {
  if (unmatchedNosis.includes(nosis)) continue;
  const a = alumByNosis.get(nosis);
  const { patch } = intendedState(nosis);
  const existing = memByAlumniId.get(a.id);
  if (!existing) {
    // create member
    toCreateMembers.push({
      alumni_id: a.id,
      nama: a.nama,
      angkatan: ANG,
      no_hp: phoneByNosis.get(nosis) || '-',
      isi_form_dpt: patch.isi_form_dpt || 'Belum',
      registrasi_website_dpt: patch.registrasi_website_dpt || 'Belum',
      status_dpt: patch.status_dpt || null,
      sudah_dikontak: 'Belum',
      masuk_grup: 'Belum',
      vote: 'Belum',
      dukungan: null,
    });
  } else {
    // update if differs
    const changes = {};
    for (const [k, v] of Object.entries(patch)) {
      if (existing[k] !== v) changes[k] = v;
    }
    if (Object.keys(changes).length) {
      toUpdateMembers.push({ id: existing.id, nama: existing.nama, changes });
    }
  }
}

console.log(`\nPlan:`);
console.log(`  alumni to create: ${toCreateAlumni.length}`);
console.log(`  members to create (existing alumni): ${toCreateMembers.length}`);
console.log(`  members to update: ${toUpdateMembers.length}`);

if (!APPLY) {
  console.log('\n→ Re-run with --apply to write.');
  process.exit(0);
}

// ---------- APPLY ----------
let createdA = 0, createdM = 0, updated = 0, errs = 0;

// 1. Create alumni for unmatched NOSIS
const newAlumniIdByNosis = new Map();
if (toCreateAlumni.length) {
  console.log('\nCreating alumni...');
  for (const a of toCreateAlumni) {
    const { data, error } = await sb.from('alumni').insert(a).select('id, nosis').single();
    if (error) { errs++; console.error(`  ❌ alumni ${a.nosis} ${a.nama}: ${error.message}`); continue; }
    createdA++;
    newAlumniIdByNosis.set(a.nosis, data.id);
  }
}

// 2. Get next member.no
const { data: maxNo } = await sb.from('members').select('no').order('no', { ascending: false }).limit(1).single();
let nextNo = (maxNo?.no ?? 0) + 1;

// 3. For new alumni: create members
for (const nosis of newAlumniIdByNosis.keys()) {
  const a = toCreateAlumni.find(x => x.nosis === nosis);
  const aid = newAlumniIdByNosis.get(nosis);
  const { patch } = intendedState(nosis);
  const row = {
    no: nextNo++,
    alumni_id: aid,
    nama: a.nama,
    angkatan: ANG,
    no_hp: phoneByNosis.get(nosis) || '-',
    isi_form_dpt: patch.isi_form_dpt || 'Belum',
    registrasi_website_dpt: patch.registrasi_website_dpt || 'Belum',
    status_dpt: patch.status_dpt || null,
    sudah_dikontak: 'Belum',
    masuk_grup: 'Belum',
    vote: 'Belum',
    dukungan: null,
  };
  const { error } = await sb.from('members').insert(row);
  if (error) { errs++; console.error(`  ❌ member ${a.nosis} ${a.nama}: ${error.message}`); continue; }
  createdM++;
}

// 4. Create members for existing alumni without member
for (const m of toCreateMembers) {
  const row = { no: nextNo++, ...m };
  const { error } = await sb.from('members').insert(row);
  if (error) { errs++; console.error(`  ❌ member ${m.nama}: ${error.message}`); continue; }
  createdM++;
}

// 5. Update existing members
for (const u of toUpdateMembers) {
  const { error } = await sb.from('members').update(u.changes).eq('id', u.id);
  if (error) { errs++; console.error(`  ❌ update ${u.nama}: ${error.message}`); continue; }
  updated++;
}

console.log(`\n→ Applied: createdAlumni=${createdA}, createdMembers=${createdM}, updated=${updated}, errors=${errs}`);
