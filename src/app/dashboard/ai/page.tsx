"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Brain, Upload, FileText, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCourses } from "@/hooks/use-data";
import { createClient } from "@/lib/supabase/client";

interface GradingItem {
  title: string;
  weight: number;
  type: string;
  dueDate: string | null;
}

interface GradingCategory {
  category: string;
  totalWeight: number;
  count: number;
  dropLowest: number;
  type: string;
  items: GradingItem[];
}

interface AnalysisResult {
  courseName: string;
  instructor: string;
  schedule: string;
  officeHours: string;
  gradingBreakdown: GradingCategory[];
  textbooks: string[];
  policies: string[];
  summary: string;
}

export default function AIPage() {
  const { courses } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (analyzing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          // Slowly increase progress, maxing out at 95% until complete
          if (prev >= 95) return 95;
          return prev + (95 - prev) * 0.05;
        });
      }, 500);
    } else {
      if (result) setProgress(100);
    }
    return () => clearInterval(interval);
  }, [analyzing, result]);

  const handleAnalyze = useCallback(async (text?: string) => {
    const content = text || syllabusText;
    if (!content.trim()) {
      setError("Please paste your syllabus text or upload a PDF.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setResult(null);
    setSaved(false);

    try {
      const response = await fetch("/api/analyze-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content,
          courseId: selectedCourse || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed. Please try again.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAnalyzing(false);
    }
  }, [syllabusText, selectedCourse]);

  const handleSaveGradeEntries = async () => {
    if (!result || !selectedCourse) {
      setError("Please select a course to save grade entries to.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const assignments = result.gradingBreakdown.flatMap((category) =>
        category.items.map((item) => ({
          user_id: user.id,
          course_id: selectedCourse,
          title: item.title,
          type: item.type as "assignment" | "quiz" | "exam" | "project" | "lab" | "other",
          weight: item.weight,
          max_grade: 100,
          due_date: item.dueDate || null,
          description: category.dropLowest > 0
            ? `${category.category} — drop lowest ${category.dropLowest}`
            : category.category,
          status: "pending" as const,
          priority: item.type === "exam" ? ("high" as const) : ("medium" as const),
        }))
      );

      const { error: insertError } = await supabase.from("assignments").insert(assignments);
      if (insertError) throw insertError;

      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save grade entries");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "text/plain") {
      const text = await file.text();
      setSyllabusText(text);
      handleAnalyze(text);
    } else if (file.type === "application/pdf") {
      setError("");
      setAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to parse PDF");
          setAnalyzing(false);
        } else {
          setSyllabusText(data.text);
          // Auto-analyze: don't setAnalyzing(false) — handleAnalyze will manage it
          setAnalyzing(false);
          handleAnalyze(data.text);
        }
      } catch {
        setError("Failed to upload PDF");
        setAnalyzing(false);
      }
    } else {
      setError("Please upload a .txt or .pdf file.");
    }

    // Reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>AI Syllabus Analyzer</h1>
        <p className="text-muted-foreground mt-1">
          Upload your syllabus and let AI extract key information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold" style={{ letterSpacing: "-0.02em" }}>
                <FileText className="h-5 w-5 text-primary stroke-[2px]" />
                Input
              </CardTitle>
              <CardDescription>Upload a syllabus file to automatically extract grades and dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Link to Course (optional)</Label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button 
                  disabled={analyzing} 
                  className="rounded-2xl gap-2 w-full" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading & Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload & Analyze Syllabus
                    </>
                  )}
                </Button>
                {analyzing && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>Analyzing document...</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2 rounded-full" />
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Summary */}
              <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold" style={{ letterSpacing: "-0.02em" }}>
                    <Brain className="h-5 w-5 text-primary stroke-[2px]" />
                    Analysis Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-2xl bg-muted/50">
                    <p className="text-sm">{result.summary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {result.courseName && (
                      <div className="p-3 rounded-2xl bg-muted/50">
                        <p className="text-xs text-muted-foreground">Course</p>
                        <p className="text-sm font-medium">{result.courseName}</p>
                      </div>
                    )}
                    {result.instructor && (
                      <div className="p-3 rounded-2xl bg-muted/50">
                        <p className="text-xs text-muted-foreground">Instructor</p>
                        <p className="text-sm font-medium">{result.instructor}</p>
                      </div>
                    )}
                    {result.schedule && (
                      <div className="p-3 rounded-2xl bg-muted/50">
                        <p className="text-xs text-muted-foreground">Schedule</p>
                        <p className="text-sm font-medium">{result.schedule}</p>
                      </div>
                    )}
                    {result.officeHours && (
                      <div className="p-3 rounded-2xl bg-muted/50">
                        <p className="text-xs text-muted-foreground">Office Hours</p>
                        <p className="text-sm font-medium">{result.officeHours}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Grading Breakdown */}
              {result.gradingBreakdown.length > 0 && (
                <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Grading Breakdown</CardTitle>
                      {selectedCourse && !saved && (
                        <Button
                          size="sm"
                          className="rounded-2xl gap-2"
                          onClick={handleSaveGradeEntries}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {saving ? "Saving..." : "Create Grade Entries"}
                        </Button>
                      )}
                      {saved && (
                        <Badge variant="secondary" className="rounded-xl gap-1 text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Saved to Grades
                        </Badge>
                      )}
                    </div>
                    {!selectedCourse && (
                      <p className="text-xs text-muted-foreground">
                        Select a course above to auto-create grade entries
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.gradingBreakdown.map((category, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{category.category}</p>
                              <Badge variant="outline" className="rounded-xl text-xs">
                                {category.totalWeight}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{category.count} item{category.count !== 1 ? "s" : ""}</span>
                              {category.dropLowest > 0 && (
                                <Badge variant="secondary" className="rounded-xl text-xs">
                                  drop lowest {category.dropLowest}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 space-y-1">
                            {category.items.map((item, j) => (
                              <div key={j} className="flex items-center justify-between p-2 rounded-xl bg-muted/50 text-sm">
                                <span>{item.title}</span>
                                <div className="flex items-center gap-2">
                                  {item.dueDate && (
                                    <span className="text-xs text-muted-foreground">{item.dueDate}</span>
                                  )}
                                  <Badge variant="secondary" className="rounded-xl text-xs">{item.weight}%</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Textbooks */}
              {result.textbooks.length > 0 && (
                <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
                  <CardHeader>
                    <CardTitle className="text-base">Textbooks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.textbooks.map((book, i) => (
                        <li key={i} className="text-sm p-2 rounded-xl bg-muted/50">
                          📚 {book}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
                  <Brain className="h-8 w-8 text-primary stroke-[2px]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Ready to analyze</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Paste your syllabus text on the left and click &quot;Analyze&quot; to extract key
                  information using AI.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
