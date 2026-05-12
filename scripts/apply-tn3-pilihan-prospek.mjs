#!/usr/bin/env node
// Run with: node --env-file=.env.local scripts/apply-tn3-pilihan-prospek.mjs
import X from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const FILE = '/home/ubuntu/.claude/channels/telegram/inbox/1778410128366-AgADWCQAApQNAAFU.xlsx';
const ANGKATAN = 3;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE env');
  process.exit(1);
}
const sb = createClient(url, key);

const wb = X.readFile(FILE);
const ws = wb.Sheets['Alumni'];
const aoa = X.utils.sheet_to_json(ws, { header: 1, defval: '' });
const HEADER = aoa[1];
const rows = aoa.slice(2).map(r => {
  const o = {};
  HEADER.forEach((h, i) => { if (h) o[String(h).trim()] = r[i]; });
  return o;
}).filter(r => r['Nama Alumni'] && String(r['Nama Alumni']).trim());

const norm = v => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s;
};
const isOne = v => {
  const s = norm(v);
  if (!s) return false;
  if (s === '1' || s === '1.0' || s === 'TRUE' || s === 'true' || s === '✓' || s === 'Y' || s === 'y' || s === 'Ya' || s === 'ya') return true;
  const n = Number(s);
  return Number.isFinite(n) && n >= 1;
};

const pilihan = rows.filter(r => isOne(r['Pilihan']));
const prospek = rows.filter(r => isOne(r['Prospek']) && !isOne(r['Pilihan']));

console.log(`Pilihan=1 (→dukung): ${pilihan.length}`);
console.log(`Prospek=1 only (→ragu_ragu): ${prospek.length}`);

// Fetch all TN3 members (paginate)
async function fetchAllTn3() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('members')
      .select('id, nama, alumni_id, dukungan')
      .eq('angkatan', ANGKATAN)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Fetch all TN3 alumni for nosis lookup
async function fetchAllAlumniTn3() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('alumni')
      .select('id, nama, nosis')
      .eq('angkatan', ANGKATAN)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const members = await fetchAllTn3();
const alumni = await fetchAllAlumniTn3();
console.log(`TN3 members: ${members.length}, alumni: ${alumni.length}`);

const memberByAlumniId = new Map(members.filter(m => m.alumni_id).map(m => [m.alumni_id, m]));
const alumniByNosis = new Map(alumni.map(a => [norm(a.nosis), a]));

function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const memberByName = new Map(members.map(m => [normName(m.nama), m]));
const alumniByName = new Map(alumni.map(a => [normName(a.nama), a]));

function findMember(row) {
  const nosis = norm(row['Nosis']);
  const nama = String(row['Nama Alumni'] || '').trim();

  if (nosis) {
    const a = alumniByNosis.get(nosis);
    if (a) {
      const m = memberByAlumniId.get(a.id);
      if (m) return { m, via: 'nosis→alumni→member' };
    }
  }
  // fallback: name match
  const n = normName(nama);
  if (n) {
    const m = memberByName.get(n);
    if (m) return { m, via: 'name' };
    const a = alumniByName.get(n);
    if (a) {
      const m2 = memberByAlumniId.get(a.id);
      if (m2) return { m: m2, via: 'name→alumni→member' };
    }
  }
  return null;
}

async function applyUpdates(targetRows, dukungan) {
  const matched = [];
  const unmatched = [];
  for (const row of targetRows) {
    const r = findMember(row);
    if (r) matched.push({ row, m: r.m, via: r.via });
    else unmatched.push(row);
  }
  console.log(`  matched: ${matched.length}, unmatched: ${unmatched.length}`);
  if (unmatched.length) {
    console.log('  unmatched samples:');
    unmatched.slice(0, 20).forEach(u => console.log(`    - ${norm(u['Nosis'])} ${u['Nama Alumni']}`));
  }
  let changed = 0, sameAlready = 0;
  for (const { m } of matched) {
    if (m.dukungan === dukungan) { sameAlready++; continue; }
    const { error } = await sb.from('members').update({ dukungan }).eq('id', m.id);
    if (error) {
      console.error(`  error updating ${m.nama}:`, error.message);
      continue;
    }
    changed++;
  }
  console.log(`  changed: ${changed}, already: ${sameAlready}`);
  return { matched: matched.length, unmatched: unmatched.length, changed, sameAlready };
}

console.log('\n=== Apply Pilihan → dukung ===');
const r1 = await applyUpdates(pilihan, 'dukung');

console.log('\n=== Apply Prospek (only) → ragu_ragu ===');
const r2 = await applyUpdates(prospek, 'ragu_ragu');

console.log('\n=== SUMMARY ===');
console.log(`Pilihan: matched ${r1.matched}/${pilihan.length}, changed ${r1.changed}, already ${r1.sameAlready}`);
console.log(`Prospek: matched ${r2.matched}/${prospek.length}, changed ${r2.changed}, already ${r2.sameAlready}`);
