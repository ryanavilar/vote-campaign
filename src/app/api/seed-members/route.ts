import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// New members to add (42) - from "Daftar Dukungan Aditya Syarief-IKASTARA KITA (Responses).xlsx"
// Cross-referenced with existing 332 members, these are NOT already in the database
const newMembers = [
  { email: "vanessadeline@gmail.com", nama: "Adeline Vanessa Loho", angkatan: 18, no_hp: "081296781118" },
  { email: "hnrypas@gmail.com", nama: "Henry Pasodung", angkatan: 20, no_hp: "081211409909" },
  { email: "bagushpermana@gmail.com", nama: "Bagus Hendra Permana", angkatan: 20, no_hp: "082148983038" },
  { email: "justinfack8@gmail.com", nama: "Arya Wira Perdana", angkatan: 26, no_hp: "081210024209" },
  { email: "bimaramadhan19@gmail.com", nama: "Bima Ramadhan Putra Dewa", angkatan: 19, no_hp: "08112631126" },
  { email: "ihwanul.alim@gmail.com", nama: "Ihwanul Alim", angkatan: 13, no_hp: "081321873330" },
  { email: "w.jaluakbar@gmail.com", nama: "Wisnu Jaluakbar", angkatan: 11, no_hp: "08118450633" },
  { email: "oyiesaikon87@gmail.com", nama: "Muhammad Qorie Prasetya", angkatan: 13, no_hp: "082177922008" },
  { email: "syabaruddin.malik@yahoo.com", nama: "Syabaruddin Malik", angkatan: 13, no_hp: "08119107427" },
  { email: "direktursmh@gmail.com", nama: "Teguh Agus Santoso", angkatan: 3, no_hp: "081283816102" },
  { email: "rafaelnicolaus22@gmail.com", nama: "Nicolaus Rahandika Kristiarso Suryo", angkatan: 15, no_hp: "08211020512" },
  { email: "syamsulprasetya90@gmail.com", nama: "Syamsul Tamimi Prasetya Aji", angkatan: 26, no_hp: "085943570968" },
  { email: "teofilusjosafat@gmail.com", nama: "Teofilus Josafat Dion Putra", angkatan: 26, no_hp: "087724442665" },
  { email: "ddy298@gmail.com", nama: "Dedy Ardyansyah", angkatan: 13, no_hp: "082142802008" },
  { email: "deltadua65@gmail.com", nama: "Arman Adi Wibowo", angkatan: 13, no_hp: "081998449069" },
  { email: "budiakmil11@gmail.com", nama: "Untung Budi Wahyono", angkatan: 13, no_hp: "082194249565" },
  { email: "egtheasilva@gmail.com", nama: "Egtheasilva Artella", angkatan: 13, no_hp: "085292314041" },
  { email: "dionisiusmanggesa08@gmail.com", nama: "Dionisius Brilian Manggesa", angkatan: 13, no_hp: "081335635571" },
  { email: "deni.kurniawan87@gmail.com", nama: "Deni Kurniawan", angkatan: 13, no_hp: "082124001655" },
  { email: "rahmadia.adisti5@gmail.com", nama: "Rahmadia Adisti", angkatan: 13, no_hp: "081224921987" },
  { email: "hesibarani@gmail.com", nama: "Hartoni Enrico", angkatan: 13, no_hp: "081310854655" },
  { email: "saifuddinafif@gmail.com", nama: "Saifuddin Noor Afifi", angkatan: 13, no_hp: "08119936287" },
  { email: "bscwicaksono@gmail.com", nama: "Bimo Satriyo Condro Wicaksono", angkatan: 13, no_hp: "082311722008" },
  { email: "suyudhanto@gmail.com", nama: "Satriyo Untung Yudhanto", angkatan: 13, no_hp: "081223576108" },
  { email: "pungkyoctavianingtyas@gmail.com", nama: "Pungky Octavianingtyas", angkatan: 13, no_hp: "082120112296" },
  { email: "virayugana@gmail.com", nama: "Febrian Yugana Prasetya", angkatan: 13, no_hp: "082247778887" },
  { email: "tri.wira.efendi@gmail.com", nama: "Tri Wira Efendi", angkatan: 13, no_hp: "+6594729033" },
  { email: "juwita.puspita25@gmail.com", nama: "Juwita Puspita Dinar R.", angkatan: 13, no_hp: "081328041152" },
  { email: "faiz.erfin87@gmail.com", nama: "Faizunnur Erfin", angkatan: 13, no_hp: "08128812076" },
  { email: "yuyun.rindi@gmail.com", nama: "Yuyun Rindiastuti", angkatan: 13, no_hp: "082136982327" },
  { email: "rania.sembiring@gmail.com", nama: "Rania Ruth", angkatan: 13, no_hp: "081319000180" },
  { email: "adesita986@gmail.com", nama: "Sita Wijayanti", angkatan: 13, no_hp: "08118778886" },
  { email: "lydia.asri@yahoo.com", nama: "Lydia WKA", angkatan: 13, no_hp: "+31638188910" },
  { email: "am_arta@yahoo.com", nama: "Ambara Arya Anandita", angkatan: 13, no_hp: "081299069926" },
  { email: "zamruddinyusuf@gmail.com", nama: "Zamruddin Yusuf Nooranda", angkatan: 13, no_hp: "08119000924" },
  { email: "apratama112@gmail.com", nama: "Adhitya Pratama", angkatan: 13, no_hp: "08112121687" },
  { email: "hendrartha23@gmail.com", nama: "Hendra Artha Aditama", angkatan: 13, no_hp: "081259007555" },
  { email: "mohammadferilfebiansyah@gmail.com", nama: "Mohammad Feril Febiansyah", angkatan: 28, no_hp: "082198521728" },
  { email: "herpow2087@gmail.com", nama: "Heri Purnomo", angkatan: 13, no_hp: "081214587680" },
  { email: "aot.ta05@gmail.com", nama: "Alhadi Okta Triansyah", angkatan: 13, no_hp: "082157193437" },
  { email: "sangpengelana.anto@gmail.com", nama: "Yusuf", angkatan: 10, no_hp: "081575038080" },
  { email: "muuhammadsamy1012@gmail.com", nama: "Muhammad Samy", angkatan: 27, no_hp: "081280566926" },
];

