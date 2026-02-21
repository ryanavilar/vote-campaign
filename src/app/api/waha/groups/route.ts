import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserRole, canManageUsers } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const role = await getUserRole(supabase);
  if (!canManageUsers(role)) {
    return NextResponse.json(
      { error: "Tidak memiliki akses" },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const baseUrl = searchParams.get("baseUrl");
  const session = searchParams.get("session") || "default";
  const apiKey = searchParams.get("apiKey");

  if (!baseUrl) {
    return NextResponse.json(
      { error: "baseUrl wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(
      `${baseUrl}/api/${session}/chats?chatType=group`,
      { headers }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Gagal mengambil daftar grup: " + message },
      { status: 500 }
    );
  }
}
