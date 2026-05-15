/**
 * TN33 Form DPT xlsx (12 Mei 2026):
 *   For each Valid row: update no_hp from WA column, set isi_form_dpt='Sudah'.
 *   Match by NOSIS. Create member if alumni exists tapi belum ada member.
 *   Unmatched NOSIS → name-fallback.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const ANG = 33;
const XLSX_PATH = '/home/ubuntu/.claude/channels/telegram/inbox/1778566707593-AgADwR0AAsWFGVQ.xlsx';

const nn = (s) => { const d = String(s ?? '').replace(/\D+/g, ''); return d ? (d.length < 6 ? d.padStart(6, '0') : d) : ''; };
const normPhone = (p) => {
  if (!p) return null;
  let s = String(p).replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0')) s = '62' + s.slice(1);
  if (!s.startsWith('62') && s.startsWith('8')) s = '62' + s;
  return s || null;
};
const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

const wb = XLSX.read(readFileSync(XLSX_PATH), { type: 'buffer' });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
const valid = rows.filter(r => String(r.Validate || '').trim().toLowerCase() === 'valid');
console.log(`Total: ${rows.length}, Valid: ${valid.length}, NOT Valid: ${rows.length - valid.length}`);

const formEntries = [];
for (const r of valid) {
  const nosis = nn(r['NOSIS (penulisan tanpa spasi e.g: 999999)']);
  const nama = String(r['Nama Lengkap'] || '').trim();
  const hp = normPhone(r['Nomor WhatsApp yang terdaftar di Grup Angkatan']);
  if (!nosis) continue;
  formEntries.push({ nosis, nama, hp });
}
console.log(`Valid entries with NOSIS: ${formEntries.length}`);

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

const alumni = await fetchAllPaged('alumni', q => q.select('id, nosis, nama, angkatan').eq('angkatan', ANG));
const members = await fetchAllPaged('members', q => q.select('id, alumni_id, nama, no_hp, isi_form_dpt').eq('angkatan', ANG));
console.log(`TN${ANG} alumni: ${alumni.length}, members: ${members.length}`);

const alumByNosis = new Map(alumni.map(a => [nn(a.nosis), a]));
const alumByName = new Map(alumni.map(a => [normName(a.nama), a]));
const memByAlumniId = new Map(members.filter(m => m.alumni_id).map(m => [m.alumni_id, m]));

const toCreateMembers = [];
const toUpdateMembers = [];
const unmatched = [];
const nameRemap = [];

for (const e of formEntries) {
  let a = alumByNosis.get(e.nosis);
  if (!a && e.nama) {
    a = alumByName.get(normName(e.nama));
    if (a) nameRemap.push({ typedNosis: e.nosis, realNosis: a.nosis, nama: e.nama });
  }
  if (!a) {
    unmatched.push(e);
    continue;
  }
  const existing = memByAlumniId.get(a.id);
  if (!existing) {
    toCreateMembers.push({
      alumni_id: a.id, nama: a.nama, angkatan: ANG, no_hp: e.hp || '-',
      isi_form_dpt: 'Sudah', registrasi_website_dpt: 'Belum', status_dpt: null,
      sudah_dikontak: 'Belum', masuk_grup: 'Belum', vote: 'Belum', dukungan: null,
    });
  } else {
    const patch = {};
    if (existing.isi_form_dpt !== 'Sudah') patch.isi_form_dpt = 'Sudah';
    if (e.hp && existing.no_hp !== e.hp && existing.no_hp !== '+' + e.hp) {
      // Only update if existing is empty/dash/different
      const cur = (existing.no_hp || '').replace(/[^\d]/g, '');
      const nxt = e.hp.replace(/[^\d]/g, '');
      if (cur !== nxt) patch.no_hp = e.hp;
    }
    if (Object.keys(patch).length) toUpdateMembers.push({ id: existing.id, nama: existing.nama, oldHp: existing.no_hp, patch });
  }
}

if (nameRemap.length) console.log(`\nName-remap (typo tolerance): ${nameRemap.length}`); nameRemap.forEach(r => console.log(`  ${r.typedNosis} "${r.nama}" → real NOSIS ${r.realNosis}`));
if (unmatched.length) {
  console.log(`\nUnmatched NOSIS (no alumni, no name match): ${unmatched.length}`);
  for (const u of unmatched) console.log(`  ${u.nosis} "${u.nama}" HP=${u.hp}`);
}
console.log(`\nPlan:`);
console.log(`  members create: ${toCreateMembers.length}`);
console.log(`  members update: ${toUpdateMembers.length}`);
const hpUpd = toUpdateMembers.filter(u => u.patch.no_hp).length;
const formUpd = toUpdateMembers.filter(u => u.patch.isi_form_dpt).length;
console.log(`    HP updates: ${hpUpd}`);
console.log(`    Form-flip: ${formUpd}`);

if (!APPLY) { console.log('\n→ --apply'); process.exit(0); }

let createdM = 0, updated = 0, errs = 0;

const { data: maxNo } = await sb.from('members').select('no').order('no', { ascending: false }).limit(1).single();
let nextNo = (maxNo?.no ?? 0) + 1;

for (const m of toCreateMembers) {
  const { error } = await sb.from('members').insert({ no: nextNo++, ...m });
  if (error) { errs++; console.error('create err', m.nama, error.message); continue; }
  createdM++;
}

for (const u of toUpdateMembers) {
  const { error } = await sb.from('members').update(u.patch).eq('id', u.id);
  if (error) { errs++; console.error('update err', u.nama, error.message); continue; }
  updated++;
}

console.log(`\n→ Applied: created=${createdM}, updated=${updated} (HP: ${hpUpd}, Form: ${formUpd}), errors=${errs}`);
