import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Require verified email
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your email address before using this feature." },
        { status: 403 }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id, "parse-pdf", RATE_LIMITS.parsePdf);
    if (!rateLimit.allowed) {
      const retryAfterMin = Math.ceil(rateLimit.resetInMs / 60_000);
      return NextResponse.json(
        { error: `Rate limit exceeded. Please try again in ${retryAfterMin} minute(s).` },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rateLimit.resetInMs / 1000)) },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "A PDF file is required" },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const { text } = await extractText(buffer);
    const fullText = text.join("\n");

    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from this PDF. It may be image-based." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: fullText });
  } catch (error) {
    console.error("PDF parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse PDF" },
      { status: 500 }
    );
  }
}
