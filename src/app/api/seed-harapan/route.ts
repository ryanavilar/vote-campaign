import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Harapan data from "Daftar Dukungan Aditya Syarief-IKASTARA KITA (Responses).xlsx"
// 31 members with non-empty harapan values
const harapanData = [
  { email: "syamsulprasetya90@gmail.com", nama: "Syamsul Tamimi Prasetya Aji", harapan: "Semoga dapat terus berkembang kedepannya, dan mencetak orang-orang berkualitas yang dapat berkarya bagi bangsa dan negara" },
  { email: "mgo.andi@gmail.com", nama: "Muhammad Gustri Oktaviandi", harapan: "Bisa berkarya dan berkontribusi lebih untuk Indonesia" },
  { email: "lanceria87@gmail.com", nama: "Lanceria Sijabat", harapan: "Ikastara makin kompak dan merangkul semua elemen" },
  { email: "teofilusjosafat@gmail.com", nama: "Teofilus Josafat Dion Putra", harapan: "memperbanyak program olahraga bersama dan mentoring" },
  { email: "ddy298@gmail.com", nama: "Dedy Ardyansyah", harapan: "Semakin Menyala" },
  { email: "deltadua65@gmail.com", nama: "Arman Adi Wibowo", harapan: "Ikastara semakin inklusif" },
  { email: "budiakmil11@gmail.com", nama: "Untung Budi Wahyono", harapan: "Lebih memperhatikan teman-teman yang sedang membutuhkan pertolongan" },
  { email: "puguh.hasta@gmail.com", nama: "Puguh Hasta Gunawan", harapan: "bisa jadi sarana untuk kemajuan bersama baik personal maupun nasional" },
  { email: "prabowo.ario@gmail.com", nama: "Ario Prabowo", harapan: "menjadi wadah silaturahmi yg lebih hangat dan dekat ke seluruh anggota, dan bisa memberikan manfaat positif yang sebanyak2nya kepada masyarakat, bangsa & negara." },
  { email: "deni.kurniawan87@gmail.com", nama: "Deni Kurniawan", harapan: "Lebih saling merangkul sesama alumni" },
  { email: "rahmadia.adisti5@gmail.com", nama: "Rahmadia Adisti", harapan: "Semakin erat persaudaraan" },
  { email: "hesibarani@gmail.com", nama: "Hartoni Enrico", harapan: "link in masing masing obstacle profesi dan usaha pendekatan solusi" },
  { email: "saifuddinafif@gmail.com", nama: "Saifuddin Noor Afifi", harapan: "Asah asih asuh" },
  { email: "flora.tobing@gmail.com", nama: "Flora marlyna lumban tobing", harapan: "Satu suara tanpa agenda pribadi" },
  { email: "daeng.achmad.a@gmail.com", nama: "Daeng Achmad Ardiansyah", harapan: "Lebih solid, bisa menjaring dan menarik adek2nya" },
  { email: "bscwicaksono@gmail.com", nama: "Bimo Satriyo Condro Wicaksono", harapan: "Keputusan Allah adalah yg terbaik" },
  { email: "suyudhanto@gmail.com", nama: "Satriyo Untung Yudhanto", harapan: "Lebih kompak, lebih solid dan senantiasa memberikan karya terbaik untuk bangsa dan negara Indonesia" },
  { email: "dindutelegom@gmail.com", nama: "Andyka Kurniawan Sasongko", harapan: "Menjadi wadah untuk memperbaiki bangsa dan negara" },
  { email: "virayugana@gmail.com", nama: "Febrian Yugana Prasetya", harapan: "Lebih kompak , kuat dan maju" },
  { email: "faiz.erfin87@gmail.com", nama: "Faizunnur erfin", harapan: "Lebih solid" },
  { email: "yuyun.rindi@gmail.com", nama: "Yuyun rindiastuti", harapan: "Ikastara jaya" },
  { email: "pumelmelati@gmail.com", nama: "Putri Melati", harapan: "Semakin guyub, rukun, merangkul semua alumni. Saling mendukung" },
  { email: "adesita986@gmail.com", nama: "Sita Wijayanti, M.Si", harapan: "Diadakan selalu silaturahmi" },
  { email: "lydia.asri@yahoo.com", nama: "Lydia WKA", harapan: "Makin Rukun" },
  { email: "venomgalasa@gmail.com", nama: "Panji Agung Nugroho", harapan: "Semakin merangkul seluruh keluarga besar" },
  { email: "asepwashere@gmail.com", nama: "Albert Satria Purnama", harapan: "Semoga Ikastara tidak seperti cerita legenda Icarus" },
  { email: "herpow2087@gmail.com", nama: "Heri Purnomo", harapan: "Semoga Ikastara semakin maju & mengayomi anggota nya di seluruh penjuru dunia" },
  { email: "yoga_fathori@hotmail.com", nama: "Abdul Malik Yoga Fathori", harapan: "Dapat ikut berkontribusi aktif dalam kemajuan Ikastara dan memberi manfaat untuk semua" },
  { email: "aot.ta05@gmail.com", nama: "Alhadi Okta Triansyah", harapan: "Tingkatkan sinergi daerah dan pusat" },
  { email: "sangpengelana.anto@gmail.com", nama: "Yusuf", harapan: "Semakin membumi, melayani dan menjembatani" },
  { email: "muuhammadsamy1012@gmail.com", nama: "Muhammad Samy", harapan: "Ikastara tidak hanya menjadi organisasi yang pragmatis bagi para anggotanya, namun juga menjadi organisasi yang normatif/norms-based berdasarkan nilai-nilai SMA TN untuk menciptakan dan mendorong kebaikan publik" },
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const seedKey = process.env.SEED_SECRET_KEY;

  if (!seedKey || authHeader !== `Bearer ${seedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: string[] = [];
  let updated = 0;
  let skippedAlreadyFilled = 0;
  let notFound = 0;

  for (const entry of harapanData) {
    try {
      // Find member by email first
      let member = null;
      const { data: byEmail } = await supabase
        .from("members")
        .select("id, nama, harapan, email")
        .ilike("email", entry.email)
        .limit(1);

      if (byEmail && byEmail.length > 0) {
        member = byEmail[0];
      } else {
        // Fallback: find by name (case-insensitive partial match)
        const { data: byName } = await supabase
          .from("members")
          .select("id, nama, harapan, email")
          .ilike("nama", `%${entry.nama.split(" ")[0]}%`)
          .limit(5);

        if (byName && byName.length > 0) {
          // Try exact-ish match
          const exactMatch = byName.find(
            (m) => m.nama.toLowerCase().replace(/\s+/g, " ").trim() ===
                   entry.nama.toLowerCase().replace(/\s+/g, " ").trim()
          );
          if (exactMatch) {
            member = exactMatch;
          } else {
            // Use first match if only one result
            if (byName.length === 1) {
              member = byName[0];
            }
          }
        }
      }

      if (!member) {
        notFound++;
        results.push(`NOT FOUND: ${entry.nama} (${entry.email})`);
        continue;
      }

      // Only update if harapan is currently empty
      if (member.harapan && member.harapan.trim().length > 0) {
        skippedAlreadyFilled++;
        results.push(`SKIP (already filled): ${member.nama} — existing: "${member.harapan.substring(0, 50)}..."`);
        continue;
      }

      // Update harapan
      const { error: updateError } = await supabase
        .from("members")
        .update({ harapan: entry.harapan })
        .eq("id", member.id);

      if (updateError) {
        results.push(`ERROR updating ${member.nama}: ${updateError.message}`);
      } else {
        updated++;
        results.push(`UPDATED: ${member.nama} — "${entry.harapan.substring(0, 60)}..."`);
      }
    } catch (err) {
      results.push(`ERROR: ${entry.nama} — ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      total_harapan_entries: harapanData.length,
      updated,
      skipped_already_filled: skippedAlreadyFilled,
      not_found: notFound,
    },
    details: results,
  });
}
