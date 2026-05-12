/**
 * TN30 DPT terverifikasi PDF (11 Mei 2026):
 *   Set status_dpt='Sudah' AND registrasi_website_dpt='Sudah' for each NIS.
 *   Unmatched NOSIS → auto-create alumni + member.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const ANG = 30;
const PDF_NOSIS_PATH = '/tmp/tn30-pdf-nosis.txt';

const nn = (s) => { const d = String(s ?? '').replace(/\D+/g, ''); return d ? (d.length < 6 ? d.padStart(6, '0') : d) : ''; };

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

const nosisList = readFileSync(PDF_NOSIS_PATH, 'utf8').split('\n').map(s => s.trim()).filter(Boolean).map(nn);
const nosisSet = new Set(nosisList);
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\nPDF NOSIS: ${nosisSet.size}`);

const alumni = await fetchAllPaged('alumni', q => q.select('id, nosis, nama, angkatan').eq('angkatan', ANG));
const members = await fetchAllPaged('members', q => q.select('id, alumni_id, nama, isi_form_dpt, registrasi_website_dpt, status_dpt').eq('angkatan', ANG));

const alumByNosis = new Map(alumni.map(a => [nn(a.nosis), a]));
const memByAlumniId = new Map(members.filter(m => m.alumni_id).map(m => [m.alumni_id, m]));

const unmatchedNosis = [...nosisSet].filter(n => !alumByNosis.has(n));
console.log(`Unmatched NOSIS (need new alumni): ${unmatchedNosis.length}`);
if (unmatchedNosis.length) console.log(' ', unmatchedNosis.join(', '));

const toCreateAlumni = unmatchedNosis.map(n => ({ nosis: n, nama: `Unknown TN${ANG} ${n}`, angkatan: ANG }));
const toCreateMembers = [];
const toUpdateMembers = [];

for (const nosis of nosisSet) {
  if (unmatchedNosis.includes(nosis)) continue;
  const a = alumByNosis.get(nosis);
  const existing = memByAlumniId.get(a.id);
  if (!existing) {
    toCreateMembers.push({
      alumni_id: a.id, nama: a.nama, angkatan: ANG, no_hp: '-',
      isi_form_dpt: 'Sudah',
      registrasi_website_dpt: 'Sudah',
      status_dpt: 'Sudah',
      sudah_dikontak: 'Belum', masuk_grup: 'Belum', vote: 'Belum', dukungan: null,
    });
  } else {
    const patch = {};
    if (existing.registrasi_website_dpt !== 'Sudah') patch.registrasi_website_dpt = 'Sudah';
    if (existing.status_dpt !== 'Sudah') patch.status_dpt = 'Sudah';
    if (existing.isi_form_dpt !== 'Sudah') patch.isi_form_dpt = 'Sudah';
    if (Object.keys(patch).length) toUpdateMembers.push({ id: existing.id, nama: existing.nama, changes: patch });
  }
}

console.log(`Plan:`);
console.log(`  alumni create: ${toCreateAlumni.length}`);
console.log(`  members create: ${toCreateMembers.length}`);
console.log(`  members update: ${toUpdateMembers.length}`);

if (!APPLY) { console.log('\n→ --apply'); process.exit(0); }

let createdA = 0, createdM = 0, updated = 0, errs = 0;
const newAlumniIdByNosis = new Map();

for (const a of toCreateAlumni) {
  const { data, error } = await sb.from('alumni').insert(a).select('id').single();
  if (error) { errs++; console.error('alumni err', a.nosis, error.message); continue; }
  createdA++;
  newAlumniIdByNosis.set(a.nosis, data.id);
}

const { data: maxNo } = await sb.from('members').select('no').order('no', { ascending: false }).limit(1).single();
let nextNo = (maxNo?.no ?? 0) + 1;

for (const nosis of newAlumniIdByNosis.keys()) {
  const a = toCreateAlumni.find(x => x.nosis === nosis);
  const aid = newAlumniIdByNosis.get(nosis);
  const row = { no: nextNo++, alumni_id: aid, nama: a.nama, angkatan: ANG, no_hp: '-', isi_form_dpt: 'Sudah', registrasi_website_dpt: 'Sudah', status_dpt: 'Sudah', sudah_dikontak: 'Belum', masuk_grup: 'Belum', vote: 'Belum', dukungan: null };
  const { error } = await sb.from('members').insert(row);
  if (error) { errs++; console.error('member err', a.nosis, error.message); continue; }
  createdM++;
}

for (const m of toCreateMembers) {
  const row = { no: nextNo++, ...m };
  const { error } = await sb.from('members').insert(row);
  if (error) { errs++; console.error('create err', m.nama, error.message); continue; }
  createdM++;
}

for (const u of toUpdateMembers) {
  const { error } = await sb.from('members').update(u.changes).eq('id', u.id);
  if (error) { errs++; console.error('update err', u.nama, error.message); continue; }
  updated++;
}

console.log(`\n→ Applied: createdAlumni=${createdA}, createdMembers=${createdM}, updated=${updated}, errors=${errs}`);
