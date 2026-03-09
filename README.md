# Ikastara Kita Dashboard

Dashboard manajemen kampanye pemilihan untuk organisasi alumni **Ikastara Kita**. Dibangun untuk membantu Tim Sukses melacak progres canvassing, pendekatan ke target pemilih, dan kegiatan kampanye.

---

## 🎯 Fitur Utama

### Canvassing Tracking
Lacak progres pendekatan ke setiap alumni melalui alur:
```
Kontak → Dukungan → Masuk Grup WA → DPT → Vote
```
- Status per langkah: **Sudah / Belum**
- Field dukungan: **Dukung / Ragu-ragu / Milih Sebelah / Terkonvert**

### Manajemen Target
- Database alumni yang di-assign per angkatan ke Tim Sukses
- Setiap campaigner hanya melihat target dari angkatan yang ditugaskan
- Lazy creation: data member dibuat otomatis saat pertama kali diupdate

### Kegiatan / Events
- Buat & kelola event: Silaturahmi, Rapat, Door-to-door, Rally, Sosialisasi
- Check-in via kode unik
- Tracking registrasi & kehadiran

### WhatsApp Group Integration
- Sinkronisasi via **WAHA** (WhatsApp HTTP API)
- Tracking otomatis siapa yang sudah masuk grup WA kampanye

### Leaderboard & Statistik
- Dashboard stats: total target, progres kontak, dukungan, dll
- Leaderboard performa antar Tim Sukses

### Manajemen Alumni
- Import & link data alumni ke member aktif
- Merge anggota duplikat
- Multi-phone support

---

## 👥 Role System

| Role | Akses |
|------|-------|
| `super_admin` | Full access — semua fitur & data |
| `admin` | Manage users, data, events |
| `campaigner` (Tim Sukses) | Lihat & update target angkatan yang di-assign |
| `viewer` | Read-only |

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Backend:** Supabase (PostgreSQL + Auth)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Icons:** Lucide React
- **Auth:** Supabase OTP (email-based 2FA)

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/ryanavilar/vote-campaign.git
cd vote-campaign
npm install
```

### 2. Environment Variables

Copy `.env.example` ke `.env.local` dan isi variabelnya:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SEED_SECRET_KEY=your-random-secret
```

### 3. Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 📁 Struktur Proyek

```
src/
├── app/
│   ├── (dashboard)/        # Halaman utama (protected)
│   │   ├── page.tsx        # Dashboard / Home
│   │   ├── target/         # Canvassing tracking
│   │   ├── anggota/        # Manajemen anggota
│   │   ├── kegiatan/       # Events & kehadiran
│   │   ├── wa-group/       # WhatsApp group tracking
│   │   ├── leaderboard/    # Leaderboard Tim Sukses
│   │   ├── harapan/        # Catatan harapan anggota
│   │   └── admin/          # Admin panel (users, alumni, settings)
│   ├── api/                # API routes (Next.js Route Handlers)
│   ├── login/              # Halaman login (OTP-based)
│   └── form/               # Public form (dukungan, registrasi)
├── components/             # Shared UI components
└── lib/                    # Utilities, types, Supabase clients
```

---

## 🗄️ Database

Menggunakan **Supabase (PostgreSQL)** dengan tabel utama:

| Tabel | Keterangan |
|-------|------------|
| `alumni` | Data alumni (nama, angkatan, nosis, dll) |
| `members` | Data kontak aktif yang sedang di-canvass |
| `user_roles` | Role per user |
| `campaigner_angkatan` | Assignment angkatan ke Tim Sukses |
| `events` | Kegiatan kampanye |
| `event_attendance` | Check-in kehadiran event |
| `wa_group_members` | Anggota grup WA yang tersinkronisasi |

---

## 📦 Scripts

```bash
npm run dev       # Development server
npm run build     # Production build
npm run start     # Production server
npm run lint      # Linting
```

Utility scripts di `scripts/`:
- `seed-alumni.mjs` — Import data alumni awal
- `apply-migration.mjs` — Jalankan migrasi database
- `extract-harapan.js` — Ekstrak data harapan
