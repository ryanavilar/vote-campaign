import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, isSuperAdmin } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

const MIMIN_BASE_URL = "https://mimin-api.mimin.io/mimin-backend";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMiminToken(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "mimin_token")
    .single();
  return (data as { value: unknown } | null)?.value as string | null;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!isSuperAdmin(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const token = await getMiminToken(supabase);
  if (!token) {
    return NextResponse.json(
      { error: "Token Mimin.io belum dikonfigurasi. Atur di Pengaturan." },
      { status: 400 }
    );
  }

  const { searchParams } = request.nextUrl;
  const page = searchParams.get("page") || "1";
  const limit = searchParams.get("limit") || "100";
  const value = searchParams.get("value") || "";

  try {
    // Fetch all pages to get complete customer list
    const allCustomers: Record<string, unknown>[] = [];
    let currentPage = parseInt(page);
    const pageLimit = parseInt(limit);
    const fetchAll = searchParams.get("all") === "true";

    if (fetchAll) {
      // Fetch all pages
      let hasMore = true;
      let pg = 1;
      while (hasMore) {
        const url = `${MIMIN_BASE_URL}/api/v1/customer/get?order=_id&sort=1&page=${pg}&limit=500${value ? `&value=${encodeURIComponent(value)}` : ""}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Mimin API error ${res.status}: ${text}`);
        }
        const json = await res.json();
        const customers = json.data || [];
        allCustomers.push(...customers);
        hasMore = pg < (json.pages || 1);
        pg++;
      }

      return NextResponse.json({
        data: allCustomers,
        total: allCustomers.length,
      });
    } else {
      // Single page fetch
      const url = `${MIMIN_BASE_URL}/api/v1/customer/get?order=_id&sort=1&page=${currentPage}&limit=${pageLimit}${value ? `&value=${encodeURIComponent(value)}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Mimin API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      return NextResponse.json(json);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengambil data customer Mimin.io";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
