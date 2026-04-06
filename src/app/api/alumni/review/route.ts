import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserRole, canManageUsers } from "@/lib/roles";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/**
 * GET /api/alumni/review — Fetch all pending alumni matches for admin review
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data, error } = await adminClient
      .from("pending_alumni_matches")
      .select(`
        id,
        similarity,
        created_at,
        member:members!member_id(id, nama, angkatan, no_hp),
        alumni:alumni!alumni_id(id, nama, angkatan)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      pending: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch pending matches" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alumni/review — Resolve a pending alumni match
 * Body: { match_id, action: "link" | "reject" | "relink", alumni_id? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase);

  if (!canManageUsers(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { match_id, action, alumni_id } = body;

    if (!match_id || !action) {
      return NextResponse.json({ error: "match_id and action required" }, { status: 400 });
    }

    if (!["link", "reject", "relink"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "relink" && !alumni_id) {
      return NextResponse.json({ error: "alumni_id required for relink" }, { status: 400 });
    }

    // Fetch the pending match
    const { data: match, error: matchError } = await adminClient
      .from("pending_alumni_matches")
      .select("id, member_id, alumni_id, status")
      .eq("id", match_id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (match.status !== "pending") {
      return NextResponse.json({ error: "Match already resolved" }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === "link") {
      // Link member to the matched alumni
      await adminClient
        .from("members")
        .update({ alumni_id: match.alumni_id })
        .eq("id", match.member_id);

      await adminClient
        .from("pending_alumni_matches")
        .update({ status: "linked", reviewed_by: user.id, reviewed_at: now })
        .eq("id", match_id);

    } else if (action === "reject") {
      // Mark member as non-alumni
      await adminClient
        .from("members")
        .update({ is_non_alumni: true })
        .eq("id", match.member_id);

      await adminClient
        .from("pending_alumni_matches")
        .update({ status: "rejected", reviewed_by: user.id, reviewed_at: now })
        .eq("id", match_id);

    } else if (action === "relink") {
      // Link member to a different alumni chosen by admin
      await adminClient
        .from("members")
        .update({ alumni_id })
        .eq("id", match.member_id);

      await adminClient
        .from("pending_alumni_matches")
        .update({ status: "linked", reviewed_by: user.id, reviewed_at: now })
        .eq("id", match_id);
    }

    return NextResponse.json({ success: true, action });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve match" },
      { status: 500 }
    );
  }
}
