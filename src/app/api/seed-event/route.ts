import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

interface FormResponse {
  email: string;
  nama: string;
  angkatan: number;
  no_hp: string;
  will_attend: boolean;
}

// Parsed from "Reservasi RKB Vol.1 _Ikastara Kita (Responses).xlsx"
const formResponses: FormResponse[] = [
  { email: "mochmardikapurwantara@gmail.com", nama: "Moch Mardika", angkatan: 13, no_hp: "087851206293", will_attend: false },
  { email: "andremanalu5@gmail.com", nama: "Andre", angkatan: 20, no_hp: "08112575212", will_attend: true },
  { email: "fahmirangga88@gmail.com", nama: "Fahmi Rangga Gumilang", angkatan: 14, no_hp: "087839361000", will_attend: true },
  { email: "dramaliatp@gmail.com", nama: "Amalia Tri Prasetyowati", angkatan: 15, no_hp: "081318080092", will_attend: true },
  { email: "sartikadiahayu@gmail.com", nama: "Diah ayu", angkatan: 18, no_hp: "082280440122", will_attend: true },
  { email: "insosui2015@gmail.com", nama: "Sri Gusni Febriasari", angkatan: 15, no_hp: "08111378048", will_attend: true },
  { email: "krisnayuda50@gmail.com", nama: "Krisna Yuda Perwira", angkatan: 19, no_hp: "082138683938", will_attend: true },
  { email: "Bro.rusdi45@gmail.com", nama: "Rusdi Nuryanto", angkatan: 13, no_hp: "081219652223", will_attend: true },
  { email: "Ibnuhardianvilcas2024@gmail.com", nama: "Ibnu Rahardian", angkatan: 13, no_hp: "081245139911", will_attend: true },
  { email: "frizttheone@gmail.com", nama: "Friztky", angkatan: 13, no_hp: "081319617542", will_attend: true },
  { email: "ilmiahadiat@gmail.com", nama: "Muhammad Ilmi Ahadiat", angkatan: 22, no_hp: "08119292018", will_attend: true },
  { email: "Osafitrie@gmail.com", nama: "Octalira Safitrie", angkatan: 15, no_hp: "081219672347", will_attend: true },
  { email: "m.ibrahimisa@gmail.com", nama: "Muhammad Ibrahim Isa", angkatan: 17, no_hp: "081219884416", will_attend: true },
  { email: "irfanarief95@gmail.com", nama: "Irfan Arief", angkatan: 22, no_hp: "081382391333", will_attend: true },
  { email: "sarahpatriciagultom.spg@gmail.com", nama: "Sarah Patricia Gultom", angkatan: 19, no_hp: "087882616354", will_attend: true },
  { email: "mrizkifajar93@gmail.com", nama: "Muhammad Rizki Fajaryanto", angkatan: 19, no_hp: "081266356067", will_attend: true },
  { email: "fadlurrohmanrinaldi@gmail.com", nama: "Mohammad Fadlurrohman Rinaldi", angkatan: 28, no_hp: "088211092494", will_attend: false },
  { email: "ayah.andaka@gmail.com", nama: "Budi Aprianda", angkatan: 10, no_hp: "083898844454", will_attend: true },
  { email: "gentaperwira@gmail.com", nama: "Genta Perwira Hutama Putra", angkatan: 17, no_hp: "082112177722", will_attend: true },
  { email: "adindaptr.2412@gmail.com", nama: "Adinda Putri Ramdhani", angkatan: 26, no_hp: "085173142412", will_attend: true },
  { email: "hkusuma.wardana@gmail.com", nama: "Hendra Kusuma Wardana", angkatan: 17, no_hp: "087821894391", will_attend: true },
  { email: "abrahamryan91@gmail.com", nama: "Ryan Abraham Pratama", angkatan: 17, no_hp: "0811115503", will_attend: true },
  { email: "ashari.ru@gmail.com", nama: "Ashari Iman Rusyadi", angkatan: 19, no_hp: "082226544480", will_attend: true },
  { email: "mahafadaesa@gmail.com", nama: "Muhammad Mahafada Esa Putra Tugiyono", angkatan: 28, no_hp: "089697125302", will_attend: true },
  { email: "Almerfarras.izadd@gmail.com", nama: "Almerfarras Izadd", angkatan: 22, no_hp: "081318471281", will_attend: true },
  { email: "Akuneditku2025@gmail.com", nama: "Muhamad lutfi anugrah", angkatan: 23, no_hp: "081946513319", will_attend: true },
  { email: "resha.pradipta@gmail.com", nama: "3307092705880001", angkatan: 14, no_hp: "082211571988", will_attend: true },
  { email: "kzimiawan00@gmail.com", nama: "Karans Zimiawan", angkatan: 28, no_hp: "087896564662", will_attend: true },
  { email: "Ach.alf.fhm@gmail.com", nama: "Achmad Alfian Fahmi", angkatan: 9, no_hp: "081188826688", will_attend: true },
  { email: "awasbus@gmail.com", nama: "Alif Aji S", angkatan: 15, no_hp: "081314230046", will_attend: true },
  { email: "fauzan.siszadli@gmail.com", nama: "Fauzan Farand", angkatan: 24, no_hp: "081284237882", will_attend: true },
  { email: "paramitha.jati@gmail.com", nama: "Paramitha Jati Buwana", angkatan: 15, no_hp: "085865671914", will_attend: true },
  { email: "atrifia.aulia@gmail.com", nama: "Atrifia Aulia", angkatan: 17, no_hp: "081282371381", will_attend: true },
  { email: "Adi.nandi2003@gmail.com", nama: "Adi Nandiwardhana", angkatan: 13, no_hp: "08119417014", will_attend: true },
  { email: "aryabalderas@gmail.com", nama: "ARYA WIRATAMA FAKHRIANSYAH", angkatan: 24, no_hp: "082137065267", will_attend: true },
  { email: "amaikadeppi@gmail.com", nama: "Amaika Deppi Cahayani", angkatan: 33, no_hp: "089670326602", will_attend: true },
  { email: "Rizqamrullah@gmail.com", nama: "Rizqi Amrullah", angkatan: 19, no_hp: "081320430754", will_attend: true },
  { email: "salmaazizah8181@gmail.com", nama: "Salma Azizah", angkatan: 33, no_hp: "081283320604", will_attend: true },
  { email: "mwety_til@yahoo.com", nama: "Isma Pratiwi", angkatan: 13, no_hp: "081234410001", will_attend: true },
  { email: "cantikalawa24@gmail.com", nama: "Victorya P. Putry Cantika", angkatan: 32, no_hp: "085283910904", will_attend: true },
  { email: "sheilagracia18@gmail.com", nama: "Sheila Gracia Nababan", angkatan: 31, no_hp: "08114896637", will_attend: true },
  { email: "hrnlrsyd@gmail.com", nama: "Muhammad Harun Al Rasyid", angkatan: 20, no_hp: "08119207319", will_attend: true },
  { email: "Agungft@gmail.com", nama: "Agung Firman Triadi", angkatan: 13, no_hp: "081287850058", will_attend: true },
  { email: "puspasari.nd@gmail.com", nama: "Puspasari Nurmaladewi", angkatan: 18, no_hp: "0811923716", will_attend: true },
  { email: "muhamadyusufst@gmail.com", nama: "Muhamad Yusuf", angkatan: 3, no_hp: "08118421991", will_attend: true },
  { email: "ahmadjfurqon@gmail.com", nama: "Ahmad Jawwad Furqon", angkatan: 21, no_hp: "081354877491", will_attend: true },
  { email: "arisdarmawancrb@gmail.com", nama: "Mohammad Aris Darmawan", angkatan: 19, no_hp: "082150470503", will_attend: true },
  { email: "fadhilladessyana02@gmail.com", nama: "Fadhilla Dessyana Putri", angkatan: 25, no_hp: "081294291517", will_attend: true },
  { email: "vinodmalau@gmail.com", nama: "Vino Daniel", angkatan: 17, no_hp: "089696827709", will_attend: true },
  { email: "yupiganteng2003@gmail.com", nama: "yusuf priatmaja", angkatan: 29, no_hp: "082169836899", will_attend: true },
  { email: "odikpratama2@gmail.com", nama: "Odik Saka Aji Pratama", angkatan: 29, no_hp: "089671015919", will_attend: true },
  { email: "23rizkikurniawan@gmail.com", nama: "muhamad rizki kurniawan", angkatan: 29, no_hp: "081327537947", will_attend: true },
  { email: "indrayana.ign@gmail.com", nama: "I Gusti Ngurah Bagus Indrayana", angkatan: 20, no_hp: "089652475684", will_attend: true },
  { email: "ini.arief25@gmail.com", nama: "Arief Dwi Dharmawan", angkatan: 27, no_hp: "081327247179", will_attend: true },
  { email: "Lanceria87@gmail.com", nama: "Lanceria Sijabat", angkatan: 13, no_hp: "082315471821", will_attend: true },
  { email: "mgo.andi@gmail.com", nama: "Muhammad Gustri Oktaviandi", angkatan: 17, no_hp: "081367305933", will_attend: true },
  { email: "galihwiseso@gmail.com", nama: "Linggis galih Wiseso", angkatan: 24, no_hp: "082225097909", will_attend: true },
  { email: "hizkia.p.l@gmail.com", nama: "Hizkia Prana Lemuel", angkatan: 21, no_hp: "081399110161", will_attend: true },
  { email: "Purnama.indra00@gmail.com", nama: "Indra Purnama", angkatan: 15, no_hp: "081298596543", will_attend: true },
  { email: "kzimiawan00@gmail.com", nama: "Karans Zimiawan", angkatan: 28, no_hp: "087896564662", will_attend: true },
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
      nama: "Ruang Komunikasi Bersama (RKB) Vol. 1",
      jenis: "Silaturahmi",
      deskripsi: "Ruang Komunikasi Bersama (RKB) Vol 1 Keluarga Besar Ikastara Kita",
      lokasi: "Menara Jamsostek lantai 11",
      tanggal: "2026-02-13T19:00:00+07:00",
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
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}