// Existing members that need email update (24) - matched by name+angkatan or phone
const emailUpdates: { id: string; no: number; nama: string; email: string }[] = [
  { id: "", no: 153, nama: "Kevin Adiyasa", email: "kevinadiyasa.kaa@gmail.com" },
  { id: "", no: 69, nama: "Bagus Anggitaman", email: "banggitaman@gmail.com" },
  { id: "", no: 62, nama: "Bagus Arifin", email: "bagus888@gmail.com" },
  { id: "", no: 65, nama: "Adi Suryo Prabowo", email: "adisprabowo@gmail.com" },
  { id: "", no: 80, nama: "Muhammad Sjahrir", email: "msr_dorwnbe@yahoo.co.id" },
  { id: "", no: 132, nama: "Septiadi Galindra", email: "sgalindra@gmail.com" },
  { id: "", no: 126, nama: "Wira Anom Wibawa", email: "wira.anom.wibawa@gmail.com" },
  { id: "", no: 68, nama: "Yunantono Arbi", email: "yunantono.arbi@gmail.com" },
  { id: "", no: 118, nama: "Zulfikar Hakim", email: "zulfikar@hakim.im" },
  { id: "", no: 98, nama: "Hesthi Triyono", email: "tyo.kepelautan88@gmail.com" },
  { id: "", no: 77, nama: "Wawan Prabawa", email: "bethere13@gmail.com" },
  { id: "", no: 99, nama: "Puguh Hasta Gunawan", email: "puguh.hasta@gmail.com" },
  { id: "", no: 82, nama: "Septian Sugestyo Putro", email: "septiankuliahlagi@gmail.com" },
  { id: "", no: 86, nama: "Ario Prabowo", email: "prabowo.ario@gmail.com" },
  { id: "", no: 72, nama: "Dwi Wisnu BP", email: "wisnu.cloud@gmail.com" },
  { id: "", no: 94, nama: "Flora Marlyna LT", email: "flora.tobing@gmail.com" },
  { id: "", no: 95, nama: "Andhyka Kurniawan Sasongko", email: "dindutelegom@gmail.com" },
  { id: "", no: 66, nama: "Putri Melati", email: "pumelmelati@gmail.com" },
  { id: "", no: 87, nama: "Panji Agung Nugroho", email: "venomgalasa@gmail.com" },
  { id: "", no: 74, nama: "Denny Nugrahanto", email: "nugrahantodenny@gmail.com" },
  { id: "", no: 136, nama: "Albert Satria Purnama", email: "asepwashere@gmail.com" },
  { id: "", no: 111, nama: "Zenith Adhiarga", email: "zenith.adhiarga@gmail.com" },
  { id: "", no: 115, nama: "Sangsang Frismawati", email: "syahnasamann@gmail.com" },
  { id: "", no: 71, nama: "Mohammad Ali Ridha Ichsan", email: "mohammad.a.r.ichsan@gmail.com" },
];

