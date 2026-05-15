/**
 * Form DPT batch (12 Mei 2026):
 *   TN29 PDF (parse) + TN32 xlsx — update no_hp + isi_form_dpt='Sudah' for Valid rows.
 *   Match by NOSIS; create member if alumni exists tapi blm punya member.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');

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

// --- Parsers ---
function parseFormXlsx(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
  const valid = rows.filter(r => String(r.Validate || '').trim().toLowerCase() === 'valid');
  const out = [];
  for (const r of valid) {
    const nosisRaw = r['NOSIS (penulisan tanpa spasi e.g: 999999)'];
    const namaRaw = r['Nama Lengkap'];
    const hpRaw = r['Nomor WhatsApp yang terdaftar di Grup Angkatan'];
    const nosis = nn(nosisRaw);
    if (!nosis) continue;
    out.push({ nosis, nama: String(namaRaw || '').trim(), hp: normPhone(hpRaw) });
  }
  return { total: rows.length, valid: valid.length, entries: out };
}

function parseFormPdf(textPath) {
  const lines = readFileSync(textPath, 'utf8').split('\n');
  const out = [];
  let total = 0, valid = 0, notValid = 0;
  for (const line of lines) {
    const m = line.match(/^\s*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+(.+?)\s{2,}([0-9]{6,})\s+(\+?[\d]+)\s+.+?\s+(Valid|NOT Valid)\s*$/);
    if (!m) continue;
    total++;
    if (m[4].toLowerCase() === 'valid') {
      valid++;
      out.push({ nosis: nn(m[2]), nama: m[1].trim(), hp: normPhone(m[3]) });
    } else { notValid++; }
  }
  return { total, valid, notValid, entries: out };
}

async function processAng(ang, entries) {
  console.log(`\n=== TN${ang} ===`);
  const alumni = await fetchAllPaged('alumni', q => q.select('id, nosis, nama, angkatan').eq('angkatan', ang));
  const members = await fetchAllPaged('members', q => q.select('id, alumni_id, nama, no_hp, isi_form_dpt').eq('angkatan', ang));
  const alumByNosis = new Map(alumni.map(a => [nn(a.nosis), a]));
  const alumByName = new Map(alumni.map(a => [normName(a.nama), a]));
  const memByAlumniId = new Map(members.filter(m => m.alumni_id).map(m => [m.alumni_id, m]));

  const toCreateMembers = [];
  const toUpdateMembers = [];
  const unmatched = [];

  for (const e of entries) {
    let a = alumByNosis.get(e.nosis);
    if (!a && e.nama) {
      a = alumByName.get(normName(e.nama));
    }
    if (!a) { unmatched.push(e); continue; }
    const existing = memByAlumniId.get(a.id);
    if (!existing) {
      toCreateMembers.push({
        alumni_id: a.id, nama: a.nama, angkatan: ang, no_hp: e.hp || '-',
        isi_form_dpt: 'Sudah', registrasi_website_dpt: 'Belum', status_dpt: null,
        sudah_dikontak: 'Belum', masuk_grup: 'Belum', vote: 'Belum', dukungan: null,
      });
    } else {
      const patch = {};
      if (existing.isi_form_dpt !== 'Sudah') patch.isi_form_dpt = 'Sudah';
      if (e.hp) {
        const cur = (existing.no_hp || '').replace(/[^\d]/g, '');
        const nxt = e.hp.replace(/[^\d]/g, '');
        if (cur !== nxt) patch.no_hp = e.hp;
      }
      if (Object.keys(patch).length) toUpdateMembers.push({ id: existing.id, patch });
    }
  }

  const hpUpd = toUpdateMembers.filter(u => u.patch.no_hp).length;
  const formUpd = toUpdateMembers.filter(u => u.patch.isi_form_dpt).length;
  console.log(`  entries: ${entries.length} | unmatched: ${unmatched.length}`);
  console.log(`  create: ${toCreateMembers.length} | update: ${toUpdateMembers.length} (HP=${hpUpd}, Form=${formUpd})`);
  if (unmatched.length) for (const u of unmatched) console.log(`    unmatched: ${u.nosis} "${u.nama}"`);
  if (!APPLY) return;

  const { data: maxNo } = await sb.from('members').select('no').order('no', { ascending: false }).limit(1).single();
  let nextNo = (maxNo?.no ?? 0) + 1;
  let cM=0, cU=0, errs=0;
  for (const m of toCreateMembers) {
    const { error } = await sb.from('members').insert({ no: nextNo++, ...m });
    if (error) { errs++; console.error('create err', m.nama, error.message); } else cM++;
  }
  for (const u of toUpdateMembers) {
    const { error } = await sb.from('members').update(u.patch).eq('id', u.id);
    if (error) { errs++; console.error('update err', error.message); } else cU++;
  }
  console.log(`  → applied: created=${cM}, updated=${cU}, errors=${errs}`);
}

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

// TN29 PDF
const tn29 = parseFormPdf('/tmp/tn29-pdf.txt');
console.log(`\nTN29 PDF: rows=${tn29.total}, valid=${tn29.valid}, not_valid=${tn29.notValid}, entries=${tn29.entries.length}`);
await processAng(29, tn29.entries);

// TN32 xlsx
const tn32 = parseFormXlsx('/home/ubuntu/.claude/channels/telegram/inbox/1778567197249-AgADxx0AAsWFGVQ.xlsx');
console.log(`\nTN32 xlsx: rows=${tn32.total}, valid=${tn32.valid}, entries=${tn32.entries.length}`);
await processAng(32, tn32.entries);

if (!APPLY) console.log('\n→ --apply');
