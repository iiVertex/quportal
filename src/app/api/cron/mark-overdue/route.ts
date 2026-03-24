import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ")
    ? header.slice(7).trim()
    : null;

  const querySecret = request.nextUrl.searchParams.get("secret");

  return bearer === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("assignments")
      .update({ status: "overdue", updated_at: nowIso })
      .lt("due_date", nowIso)
      .neq("status", "completed")
      .neq("status", "overdue")
      .select("id");

    if (error) {
      console.error("Cron mark-overdue error:", error);
      return NextResponse.json(
        { error: "Failed to mark overdue assignments." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      updated: data?.length ?? 0,
      ranAt: nowIso,
    });
  } catch (error) {
    console.error("Cron mark-overdue unexpected error:", error);
    return NextResponse.json({ error: "Cron job failed." }, { status: 500 });
  }
}