export async function POST(request: NextRequest) {
  // Authenticate
  const authHeader = request.headers.get("authorization");
  const seedKey = process.env.SEED_SECRET_KEY;

  if (!seedKey || authHeader !== `Bearer ${seedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const errors: string[] = [];

  // 1. Get max "no" for sequential numbering
  const { data: maxNoData } = await supabase
    .from("members")
    .select("no")
    .order("no", { ascending: false })
    .limit(1);

  let nextNo = maxNoData && maxNoData.length > 0 ? maxNoData[0].no + 1 : 1;

  // 2. Add new members
  let membersCreated = 0;
  for (const member of newMembers) {
    try {
      // Double-check: skip if already exists (by email or name+angkatan)
      const { data: existing } = await supabase
        .from("members")
        .select("id")
        .or(`email.ilike.${member.email},and(nama.ilike.${member.nama},angkatan.eq.${member.angkatan})`)
        .limit(1);

      if (existing && existing.length > 0) {
        errors.push(`Skipped ${member.nama} (TN${member.angkatan}) - already exists`);
        continue;
      }

      const { error: insertError } = await supabase
        .from("members")
        .insert({
          no: nextNo,
          nama: member.nama,
          angkatan: member.angkatan,
          no_hp: member.no_hp,
          email: member.email,
        });

      if (insertError) {
        errors.push(`Failed to create ${member.nama}: ${insertError.message}`);
      } else {
        membersCreated++;
        nextNo++;
      }
    } catch (err) {
      errors.push(`Error creating ${member.nama}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  // 3. Update existing members with missing emails
  let membersUpdated = 0;
  for (const update of emailUpdates) {
    try {
      // Find by "no" field
      const { data: member } = await supabase
        .from("members")
        .select("id, email")
        .eq("no", update.no)
        .single();

      if (!member) {
        errors.push(`Could not find member No:${update.no} (${update.nama}) for email update`);
        continue;
      }

      // Only update if email is currently null/empty
      if (member.email) {
        errors.push(`Skipped email update for ${update.nama} (No:${update.no}) - already has email: ${member.email}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("members")
        .update({ email: update.email })
        .eq("id", member.id);

      if (updateError) {
        errors.push(`Failed to update email for ${update.nama}: ${updateError.message}`);
      } else {
        membersUpdated++;
      }
    } catch (err) {
      errors.push(`Error updating ${update.nama}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      new_members_to_add: newMembers.length,
      members_created: membersCreated,
      email_updates_to_apply: emailUpdates.length,
      members_updated: membersUpdated,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
