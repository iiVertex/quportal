import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS, MAX_SYLLABUS_LENGTH } from "@/lib/rate-limit";

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

    // Require verified email before allowing AI calls
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Please verify your email address before using this feature." },
        { status: 403 }
      );
    }

    // Check rate limit (hourly + daily)
    const rateLimit = checkRateLimit(user.id, "analyze-syllabus", RATE_LIMITS.analyzeSyllabus);
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

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Syllabus text is required" },
        { status: 400 }
      );
    }

    // Enforce input size limit to prevent token abuse
    if (text.length > MAX_SYLLABUS_LENGTH) {
      return NextResponse.json(
        { error: `Syllabus text is too long (${Math.round(text.length / 1000)}k chars). Maximum is ${MAX_SYLLABUS_LENGTH / 1000}k characters.` },
        { status: 400 }
      );
    }

    const apiKey = process.env.COMET_API_KEY;

    if (!apiKey) {
      // Return mock data for development when no API key is configured
      return NextResponse.json(getMockAnalysis());
    }

    const prompt = `Analyze the following university course syllabus and extract structured information. Return a JSON object with these exact fields:

{
  "courseName": "Full course name",
  "instructor": "Instructor name",
  "schedule": "Class schedule (days/times)",
  "officeHours": "Office hours info",
  "gradingBreakdown": [
    {
      "category": "Category name (e.g. Quizzes, Assignments, Midterm)",
      "totalWeight": 20,
      "count": 5,
      "dropLowest": 1,
      "type": "quiz",
      "items": [
        { "title": "Quiz 1", "weight": 4, "type": "quiz", "dueDate": "2026-03-01" }
      ]
    }
  ],
  "textbooks": ["textbook title and author"],
  "policies": ["key policy points"],
  "summary": "A 2-3 sentence summary of the course"
}

GRADING BREAKDOWN RULES:
- "totalWeight" is the total percentage weight for the entire category (e.g. if "Quizzes" are worth 20% of the final grade, totalWeight = 20)
- "count" is how many items exist in this category (e.g. 5 quizzes)
- "dropLowest" is how many lowest scores are dropped (0 if none are dropped)
- "type" must be one of: "assignment", "quiz", "exam", "project", "lab", "other"
- "items" should list each individual graded item. If the syllabus says "5 quizzes" then create 5 items named "Quiz 1" through "Quiz 5"
- Each item's "weight" should be: totalWeight / (count - dropLowest). For example if 5 quizzes worth 20% total and drop lowest 1, each counting quiz weight = 20/4 = 5
- For items with known due dates, include "dueDate" in YYYY-MM-DD format. Use null if unknown.
- For single items (e.g. "Final Exam 30%"), count=1, dropLowest=0, and create 1 item

If any field cannot be determined from the syllabus, use an empty string, null, or empty array as appropriate. Return ONLY valid JSON, no markdown formatting.

SYLLABUS:
${text}`;

    const response = await fetch(
      "https://api.cometapi.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-lite-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 16384,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("CometAPI error:", errorData);
      return NextResponse.json(
        { error: "AI analysis failed. Please check your API key." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content;

    if (!responseText) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Clean up potential markdown code blocks
    const cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch {
      // If JSON is truncated, check if the model hit the token limit
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        console.error("AI response was truncated (hit token limit)");
        return NextResponse.json(
          { error: "The syllabus is too long for a single analysis. Try pasting a shorter section." },
          { status: 422 }
        );
      }
      console.error("Failed to parse AI response:", cleanedText.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Syllabus analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze syllabus" },
      { status: 500 }
    );
  }
}

function getMockAnalysis() {
  return {
    courseName: "Introduction to Computer Science",
    instructor: "Dr. Jane Smith",
    schedule: "MWF 10:00 AM - 11:15 AM",
    officeHours: "Tuesday/Thursday 2:00 PM - 4:00 PM, Room 305",
    gradingBreakdown: [
      {
        category: "Assignments",
        totalWeight: 30,
        count: 6,
        dropLowest: 1,
        type: "assignment",
        items: [
          { title: "Assignment 1", weight: 6, type: "assignment", dueDate: "2026-02-15" },
          { title: "Assignment 2", weight: 6, type: "assignment", dueDate: "2026-03-01" },
          { title: "Assignment 3", weight: 6, type: "assignment", dueDate: "2026-03-15" },
          { title: "Assignment 4", weight: 6, type: "assignment", dueDate: "2026-04-01" },
          { title: "Assignment 5", weight: 6, type: "assignment", dueDate: "2026-04-15" },
          { title: "Assignment 6", weight: 6, type: "assignment", dueDate: "2026-05-01" },
        ],
      },
      {
        category: "Quizzes",
        totalWeight: 10,
        count: 5,
        dropLowest: 1,
        type: "quiz",
        items: [
          { title: "Quiz 1", weight: 2.5, type: "quiz", dueDate: "2026-02-20" },
          { title: "Quiz 2", weight: 2.5, type: "quiz", dueDate: "2026-03-10" },
          { title: "Quiz 3", weight: 2.5, type: "quiz", dueDate: "2026-03-25" },
          { title: "Quiz 4", weight: 2.5, type: "quiz", dueDate: "2026-04-10" },
          { title: "Quiz 5", weight: 2.5, type: "quiz", dueDate: "2026-04-25" },
        ],
      },
      {
        category: "Midterm Exam",
        totalWeight: 25,
        count: 1,
        dropLowest: 0,
        type: "exam",
        items: [
          { title: "Midterm Exam", weight: 25, type: "exam", dueDate: "2026-03-15" },
        ],
      },
      {
        category: "Final Exam",
        totalWeight: 30,
        count: 1,
        dropLowest: 0,
        type: "exam",
        items: [
          { title: "Final Exam", weight: 30, type: "exam", dueDate: "2026-05-10" },
        ],
      },
      {
        category: "Participation",
        totalWeight: 5,
        count: 1,
        dropLowest: 0,
        type: "other",
        items: [
          { title: "Participation", weight: 5, type: "other", dueDate: null },
        ],
      },
    ],
    textbooks: [
      "Introduction to Algorithms by Cormen, Leiserson, Rivest, Stein",
      "Clean Code by Robert C. Martin",
    ],
    policies: [
      "Late submissions incur a 10% penalty per day",
      "Academic integrity policy applies to all submissions",
      "Attendance is mandatory and counts toward participation grade",
    ],
    summary:
      "This introductory computer science course covers fundamental programming concepts, data structures, and algorithms. Students will learn through a combination of lectures, hands-on assignments, and exams.",
  };
}
