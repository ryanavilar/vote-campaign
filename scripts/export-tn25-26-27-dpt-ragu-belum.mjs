/**
 * Export TN25/26/27 yg sudah DPT (status_dpt=Sudah):
 *   Sheet 1: dukungan='ragu_ragu'
 *   Sheet 2: dukungan=null (belum tau mau kemana)
 */
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchTn(ang) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('members')
      .select('id, nama, angkatan, alumni_id, no_hp, dukungan, isi_form_dpt, registrasi_website_dpt, status_dpt, alumni(nosis, nama)')
      .eq('angkatan', ang)
      .eq('status_dpt', 'Sudah')
      .not('is_non_alumni', 'is', true)
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const allRows = { ragu: [], kosong: [] };
for (const ang of [25, 26, 27]) {
  const rows = await fetchTn(ang);
  console.log(`TN${ang}: total DPT Sudah = ${rows.length}`);
  for (const m of rows) {
    const r = {
      TN: ang,
      NOSIS: m.alumni?.nosis || '-',
      Nama: m.nama || m.alumni?.nama || '?',
      'No HP': m.no_hp || '-',
      Dukungan: m.dukungan || '(kosong)',
      'Form DPT': m.isi_form_dpt || '-',
      'Web DPT': m.registrasi_website_dpt || '-',
      'Status DPT': m.status_dpt || '-',
    };
    if (m.dukungan === 'ragu_ragu') allRows.ragu.push(r);
    else if (!m.dukungan) allRows.kosong.push(r);
  }
}

allRows.ragu.sort((a, b) => a.TN - b.TN || a.Nama.localeCompare(b.Nama));
allRows.kosong.sort((a, b) => a.TN - b.TN || a.Nama.localeCompare(b.Nama));
console.log(`\nRagu-ragu: ${allRows.ragu.length} | Belum tau (kosong): ${allRows.kosong.length}`);

const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.json_to_sheet(allRows.ragu);
ws1['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, ws1, 'DPT Ragu-ragu');
const ws2 = XLSX.utils.json_to_sheet(allRows.kosong);
ws2['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, ws2, 'DPT Belum Tau');

const out = '/tmp/TN25-26-27_DPT_Ragu_BelumTau.xlsx';
XLSX.writeFile(wb, out);
console.log(`\n→ Written: ${out}`);
