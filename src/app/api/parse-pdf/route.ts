import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";
import mammoth from "mammoth";
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

    if (!file) {
      return NextResponse.json(
        { error: "A file is required" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || fileName.endsWith(".pdf");
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.endsWith(".docx");
    const isTextLike =
      file.type.startsWith("text/") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md");

    if (!isPdf && !isDocx && !isTextLike) {
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload PDF, DOCX, TXT, or MD files.",
        },
        { status: 400 }
      );
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    let fullText = "";

    if (isPdf) {
      const { text } = await extractText(buffer);
      fullText = text.join("\n");
    } else if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      fullText = result.value;
    } else {
      fullText = new TextDecoder("utf-8").decode(buffer);
    }

    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract readable text from this file." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: fullText });
  } catch (error) {
    console.error("Document parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse file" },
      { status: 500 }
    );
  }
}
