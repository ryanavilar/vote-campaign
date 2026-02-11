export type StatusValue = "Sudah" | "Belum" | null;

export interface Member {
  id: string;
  no: number;
  nama: string;
  angkatan: number;
  no_hp: string;
  pic: string | null;
  status_dpt: StatusValue;
  sudah_dikontak: StatusValue;
  masuk_grup: StatusValue;
  vote: StatusValue;
  referred_by: string | null;
}

export interface Event {
  id: string;
  nama: string;
  jenis: "Silaturahmi" | "Rapat" | "Door-to-door" | "Rally" | "Sosialisasi" | "Lainnya";
  deskripsi: string | null;
  lokasi: string | null;
  tanggal: string;
  status: "Terjadwal" | "Berlangsung" | "Selesai" | "Dibatalkan";
  checkin_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  attendance_count?: number;
}

export interface EventAttendance {
  id: string;
  event_id: string;
  member_id: string;
  checked_in_at: string;
  checked_in_by: string | null;
  catatan: string | null;
  created_at: string;
  member?: Member;
}
