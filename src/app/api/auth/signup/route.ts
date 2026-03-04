import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkIpRateLimit, IP_LIMITS } from "@/lib/rate-limit";
import { isDisposableEmail } from "@/lib/disposable-emails";

export async function POST(request: NextRequest) {
  try {
    // Get client IP for signup throttling
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // IP-based signup throttle
    const ipLimit = checkIpRateLimit(ip, "signup", IP_LIMITS.signup);
    if (!ipLimit.allowed) {
      const retryMin = Math.ceil(ipLimit.resetInMs / 60_000);
      return NextResponse.json(
        { error: `Too many signup attempts. Please try again in ${retryMin} minute(s).` },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(ipLimit.resetInMs / 1000)) },
        }
      );
    }

    const { email, password, fullName, university } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Block disposable emails server-side too
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Disposable or temporary email addresses are not allowed." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || "",
          university: university || "",
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
