import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (!code) {
    // No code — redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore — may be called from server component
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Token exchange failed — redirect to login with error
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  // Check if this is an invited user who needs to set their password
  // Invited users via Supabase have no confirmed password yet
  // Redirect them to onboarding to set up their password
  const type = searchParams.get("type");
  if (type === "invite" || type === "recovery") {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Default: redirect to dashboard or specified next page
  return NextResponse.redirect(new URL(next, request.url));
}
