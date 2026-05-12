/**
 * 7 alumni TN16 yang dukung 01 sejak blusukan 2026-05-09 malam
 * Source: chat user 2026-05-10
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const alumniIds = [
  { name: 'Faisal Zakharias Baharsyah',     id: 'f22d42fc-a418-4e53-9475-c5c882c6cd05' },
  { name: 'Farouk Ashadi Haiti',             id: '31604094-b5b4-4d3d-b517-a4379016839c' },
  { name: 'Hubertus Bintang Mahendriya',     id: '7d3b23d4-b5b8-4810-8cd7-a377544efc16' },
  { name: 'Putri Nur Madiyan Sari',          id: '08c2b3e6-027b-40d8-8e10-4c18e1edb349' },
  { name: 'Ryan Putera Pratama Manafe',      id: '2c25d185-1f40-4f79-90cc-bad254425f4b' },
  { name: 'Soritua Adelbert Evangel Hutagalung', id: '699b60d5-9322-417a-815e-734a346e686a' },
  { name: 'Ustica Haedy Riastuti',           id: '4153fc4e-f25d-403a-b717-778e5009fe8a' },
];

let updated = 0, created = 0, sameAlready = 0, errs = 0;

// Get next member.no for any creates
async function nextNo() {
  const { data } = await sb.from('members').select('no').order('no', { ascending: false }).limit(1).single();
  return (data?.no ?? 0) + 1;
}
let nNo = null;

for (const a of alumniIds) {
  const { data: existing } = await sb
    .from('members')
    .select('id, nama, dukungan')
    .eq('alumni_id', a.id)
    .maybeSingle();

  if (existing) {
    if (existing.dukungan === 'dukung') {
      console.log(`= ${a.name} already dukung`);
      sameAlready++;
      continue;
    }
    const { error } = await sb.from('members').update({ dukungan: 'dukung' }).eq('id', existing.id);
    if (error) { errs++; console.error(`❌ update ${a.name}: ${error.message}`); continue; }
    updated++;
    console.log(`✓ updated ${a.name} → dukung`);
  } else {
    if (nNo === null) nNo = await nextNo();
    const row = {
      no: nNo++,
      alumni_id: a.id,
      nama: a.name,
      angkatan: 16,
      no_hp: '-',
      dukungan: 'dukung',
      sudah_dikontak: 'Belum',
      masuk_grup: 'Belum',
      isi_form_dpt: 'Belum',
      registrasi_website_dpt: 'Belum',
      status_dpt: null,
      vote: 'Belum',
    };
    const { error } = await sb.from('members').insert(row);
    if (error) { errs++; console.error(`❌ create ${a.name}: ${error.message}`); continue; }
    created++;
    console.log(`+ created ${a.name} as dukung`);
  }
}

console.log(`\nUpdated: ${updated}, Created: ${created}, AlreadyDukung: ${sameAlready}, Errors: ${errs}`);
