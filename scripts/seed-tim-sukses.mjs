/**
 * seed-tim-sukses.mjs
 * Buat akun Tim Sukses sesuai daftar berikut.
 * Jalankan: node scripts/seed-tim-sukses.mjs
 *
 * Butuh env vars: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
 * Bisa dari .env.local atau set langsung di environment.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local kalau ada
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  console.log("✅ .env.local loaded");
} catch {
  console.log("⚠️  .env.local not found, using existing environment variables");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diset!");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Default password — harap ubah setelah login pertama
const DEFAULT_PASSWORD = "IkastaraKitaMenang123!";

const TIM_SUKSES = [
  { name: "Fiskha Dewi Cahyaning Wulan", email: "fiskha.dewi@gmail.com",       angkatan: 13 },
  { name: "Fahmi Rangga Gumilang",       email: "fahmirangga88@gmail.com",      angkatan: 14 },
  { name: "Sri Gusni Febriasari",        email: "insosui2015@gmail.com",        angkatan: 15 },
  { name: "Riko Apriadi",                email: "rikooapriadii@gmail.com",      angkatan: 16 },
  { name: "Hendra",                      email: "hkusuma.wardana@gmail.com",    angkatan: 17 },
  { name: "Diah Ayu S",                  email: "sartikadiahayu@gmail.com",     angkatan: 18 },
  { name: "Krisna Yuda",                 email: "krisnayuda50@gmail.com",       angkatan: 19 },
  { name: "Rifqi Ryan",                  email: "ryanavilar@gmail.com",         angkatan: 20 },
  { name: "Ahmad Jawwad Furqon",         email: "ahmadjfurqon@gmail.com",      angkatan: 21 },
  { name: "Boas Suhat",                  email: "boassuhat@gmail.com",          angkatan: 22 },
  { name: "Mochamad Fahmi T. H.",        email: "mochfahmi08@gmail.com",        angkatan: 23 },
  { name: "Linggis Galih Wiseso",        email: "galihwiseso@gmail.com",        angkatan: 24 },
  { name: "Moh. Mahrus Ali",             email: "mohmahrusali02@gmail.com",     angkatan: 26 },
  { name: "Gabriella Dinida Ael",        email: "ggdinida@gmail.com",           angkatan: 27 },
  { name: "Yohanes Adelino Apur",        email: "yohanesaapur@gmail.com",       angkatan: 29 },
  { name: "Beltzasar Kalebz",            email: "kalebsalamuk@gmail.com",       angkatan: 30 },
  { name: "Muhammad Naufal Abiy Pratama", email: "naufal.abiy0505@gmail.com",   angkatan: 31 },
  { name: "Bisma Nafis Attala Daniswara", email: "nafisbisma@gmail.com",        angkatan: 32 },
  { name: "Gery Valentino Fernandez",    email: "geryfernandez087@gmail.com",   angkatan: 33 },
];

async function createOrUpdateUser(entry) {
  const { name, email, angkatan } = entry;
  console.log(`\n👤 Processing: ${name} (${email}) — TN${angkatan}`);

  // Cek apakah user sudah ada
  const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const existing = allUsers?.find((u) => u.email === email);

  let userId;

  if (existing) {
    console.log(`   ℹ️  User sudah ada (${existing.id}), skip buat — update role & angkatan`);
    userId = existing.id;
    // Update name & flag kalau belum ada
    const needsUpdate = !existing.user_metadata?.name || existing.user_metadata?.must_change_password === undefined;
    if (needsUpdate) {
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existing.user_metadata,
          name: existing.user_metadata?.name || name,
          must_change_password: existing.user_metadata?.must_change_password ?? true,
        },
      });
      console.log(`   ✏️  Metadata diupdate: name=${name}, must_change_password=true`);
    }
  } else {
    // Buat akun baru
    const { data: created, error } = await adminClient.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name, must_change_password: true },
    });

    if (error) {
      console.error(`   ❌ Gagal buat akun: ${error.message}`);
      return;
    }

    userId = created.user.id;
    console.log(`   ✅ Akun dibuat: ${userId}`);
  }

  // Set role campaigner
  const { error: roleError } = await adminClient
    .from("user_roles")
    .upsert({ user_id: userId, role: "campaigner" }, { onConflict: "user_id" });

  if (roleError) {
    console.error(`   ❌ Gagal set role: ${roleError.message}`);
    return;
  }
  console.log(`   ✅ Role: campaigner`);

  // Set angkatan assignment
  // Hapus yang lama dulu
  await adminClient.from("campaigner_angkatan").delete().eq("user_id", userId);

  const { error: angkatanError } = await adminClient
    .from("campaigner_angkatan")
    .insert({ user_id: userId, angkatan });

  if (angkatanError) {
    console.error(`   ❌ Gagal set angkatan: ${angkatanError.message}`);
    return;
  }
  console.log(`   ✅ Angkatan: TN${angkatan}`);
}

async function main() {
  console.log("🚀 Seeding Tim Sukses...");
  console.log(`📡 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Password default: ${DEFAULT_PASSWORD}`);
  console.log("─".repeat(50));

  for (const entry of TIM_SUKSES) {
    await createOrUpdateUser(entry);
  }

  console.log("\n" + "─".repeat(50));
  console.log("✅ Selesai! Semua Tim Sukses sudah dibuat.");
  console.log(`\n⚠️  PENTING: Password default semua akun adalah: ${DEFAULT_PASSWORD}`);
  console.log("   Minta setiap Tim Sukses ganti password setelah login pertama.");
}

main().catch(console.error);
