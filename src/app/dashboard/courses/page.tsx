"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, BookOpen, Upload, Loader2, FileText, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Course = Tables<"courses">;

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

const COURSE_COLORS = [
  "#4F46E5", "#7C3AED", "#10B981", "#06B6D4", "#F59E0B",
  "#EC4899", "#8B5CF6", "#14B8A6", "#F97316", "#6366F1",
];

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Multi-step: 1 = course details, 2 = syllabus upload
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [semester, setSemester] = useState("");
  const [credits, setCredits] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0]);

  // Syllabus step state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradesSaved, setGradesSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [savedCourseId, setSavedCourseId] = useState<string | null>(null);

  // Progress animation for analysis
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (analyzing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 95 ? 95 : prev + (95 - prev) * 0.05));
      }, 500);
    } else {
      if (analysisResult) setProgress(100);
    }
    return () => clearInterval(interval);
  }, [analyzing, analysisResult]);

  const fetchCourses = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("courses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setCourses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const resetForm = () => {
    setName("");
    setCode("");
    setInstructor("");
    setSemester("");
    setCredits("");
    setColor(COURSE_COLORS[0]);
    setEditingCourse(null);
    setStep(1);
    setAnalysisResult(null);
    setAnalysisError("");
    setSavingGrades(false);
    setGradesSaved(false);
    setProgress(0);
    setSavedCourseId(null);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setName(course.name);
    setCode(course.code);
    setInstructor(course.instructor || "");
    setSemester(course.semester || "");
    setCredits(course.credits?.toString() || "");
    setColor(course.color || "#8B7355");
    setStep(1);
    setDialogOpen(true);
  };

  // Step 1: Save course, then move to step 2 (or close if editing)
  const handleSaveCourse = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const courseData = {
      name,
      code,
      instructor: instructor || null,
      semester: semester || null,
      credits: credits ? parseInt(credits) : null,
      color,
    };

    if (editingCourse) {
      await supabase
        .from("courses")
        .update({ ...courseData, updated_at: new Date().toISOString() })
        .eq("id", editingCourse.id);
      setDialogOpen(false);
      resetForm();
      fetchCourses();
    } else {
      const { data } = await supabase.from("courses").insert({
        ...courseData,
        user_id: user.id,
      }).select().single();

      if (data) {
        setSavedCourseId(data.id);
        fetchCourses();
        setStep(2);
      }
    }
  };

  // Syllabus upload & analysis
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalysisError("");
    setAnalysisResult(null);
    setGradesSaved(false);

    const isPdf = file.type === "application/pdf";
    const isDoc = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                  file.type === "application/msword" ||
                  file.name.endsWith(".doc") || file.name.endsWith(".docx");
    const isText = file.type === "text/plain";

    if (!isPdf && !isDoc && !isText) {
      setAnalysisError("Please upload a PDF, Word document, or text file.");
      return;
    }

    setAnalyzing(true);

    try {
      let syllabusText = "";

      if (isText) {
        syllabusText = await file.text();
      } else {
        // Upload PDF/Word for parsing
        const formData = new FormData();
        formData.append("file", file);
        const parseRes = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });
        const parseData = await parseRes.json();
        if (!parseRes.ok) {
          throw new Error(parseData.error || "Failed to parse document");
        }
        syllabusText = parseData.text;
      }

      // Analyze with AI
      const analyzeRes = await fetch("/api/analyze-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: syllabusText }),
      });

      if (!analyzeRes.ok) {
        throw new Error("Analysis failed. Please try again.");
      }

      const result: AnalysisResult = await analyzeRes.json();
      setAnalysisResult(result);

      // Auto-fill instructor if empty from syllabus
      if (!instructor && result.instructor) {
        setInstructor(result.instructor);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save grade entries from analysis result
  const handleSaveGradeEntries = async () => {
    if (!analysisResult || !savedCourseId) return;

    setSavingGrades(true);
    setAnalysisError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const assignments = analysisResult.gradingBreakdown.flatMap((category) =>
        category.items.map((item) => ({
          user_id: user.id,
          course_id: savedCourseId,
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

      setGradesSaved(true);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to save grade entries");
    } finally {
      setSavingGrades(false);
    }
  };

  const handleDelete = async (courseId: string) => {
    const supabase = createClient();
    await supabase.from("courses").delete().eq("id", courseId);
    fetchCourses();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>Courses</h1>
          <p className="text-muted-foreground mt-1">
            Manage your enrolled courses
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl gap-2">
              <Plus className="h-4 w-4" />
              Add Course
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-md max-h-[85vh] overflow-y-auto">
            {/* Step indicator (only for new courses) */}
            {!editingCourse && (
              <div className="flex items-center gap-2 mb-1 mr-6">
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
              </div>
            )}

            {step === 1 ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {editingCourse ? "Edit Course" : "Add New Course"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCourse
                      ? "Update your course details."
                      : "Enter your course details. You'll upload the syllabus next."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Course Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Data Structures"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Course Code</Label>
                      <Input
                        id="code"
                        placeholder="e.g. CS201"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="credits">Credits</Label>
                      <Input
                        id="credits"
                        type="number"
                        placeholder="3"
                        value={credits}
                        onChange={(e) => setCredits(e.target.value)}
                        className="rounded-2xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructor">Instructor</Label>
                    <Input
                      id="instructor"
                      placeholder="e.g. Dr. Smith"
                      value={instructor}
                      onChange={(e) => setInstructor(e.target.value)}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="semester">Semester</Label>
                    <Input
                      id="semester"
                      placeholder="e.g. Spring 2026"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="rounded-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {COURSE_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={`h-8 w-8 rounded-full transition-all ${
                            color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => { setDialogOpen(false); resetForm(); }}
                    className="rounded-2xl"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCourse} className="rounded-2xl gap-1" disabled={!name || !code}>
                    {editingCourse ? "Update" : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Upload Syllabus</DialogTitle>
                  <DialogDescription>
                    Upload your syllabus to auto-create grade entries for <span className="font-medium text-foreground">{code}</span>. You can skip this step.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {!analysisResult && !analyzing && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-2xl p-8 text-center transition-colors group cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Click to upload syllabus</p>
                          <p className="text-xs text-muted-foreground mt-1">PDF, Word, or text file</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Analyzing state */}
                  {analyzing && (
                    <div className="space-y-3 p-4 rounded-2xl bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <p className="text-sm font-medium">Analyzing syllabus...</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Extracting information</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5 rounded-full" />
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {analysisError && (
                    <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      {analysisError}
                    </div>
                  )}

                  {/* Analysis results */}
                  {analysisResult && (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="p-3 rounded-2xl bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Summary</p>
                        <p className="text-sm">{analysisResult.summary}</p>
                      </div>

                      {/* Grading breakdown */}
                      {analysisResult.gradingBreakdown.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Grading Breakdown</p>
                            {!gradesSaved ? (
                              <Button
                                size="sm"
                                className="rounded-2xl gap-1.5 h-7 text-xs"
                                onClick={handleSaveGradeEntries}
                                disabled={savingGrades}
                              >
                                {savingGrades ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <FileText className="h-3 w-3" />
                                )}
                                {savingGrades ? "Saving..." : "Create Grade Entries"}
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="rounded-xl gap-1 text-green-600 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Saved
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {analysisResult.gradingBreakdown.map((category, i) => (
                              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50 text-sm">
                                <div className="flex items-center gap-2">
                                  <span>{category.category}</span>
                                  <Badge variant="outline" className="rounded-lg text-[10px] h-5">
                                    {category.totalWeight}%
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{category.count} item{category.count !== 1 ? "s" : ""}</span>
                                  {category.dropLowest > 0 && (
                                    <Badge variant="secondary" className="rounded-lg text-[10px] h-5">
                                      drop {category.dropLowest}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Re-upload option */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Upload a different file
                      </button>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="rounded-2xl gap-1"
                    size="sm"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant={gradesSaved || analysisResult ? "default" : "ghost"}
                    onClick={() => { setDialogOpen(false); resetForm(); }}
                    className="rounded-2xl"
                  >
                    {gradesSaved ? "Done" : analysisResult ? "Skip & Finish" : "Skip"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Course Grid */}
      {courses.length === 0 ? (
        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary stroke-[2px]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Add your first course to start tracking grades and assignments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200 group overflow-hidden"
            >
              <div className="h-2 rounded-t-3xl" style={{ backgroundColor: course.color ?? undefined }} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg" style={{ letterSpacing: "-0.02em" }}>{course.name}</h3>
                    <Badge variant="secondary" className="rounded-xl mt-1">
                      {course.code}
                    </Badge>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      onClick={() => openEditDialog(course)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                      onClick={() => handleDelete(course.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {course.instructor && (
                    <p>👤 {course.instructor}</p>
                  )}
                  {course.semester && (
                    <p>📅 {course.semester}</p>
                  )}
                  {course.credits && (
                    <p>📚 {course.credits} credits</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
