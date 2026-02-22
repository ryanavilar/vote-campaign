import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface FormResponse {
  email: string;
  nama: string;
  angkatan: number;
  no_hp: string;
  will_attend: boolean;
}

// Parsed from "Reservasi RKB Vol 2 _Ikastara Kita (Responses).xlsx"
// 134 rows → 132 unique by email (deduped, keeping last entry)
const formResponses: FormResponse[] = [
  { email: "Niafitri905@gmail.com", nama: "Dhian Kurnia Fitri", angkatan: 22, no_hp: "082123059107", will_attend: true },
  { email: "muhamadyusufst@gmail.com", nama: "Muhamad Yusuf", angkatan: 3, no_hp: "08118421991", will_attend: true },
  { email: "vla.luthfita@gmail.com", nama: "Virly Luthfita Andini", angkatan: 26, no_hp: "081211398094", will_attend: true },
  { email: "Utomoagi8@gmail.com", nama: "Agi Wasistyo Utomo", angkatan: 17, no_hp: "081226851080", will_attend: true },
  { email: "Annas.pahlevi@gmail.com", nama: "Annas Nurezka Pahlevi", angkatan: 18, no_hp: "081314242767", will_attend: true },
  { email: "samodranugraha@gmail.com", nama: "Samodra Prabhaswara Nugraha", angkatan: 17, no_hp: "08561454078", will_attend: true },
  { email: "sartikadiahayu@gmail.com", nama: "Diah ayu", angkatan: 18, no_hp: "082280440122", will_attend: true },
  { email: "mwety_til@yahoo.com", nama: "Isma Pratiwi", angkatan: 13, no_hp: "081234410001", will_attend: true },
  { email: "asharirusyadi2@gmail.com", nama: "Ashari Iman Rusyadi", angkatan: 19, no_hp: "082226544480", will_attend: true },
  { email: "Adyrdk@gmail.con", nama: "Anadya rhadika", angkatan: 24, no_hp: "082117425346", will_attend: true },
  { email: "slamet.nurhadi@gmail.com", nama: "Slamet Nurhadi", angkatan: 5, no_hp: "08119789809", will_attend: true },
  { email: "andremanalu5@gmail.com", nama: "Andre Manalu", angkatan: 20, no_hp: "08112575212", will_attend: true },
  { email: "alimbimopratowo2025@gmail.com", nama: "Alim Bimo Pratowo", angkatan: 28, no_hp: "082313802025", will_attend: true },
  { email: "aditarmtamarunang@gmail.com", nama: "Aditya arief", angkatan: 25, no_hp: "088239037032", will_attend: true },
  { email: "puspasari.nd@gmail.com", nama: "Puspasari Nurmaladewi", angkatan: 18, no_hp: "0811923716", will_attend: true },
  { email: "gilangbagaskara5791@gmail.com", nama: "Gilang Bagaskara", angkatan: 17, no_hp: "081281676658", will_attend: true },
  { email: "Sarahpatriciagultom.spg@gmail.com", nama: "Sarah Patricia Gultom", angkatan: 19, no_hp: "087882616354", will_attend: true },
  { email: "faiz.annindito@gmail.com", nama: "M F Annindito", angkatan: 21, no_hp: "08986224729", will_attend: true },
  { email: "gede.vidi@gmail.com", nama: "Gede Vidi Wuragi", angkatan: 13, no_hp: "081343299191", will_attend: true },
  { email: "husaimiimfar@gmail.com", nama: "Mohammad Husaimi Rafsanjani", angkatan: 24, no_hp: "082220459993", will_attend: true },
  { email: "resha.pradipta@gmail.com", nama: "Resha Adi Pradipta", angkatan: 14, no_hp: "082211571988", will_attend: true },
  { email: "Cipta.w.utama@gmail.com", nama: "Cipta Wira Utama", angkatan: 13, no_hp: "0811975766", will_attend: true },
  { email: "saavirandjani@gmail.com", nama: "savira andjani", angkatan: 25, no_hp: "081320005699", will_attend: true },
  { email: "setyodoyo@gmail.com", nama: "Setyo Wardoyo", angkatan: 17, no_hp: "085747875696", will_attend: true },
  { email: "vivapinkyew27@gmail.com", nama: "viva innova pinky", angkatan: 30, no_hp: "081335620605", will_attend: true },
  { email: "Andersonavy49@gmail.com", nama: "Andreas Sony Tangi Timbang", angkatan: 8, no_hp: "082255238949", will_attend: true },
  { email: "gilsugiarto@yahoo.com", nama: "Ragil Sugiarto", angkatan: 14, no_hp: "082153323307", will_attend: true },
  { email: "rifkihasibuan5@gmail.com", nama: "Rifki Arian Hasibuan", angkatan: 24, no_hp: "081269362635", will_attend: true },
  { email: "pradipta.ardhi@gmail.com", nama: "Pradipta Ardhi", angkatan: 14, no_hp: "081220387069", will_attend: true },
  { email: "fayruzzaalfath@gmail.com", nama: "Fayruzza Alfath Wakhyanto", angkatan: 31, no_hp: "081617487232", will_attend: true },
  { email: "arisdarmawancrb@gmail.com", nama: "Mohammad Aris Darmawan", angkatan: 19, no_hp: "082150470503", will_attend: true },
  { email: "bayusatriobsw@gmail.com", nama: "Bayu Satrio W", angkatan: 26, no_hp: "082148554470", will_attend: true },
  { email: "arfian.agus@gmail.com", nama: "Arfian Agus", angkatan: 12, no_hp: "08557608666", will_attend: true },
  { email: "Ahmadjfurqon@gmail.com", nama: "Ahmad Jawwad Furqon", angkatan: 21, no_hp: "081354877491", will_attend: true },
  { email: "Sabda_alam90@yahoo.com", nama: "Sabda Alam Maulana", angkatan: 21, no_hp: "081244302416", will_attend: true },
  { email: "sanne8844@gmail.com", nama: "M. Sanne", angkatan: 14, no_hp: "085225978844", will_attend: true },
  { email: "Tikalarastri@gmail.com", nama: "Tika Larastri", angkatan: 17, no_hp: "0818801838", will_attend: true },
  { email: "dramaliatp@gmail.com", nama: "Amalia Tri Prasetyowati", angkatan: 15, no_hp: "081318080092", will_attend: true },
  { email: "Stelladvenna@gmail.com", nama: "Stella Advena Anindita", angkatan: 18, no_hp: "081226565451", will_attend: true },
  { email: "melvinrizki26@gmail.com", nama: "MELVIN RIZKI ALHAMED", angkatan: 26, no_hp: "085215822482", will_attend: true },
  { email: "jagatnata.gurusinga@gmail.com", nama: "Jagatnata Gurusinga", angkatan: 6, no_hp: "08129978604", will_attend: true },
  { email: "gusti.ngurah.eka@gmail.com", nama: "I Gusti Ngurah Eka Permana", angkatan: 6, no_hp: "08114711002", will_attend: true },
  { email: "alvinihsn@gmail.com", nama: "Alvn Ihsan", angkatan: 25, no_hp: "081329298363", will_attend: true },
  { email: "muhammadahdalularayhanfasya@gmail.com", nama: "Muhammad Ahdal'ula Rayhanfasya", angkatan: 24, no_hp: "082870555525", will_attend: true },
  { email: "rizkyrahmana@gmail.com", nama: "Rizky Rahmana Putra", angkatan: 21, no_hp: "081329278470", will_attend: true },
  { email: "nurdysadp5392@gmail.com", nama: "Nurdysa Diliana Putri", angkatan: 18, no_hp: "08118462882", will_attend: true },
  { email: "adkow97@gmail.com", nama: "Adrian Ekoyudho Nugroho", angkatan: 23, no_hp: "085878390533", will_attend: true },
  { email: "meridiandmp@gmail.com", nama: "Meridian Donna Meitawati P", angkatan: 18, no_hp: "087865012880", will_attend: true },
  { email: "daraveri10@gmail.com", nama: "Dara Veri Widayanti", angkatan: 18, no_hp: "081234510892", will_attend: true },
  { email: "gentaperwira@gmail.com", nama: "Genta Perwira Hutama Putra", angkatan: 17, no_hp: "082112177722", will_attend: true },
  { email: "irfanarief95@gmail.com", nama: "Irfan Arief", angkatan: 22, no_hp: "081382391333", will_attend: true },
  { email: "abudiman0112@gmail.com", nama: "Arif Budiman", angkatan: 22, no_hp: "081226776395", will_attend: true },
  { email: "viernawensatama@gmail.com", nama: "Vierna Tasya Wensatama", angkatan: 18, no_hp: "08118171777", will_attend: true },
  { email: "abbilabizar26@gmail.com", nama: "Abbil Aditya Abizar", angkatan: 31, no_hp: "0895392240926", will_attend: true },
  { email: "Rizqamrullah@gmail.com", nama: "Rizqi Amrullah", angkatan: 19, no_hp: "081320430754", will_attend: true },
  { email: "henny.septyani@gmail.com", nama: "Henny Ika Septyani", angkatan: 9, no_hp: "08157160735", will_attend: true },
  { email: "denny.arifiandi@gmail.com", nama: "Denny Arifiandi", angkatan: 1, no_hp: "08118113512", will_attend: true },
  { email: "Ivansudirman@gmail.con", nama: "Ivan Sudirman", angkatan: 3, no_hp: "0818920756", will_attend: true },
  { email: "annisajayanti23@gmail.com", nama: "Annisa Fairuzani Jayanti", angkatan: 28, no_hp: "082133541049", will_attend: true },
  { email: "helmi.hamdani@gmail.com", nama: "Muhammad Helmi Hamdani", angkatan: 10, no_hp: "085973970897", will_attend: false },
  { email: "fernandarifqi.nasution@gmail.com", nama: "Rifqi Fernanda Azis Nasution", angkatan: 28, no_hp: "0859106837513", will_attend: true },
  { email: "Audiyusuf.m@gmail.com", nama: "Audi Yusuf", angkatan: 18, no_hp: "081392385299", will_attend: true },
  { email: "yudhacristianto26@gmail.com", nama: "Yudha Primus Kristianto", angkatan: 28, no_hp: "081992110551", will_attend: true },
  { email: "sacred.nsy@gmail.com", nama: "Adi Novriansyah", angkatan: 13, no_hp: "085711622184", will_attend: true },
  { email: "daengachmadardiansyah@yahoo.com", nama: "Daeng Achmad Ardiansyah", angkatan: 13, no_hp: "08118585875", will_attend: true },
  { email: "iputusukma@pm.me", nama: "I Putu Sukma Hendrawan", angkatan: 13, no_hp: "081296549229", will_attend: true },
  { email: "zakinugraha9@gmail.com", nama: "Hadyan Zaki Nugraha", angkatan: 18, no_hp: "081280081828", will_attend: true },
  { email: "fikriadibrianto@gmail.com", nama: "Fikri Adib Rianto", angkatan: 28, no_hp: "081328492013", will_attend: true },
  { email: "gibran.bahtiar12@gmail.com", nama: "Gibran Bahtiar", angkatan: 29, no_hp: "085157662254", will_attend: true },
  { email: "fadlurrohmanrinaldi@gmail.com", nama: "Mohammad Fadlurrohman Rinaldi", angkatan: 28, no_hp: "088211092494", will_attend: true },
  { email: "yohanesaapur@gmail.com", nama: "Yohanes Adelino Apur", angkatan: 29, no_hp: "081228251529", will_attend: true },
  { email: "hkusuma.wardana@gmail.com", nama: "Hendra", angkatan: 17, no_hp: "087821894391", will_attend: true },
  { email: "suryono.rm@gmail.com", nama: "Suryono Ridho", angkatan: 6, no_hp: "085267762001", will_attend: true },
  { email: "miqdamchakra@gmail.com", nama: "Miqdam Chakra Maulana Putra", angkatan: 25, no_hp: "08111654444", will_attend: true },
  { email: "salmaazizah8181@gmail.com", nama: "Salma Azizah", angkatan: 33, no_hp: "081283320604", will_attend: true },
  { email: "amaikadeps@gmail.com", nama: "Amaika Deppi Cahayani", angkatan: 33, no_hp: "089670326602", will_attend: true },
  { email: "ahnafzh@gmail.com", nama: "Ahnaf Zahier Husain", angkatan: 21, no_hp: "082299367925", will_attend: true },
  { email: "Biben.ramseno@gmail.com", nama: "Aulia biben", angkatan: 11, no_hp: "0811250108", will_attend: true },
  { email: "breyviashanata@gmail.com", nama: "Breyvia Shanata Putri Satria", angkatan: 30, no_hp: "082258415152", will_attend: true },
  { email: "ahyaita.fuka@gmail.com", nama: "Ahyaita Fuka Virgirana", angkatan: 30, no_hp: "081287664545", will_attend: true },
  { email: "arya.mahendra.asmara@gmail.com", nama: "Arya Mahendra Asmara", angkatan: 29, no_hp: "088709756447", will_attend: true },
  { email: "gregidtn@gmail.com", nama: "Agid Kusumo Prabowo Putro", angkatan: 25, no_hp: "081325918878", will_attend: false },
  { email: "ragga.sukma@gmail.com", nama: "Ragga Sukma Budhitama", angkatan: 13, no_hp: "087809703087", will_attend: true },
  { email: "h.martanto@gmail.com", nama: "Heri Martanto", angkatan: 1, no_hp: "0811941905", will_attend: true },
  { email: "akipalya@gmail.com", nama: "Alyasari Akip", angkatan: 30, no_hp: "087883699781", will_attend: true },
  { email: "zackykunkun@gmail.com", nama: "LA OFE MUHAMMAD ZAKY AL HAFIS EMBA", angkatan: 31, no_hp: "082164663041", will_attend: true },
  { email: "serviteur06@gmail.com", nama: "Abdurrahman Faiz", angkatan: 30, no_hp: "0895417188558", will_attend: false },
  { email: "bhimsasanlito@gmail.com", nama: "Bhimsa Sanlito Satriavi Pratama", angkatan: 18, no_hp: "082112694628", will_attend: true },
  { email: "fmuddakir@yahoo.com", nama: "Muhammad luqman fadillah", angkatan: 18, no_hp: "087886860992", will_attend: true },
  { email: "esmederyadi@gmail.com", nama: "Esmed Eryadi", angkatan: 1, no_hp: "081354547777", will_attend: true },
  { email: "adityakuntar1996@gmail.com", nama: "Neo Aditya Kuntar", angkatan: 23, no_hp: "085253952351", will_attend: true },
  { email: "frhn.satrio.af@gmail.com", nama: "Farhan Satrio Al Fatih", angkatan: 27, no_hp: "082310794923", will_attend: true },
  { email: "ricomaulana2405@gmail.com", nama: "Josh Rico Maulana", angkatan: 28, no_hp: "082120085881", will_attend: true },
  { email: "pembinapaulus@gmail.com", nama: "Paulus Simamora", angkatan: 17, no_hp: "082298702012", will_attend: true },
  { email: "danipahlevi@rocketmail.com", nama: "Muhammad Shadani Pahlevi", angkatan: 25, no_hp: "0811410872", will_attend: true },
  { email: "m.ibrahimisa@gmail.com", nama: "Muhammad Ibrahim Isa", angkatan: 17, no_hp: "081219884416", will_attend: true },
  { email: "bangkitkrisnaa196@gmail.com", nama: "Bangkit Krisna Satriadi", angkatan: 29, no_hp: "081391798611", will_attend: true },
  { email: "rizalkarisna@gmail.com", nama: "Rizal Karisna", angkatan: 18, no_hp: "081224561235", will_attend: true },
  { email: "Priwanda@gmail.com", nama: "Topo priwanda", angkatan: 13, no_hp: "081366524090", will_attend: true },
  { email: "ukiatmanagara@gmail.com", nama: "Uki Atma Nagara", angkatan: 13, no_hp: "08116623000", will_attend: true },
  { email: "fahmirangga88@gmail.com", nama: "Fahmi Rangga Gumilang", angkatan: 14, no_hp: "087839361000", will_attend: true },
  { email: "fachrurrazi.ridha@gmail.com", nama: "Teuku Fachrurrazi", angkatan: 25, no_hp: "082219236406", will_attend: true },
  { email: "masrony@gmail.com", nama: "Rony Anggono Oktavianto", angkatan: 2, no_hp: "085774511090", will_attend: true },
  { email: "krisnayuda50@gmail.com", nama: "Krisna Yuda Perwira", angkatan: 19, no_hp: "082138683938", will_attend: true },
  { email: "yogafathori@gmail.com", nama: "Abdul Malik Yoga Fathori", angkatan: 20, no_hp: "081212479835", will_attend: true },
  { email: "vito.pradana@gmail.com", nama: "Vito Pradana", angkatan: 22, no_hp: "081282606945", will_attend: true },
  { email: "Almerfarras.izadd@gmail.com", nama: "Almerfarras Izadd", angkatan: 22, no_hp: "081318471281", will_attend: true },
  { email: "aryawfakhriansyah@gmail.com", nama: "ARYA WIRATAMA FAKHRIANSYAH", angkatan: 24, no_hp: "082137865267", will_attend: true },
  { email: "threefanny@gmail.com", nama: "Threefanny Pinta Anugrah", angkatan: 21, no_hp: "08131228063", will_attend: true },
  { email: "fathanislamic@gmail.com", nama: "Mohammad Fathan Islamika", angkatan: 29, no_hp: "085222052687", will_attend: true },
  { email: "sekaarpe@gmail.com", nama: "Nuriffa Sekar Rosania", angkatan: 21, no_hp: "081324162560", will_attend: true },
  { email: "Ach.alf.fhm@gmail.com", nama: "Achmad Alfian Fahmi", angkatan: 9, no_hp: "081188826688", will_attend: true },
  { email: "yulia.aisha@gmail.com", nama: "YULIA AISHA", angkatan: 13, no_hp: "081932979128", will_attend: true },
  { email: "fiskha.dewi@gmail.com", nama: "Fiskha Dewi Cahyaning Wulan", angkatan: 13, no_hp: "08111062287", will_attend: true },
  { email: "rikooapriadii@gmail.com", nama: "Riko Apriadi", angkatan: 16, no_hp: "089616333333", will_attend: true },
  { email: "Rizalsubagyo.rs@gmail.com", nama: "Rizaldi Ariesto Subagyo", angkatan: 26, no_hp: "089646887515", will_attend: true },
  { email: "boassuhat@gmail.com", nama: "Boas Suhat", angkatan: 22, no_hp: "081380582618", will_attend: true },
  { email: "ayah.andaka@gmail.com", nama: "Budi Aprianda", angkatan: 10, no_hp: "083898844454", will_attend: true },
  { email: "insosui2015@gmail.com", nama: "Sri Gusni Febriasari", angkatan: 15, no_hp: "08111378048", will_attend: true },
  { email: "Dony.yuliardi@gmail.com", nama: "Dony Yuliardi", angkatan: 2, no_hp: "0818113776", will_attend: true },
  { email: "Mohwibs@gmail.com", nama: "Moh Ramadhan Wibisono", angkatan: 19, no_hp: "0895320062776", will_attend: true },
  { email: "andaruilham111@gmail.com", nama: "Ilham Andaru Rifqianto", angkatan: 27, no_hp: "082244972677", will_attend: true },
  { email: "mikhabenanta@gmail.com", nama: "Mikha Benanta Purba", angkatan: 17, no_hp: "08116710761", will_attend: true },
  { email: "jeanetkartika@gmail.com", nama: "Jeanet Kartika Turambi", angkatan: 18, no_hp: "081354849984", will_attend: true },
  { email: "Ravanskamanggala672@gmail.com", nama: "Ravanska manggala miharja", angkatan: 28, no_hp: "082220879864", will_attend: true },
  { email: "farhankriswandwi98@gmail.com", nama: "Muhammad Farhan K", angkatan: 24, no_hp: "087792198161", will_attend: true },
  { email: "Akuneditku2025@gmail.com", nama: "Muhamad lutfi anugrah", angkatan: 23, no_hp: "081946513319", will_attend: true },
  { email: "heldy.herawan@gmail.com", nama: "Heldy Wahyu Dwi Herawan", angkatan: 2, no_hp: "081615001615", will_attend: true },
  { email: "harryekouab@gmail.com", nama: "Harry Eko Ujiantoro Adi Basuki", angkatan: 1, no_hp: "081568408899", will_attend: true },
  { email: "naufal.stry@gmail.com", nama: "naufal rizky wiradana", angkatan: 28, no_hp: "082335135650", will_attend: true },
  { email: "abimanyukp@hotmail.com", nama: "Abimanyu Kusumo Putero", angkatan: 17, no_hp: "08111741491", will_attend: true },
  { email: "purnama.indra00@gmail.com", nama: "Indra Purnama", angkatan: 15, no_hp: "081298596543", will_attend: true },
];

function generateCheckinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

  // 1. Create the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      nama: "Ruang Komunikasi Bersama (RKB) Vol. 2",
      jenis: "Silaturahmi",
      deskripsi: "Ruang Komunikasi Bersama (RKB) Vol 2 Keluarga Besar Ikastara Kita",
      lokasi: "Blok M - Teras Budhe Pangpol",
      tanggal: "2026-02-20T17:00:00+07:00",
      status: "Selesai",
      checkin_code: generateCheckinCode(),
    })
    .select()
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: "Gagal membuat event: " + (eventError?.message || "Unknown") },
      { status: 500 }
    );
  }

  // 2. Process each form response
  let membersMatched = 0;
  let membersCreated = 0;
  let registrationsCreated = 0;
  let attendanceCreated = 0;
  const errors: string[] = [];

  // Deduplicate by nama+angkatan (take last entry for duplicates)
  const seen = new Map<string, FormResponse>();
  for (const r of formResponses) {
    const key = `${r.nama.toLowerCase().trim()}|${r.angkatan}`;
    seen.set(key, r);
  }
  const uniqueResponses = Array.from(seen.values());

  for (const response of uniqueResponses) {
    try {
      // Check if member exists (same logic as /api/public/register)
      const { data: existingMembers } = await supabase
        .from("members")
        .select("id, nama, angkatan")
        .ilike("nama", response.nama.trim())
        .eq("angkatan", response.angkatan);

      let memberId: string;

      if (existingMembers && existingMembers.length > 0) {
        // Update existing member
        memberId = existingMembers[0].id;
        await supabase
          .from("members")
          .update({
            no_hp: response.no_hp,
            email: response.email,
          })
          .eq("id", memberId);
        membersMatched++;
      } else {
        // Get next sequential number
        const { data: maxNo } = await supabase
          .from("members")
          .select("no")
          .order("no", { ascending: false })
          .limit(1);

        const nextNo = maxNo && maxNo.length > 0 ? maxNo[0].no + 1 : 1;

        // Create new member
        const { data: newMember, error: memberError } = await supabase
          .from("members")
          .insert({
            no: nextNo,
            nama: response.nama.trim(),
            angkatan: response.angkatan,
            no_hp: response.no_hp,
            email: response.email,
          })
          .select("id")
          .single();

        if (memberError || !newMember) {
          errors.push(`Gagal membuat member ${response.nama}: ${memberError?.message}`);
          continue;
        }

        memberId = newMember.id;
        membersCreated++;
      }

      // Create registration
      const { error: regError } = await supabase
        .from("event_registrations")
        .upsert(
          {
            event_id: event.id,
            member_id: memberId,
            will_attend: response.will_attend,
          },
          { onConflict: "event_id,member_id" }
        );

      if (regError) {
        errors.push(`Gagal registrasi ${response.nama}: ${regError.message}`);
      } else {
        registrationsCreated++;
      }

      // Create attendance record (treat all form respondents as attended)
      const { error: attError } = await supabase
        .from("event_attendance")
        .upsert(
          {
            event_id: event.id,
            member_id: memberId,
            checked_in_at: "2026-02-20T17:30:00+07:00",
            catatan: "Seeded from form response",
          },
          { onConflict: "event_id,member_id" }
        );

      if (attError) {
        errors.push(`Gagal attendance ${response.nama}: ${attError.message}`);
      } else {
        attendanceCreated++;
      }
    } catch (err) {
      errors.push(`Error processing ${response.nama}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return NextResponse.json({
    success: true,
    event: {
      id: event.id,
      nama: event.nama,
      checkin_code: event.checkin_code,
    },
    summary: {
      total_responses: uniqueResponses.length,
      members_matched: membersMatched,
      members_created: membersCreated,
      registrations_created: registrationsCreated,
      attendance_created: attendanceCreated,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
