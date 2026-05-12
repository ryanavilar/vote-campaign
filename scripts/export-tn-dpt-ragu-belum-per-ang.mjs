/**
 * Per-angkatan export: TN25/26/27 yg sudah DPT (status_dpt=Sudah)
 *   Sheet 1: dukungan='ragu_ragu'
 *   Sheet 2: dukungan=null (belum tau mau kemana)
 * One file per angkatan.
 */
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

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

const COLS = [
  { wch: 10 }, // NOSIS
  { wch: 35 }, // Nama
  { wch: 16 }, // No HP
  { wch: 14 }, // Dukungan
  { wch: 10 }, // Form
  { wch: 10 }, // Web
];

for (const ang of [25, 26, 27]) {
  const rows = await fetchTn(ang);
  const ragu = [], kosong = [];
  for (const m of rows) {
    const r = {
      NOSIS: m.alumni?.nosis || '-',
      Nama: m.nama || m.alumni?.nama || '?',
      'No HP': m.no_hp || '-',
      Dukungan: m.dukungan || '(kosong)',
      'Form DPT': m.isi_form_dpt || '-',
      'Web DPT': m.registrasi_website_dpt || '-',
    };
    if (m.dukungan === 'ragu_ragu') ragu.push(r);
    else if (!m.dukungan) kosong.push(r);
  }
  ragu.sort((a, b) => a.Nama.localeCompare(b.Nama));
  kosong.sort((a, b) => a.Nama.localeCompare(b.Nama));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(ragu);
  ws1['!cols'] = COLS;
  XLSX.utils.book_append_sheet(wb, ws1, 'DPT Ragu-ragu');
  const ws2 = XLSX.utils.json_to_sheet(kosong);
  ws2['!cols'] = COLS;
  XLSX.utils.book_append_sheet(wb, ws2, 'DPT Belum Tau');

  const out = `/tmp/TN${ang}_DPT_Ragu_BelumTau.xlsx`;
  XLSX.writeFile(wb, out);
  console.log(`TN${ang}: ragu=${ragu.length}, belum=${kosong.length} → ${out}`);
}
