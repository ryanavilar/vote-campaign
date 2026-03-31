import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, isSuperAdmin } from "@/lib/roles";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const TIM_SUKSES = [
  { name: "Fiskha Dewi Cahyaning Wulan", email: "fiskha.dewi@gmail.com", angkatan: 13 },
  { name: "Fahmi Rangga Gumilang", email: "fahmirangga88@gmail.com", angkatan: 14 },
  { name: "Sri Gusni Febriasari", email: "insosui2015@gmail.com", angkatan: 15 },
  { name: "Riko Apriadi", email: "rikooapriadii@gmail.com", angkatan: 16 },
  { name: "Hendra", email: "hkusuma.wardana@gmail.com", angkatan: 17 },
  { name: "Diah Ayu S", email: "sartikadiahayu@gmail.com", angkatan: 18 },
  { name: "Krisna Yuda", email: "krisnayuda50@gmail.com", angkatan: 19 },
  { name: "Rifqi Ryan", email: "ryanavilar@gmail.com", angkatan: 20 },
  { name: "Ahmad Jawwad Furqon", email: "ahmadjfurqon@gmail.com", angkatan: 21 },
  { name: "Boas Suhat", email: "boassuhat@gmail.com", angkatan: 22 },
  { name: "Mochamad Fahmi T. H.", email: "mochfahmi08@gmail.com", angkatan: 23 },
  { name: "Linggis Galih Wiseso", email: "galihwiseso@gmail.com", angkatan: 24 },
  { name: "Fadhilla Dessyana Putri", email: "fadhilladessyana02@gmail.com", angkatan: 25 },
  { name: "Moh. Mahrus Ali", email: "mohmahrusali02@gmail.com", angkatan: 26 },
  { name: "Gabriella Dinida Ael", email: "ggdinida@gmail.com", angkatan: 27 },
  { name: "Yudha Primus Kristianto", email: "yudhaaprimuss@gmail.com", angkatan: 28 },
  { name: "Yohanes Adelino Apur", email: "yohanesaapur@gmail.com", angkatan: 29 },
  { name: "Beltzasar Kalebz", email: "kalebsalamuk@gmail.com", angkatan: 30 },
  { name: "Muhammad Naufal Abiy Pratama", email: "naufal.abiy0505@gmail.com", angkatan: 31 },
  { name: "Bisma Nafis Attala Daniswara", email: "nafisbisma@gmail.com", angkatan: 32 },
  { name: "Gery Valentino Fernandez", email: "geryfernandez087@gmail.com", angkatan: 33 },
];

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!isSuperAdmin(role)) {
    return NextResponse.json({ error: "Super Admin only" }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = [];

  for (const ts of TIM_SUKSES) {
    try {
      // Check if user already exists
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const existing = users?.find((u) => u.email === ts.email);

      let userId: string;

      if (existing) {
        // Update metadata if name not set
        if (!existing.user_metadata?.name && !existing.user_metadata?.full_name) {
          await adminClient.auth.admin.updateUserById(existing.id, {
            user_metadata: { name: ts.name },
          });
        }
        userId = existing.id;
        results.push({ email: ts.email, status: "already_exists", user_id: userId });
      } else {
        // Create new user — no password set, will use OTP login
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email: ts.email,
          email_confirm: true,
          user_metadata: { name: ts.name },
        });

        if (createErr || !created.user) {
          results.push({ email: ts.email, status: "error", error: createErr?.message });
          continue;
        }
        userId = created.user.id;
        results.push({ email: ts.email, status: "created", user_id: userId });
      }

      // Upsert role as campaigner
      await adminClient
        .from("user_roles")
        .upsert({ user_id: userId, role: "campaigner" }, { onConflict: "user_id" });

      // Upsert angkatan assignment
      await adminClient
        .from("campaigner_angkatan")
        .upsert({ user_id: userId, angkatan: ts.angkatan }, { onConflict: "user_id,angkatan" });

    } catch (err) {
      results.push({ email: ts.email, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ success: true, results });
}
