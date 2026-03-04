"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, BarChart3, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Course = Tables<"courses">;
type Assignment = Tables<"assignments">;

export default function GradesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [type, setType] = useState<NonNullable<Assignment["type"]>>("assignment");
  const [weight, setWeight] = useState("");
  const [grade, setGrade] = useState("");
  const [maxGrade, setMaxGrade] = useState("100");
  const [dueDate, setDueDate] = useState("");

  // Inline editing state
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [inlineGrade, setInlineGrade] = useState("");
  const [inlineMaxGrade, setInlineMaxGrade] = useState("");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [coursesRes, assignmentsRes] = await Promise.all([
      supabase.from("courses").select("*").eq("user_id", user.id),
      supabase.from("assignments").select("*").eq("user_id", user.id).order("due_date", { ascending: true }),
    ]);

    const fetchedCourses = coursesRes.data || [];
    setCourses(fetchedCourses);
    setAssignments(assignmentsRes.data || []);
    if (!selectedCourse && fetchedCourses.length > 0) {
      setSelectedCourse(fetchedCourses[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setTitle("");
    setCourseId("");
    setType("assignment");
    setWeight("");
    setGrade("");
    setMaxGrade("100");
    setDueDate("");
    setEditingAssignment(null);
  };

  const openEditDialog = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setTitle(assignment.title);
    setCourseId(assignment.course_id);
    setType((assignment.type as NonNullable<Assignment["type"]>) || "assignment");
    setWeight(assignment.weight?.toString() || "");
    setGrade(assignment.grade?.toString() || "");
    setMaxGrade(assignment.max_grade?.toString() || "100");
    setDueDate(assignment.due_date || "");
    setDialogOpen(true);
  };

  const handleSaveAssignment = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !courseId) return;

    const assignmentData = {
      course_id: courseId,
      title,
      type,
      weight: weight ? parseFloat(weight) : null,
      grade: grade ? parseFloat(grade) : null,
      max_grade: maxGrade ? parseFloat(maxGrade) : null,
      due_date: dueDate || null,
      status: grade ? "completed" as const : "pending" as const,
    };

    if (editingAssignment) {
      await supabase
        .from("assignments")
        .update({ ...assignmentData, updated_at: new Date().toISOString() })
        .eq("id", editingAssignment.id);
    } else {
      await supabase.from("assignments").insert({
        ...assignmentData,
        user_id: user.id,
      });
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleInlineGradeSave = async (assignmentId: string) => {
    const supabase = createClient();
    await supabase.from("assignments").update({
      grade: inlineGrade ? parseFloat(inlineGrade) : null,
      max_grade: inlineMaxGrade ? parseFloat(inlineMaxGrade) : null,
      status: inlineGrade ? "completed" : "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", assignmentId);
    setEditingGradeId(null);
    fetchData();
  };

  const startInlineEdit = (assignment: Assignment) => {
    setEditingGradeId(assignment.id);
    setInlineGrade(assignment.grade?.toString() || "");
    setInlineMaxGrade(assignment.max_grade?.toString() || "100");
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("assignments").delete().eq("id", id);
    fetchData();
  };

  const filteredAssignments = selectedCourse
    ? assignments.filter((a) => a.course_id === selectedCourse)
    : assignments;

  // Calculate course averages (with drop-lowest support)
  const courseAverages = courses.map((course) => {
    const courseAssignments = assignments.filter(
      (a) => a.course_id === course.id && a.grade !== null && a.max_grade !== null
    );

    const hasWeights = courseAssignments.some((a) => a.weight !== null && a.weight > 0);

    // Group graded assignments by category (from description) to apply drop policies.
    // This lets "Short Quizzes" and "Long Quizzes" each have independent drop rules.
    const categoryGroups = new Map<string, typeof courseAssignments>();
    courseAssignments.forEach((a) => {
      // Use category from description (part before " — "), fall back to type
      const descCategory = a.description?.split(" — ")[0]?.trim();
      const key = descCategory || a.type || "other";
      if (!categoryGroups.has(key)) categoryGroups.set(key, []);
      categoryGroups.get(key)!.push(a);
    });

    // Apply drops per category and collect remaining assignments
    let effectiveAssignments: typeof courseAssignments = [];
    const dropInfo: { type: string; dropped: number; total: number }[] = [];

    categoryGroups.forEach((group, category) => {
      // Extract drop count from any assignment description in this group
      let dropCount = 0;
      group.forEach((a) => {
        const match = a.description?.match(/drop lowest (\d+)/i);
        if (match) dropCount = Math.max(dropCount, parseInt(match[1]));
      });

      if (dropCount > 0 && group.length > dropCount) {
        // Sort by percentage ascending (lowest first), drop the lowest N
        const sorted = [...group].sort((a, b) => {
          const pctA = (a.grade! / a.max_grade!) * 100;
          const pctB = (b.grade! / b.max_grade!) * 100;
          return pctA - pctB;
        });
        effectiveAssignments.push(...sorted.slice(dropCount));
        dropInfo.push({ type: category, dropped: dropCount, total: group.length });
      } else {
        effectiveAssignments.push(...group);
        if (dropCount > 0) {
          dropInfo.push({ type: category, dropped: dropCount, total: group.length });
        }
      }
    });

    let avg = 0;
    if (effectiveAssignments.length > 0) {
      if (hasWeights) {
        const totalWeight = effectiveAssignments.reduce((acc, a) => acc + (a.weight || 0), 0);
        avg = effectiveAssignments.reduce(
          (acc, a) => acc + ((a.grade! / a.max_grade!) * (a.weight || 0)),
          0
        ) / (totalWeight || 1) * 100;
      } else {
        avg = effectiveAssignments.reduce(
          (acc, a) => acc + (a.grade! / a.max_grade!) * 100,
          0
        ) / effectiveAssignments.length;
      }
    }

    return {
      course,
      average: Math.round(avg * 10) / 10,
      graded: courseAssignments.length,
      total: assignments.filter((a) => a.course_id === course.id).length,
      dropInfo,
    };
  });

  const getLetterGrade = (pct: number) => {
    if (pct >= 90) return "A";
    if (pct >= 85) return "B+";
    if (pct >= 80) return "B";
    if (pct >= 75) return "C+";
    if (pct >= 70) return "C";
    if (pct >= 65) return "D+";
    if (pct >= 60) return "D";
    return "F";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-2xl" />
        <div className="h-64 bg-muted animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>Grades</h1>
          <p className="text-muted-foreground mt-1">Track your academic performance</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl gap-2">
              <Plus className="h-4 w-4" />
              Add Grade
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAssignment ? "Edit Assignment" : "Add Assignment Grade"}</DialogTitle>
              <DialogDescription>
                {editingAssignment ? "Update the assignment details." : "Enter the details for the graded item."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue placeholder="Select course" />
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

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Midterm Exam"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as NonNullable<Assignment["type"]>)}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="lab">Lab</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Weight (%)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 20"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="rounded-2xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 85"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Grade</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={maxGrade}
                    onChange={(e) => setMaxGrade(e.target.value)}
                    className="rounded-2xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="rounded-2xl"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-2xl">
                Cancel
              </Button>
              <Button onClick={handleSaveAssignment} disabled={!title || !courseId} className="rounded-2xl">
                {editingAssignment ? "Save Changes" : "Add Grade"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
          <TabsTrigger value="details" className="rounded-xl">All Grades</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          {courseAverages.length === 0 ? (
            <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-8 w-8 text-primary stroke-[2px]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No grades yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add courses first, then start tracking your grades.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courseAverages.map(({ course, average, graded, total, dropInfo }) => (
                <Card key={course.id} className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] overflow-hidden hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200">
                  <div className="h-1.5" style={{ backgroundColor: course.color ?? undefined }} />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{course.name}</CardTitle>
                        <CardDescription>{course.code}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold tabular-nums">
                          {graded > 0 ? `${average}%` : "\u2014"}
                        </p>
                        {graded > 0 && (
                          <Badge variant="secondary" className="rounded-xl">
                            {getLetterGrade(average)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Progress
                      value={average}
                      className="h-2 rounded-full"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        {graded} of {total} items graded
                      </p>
                      {dropInfo.length > 0 && (
                        <p className="text-[11px] text-muted-foreground/70 italic">
                          {dropInfo.map((d) =>
                            `best ${d.total - d.dropped}/${d.total} ${d.type.toLowerCase()}`
                          ).join(", ")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6">
          <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">All Grades</CardTitle>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="w-48 rounded-2xl">
                    <SelectValue placeholder="Filter by course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No assignments found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((a) => {
                      const course = courses.find((c) => c.id === a.course_id);
                      const pct = a.grade !== null && a.max_grade
                        ? Math.round((a.grade / a.max_grade) * 100)
                        : null;
                      const isInlineEditing = editingGradeId === a.id;

                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-xl">
                              {course?.code || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{a.type}</TableCell>
                          <TableCell>{a.weight ? `${a.weight}%` : "—"}</TableCell>
                          <TableCell>
                            {isInlineEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={inlineGrade}
                                  onChange={(e) => setInlineGrade(e.target.value)}
                                  className="h-7 w-16 rounded-xl text-sm"
                                  placeholder="Score"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleInlineGradeSave(a.id);
                                    if (e.key === "Escape") setEditingGradeId(null);
                                  }}
                                />
                                <span className="text-muted-foreground">/</span>
                                <Input
                                  type="number"
                                  value={inlineMaxGrade}
                                  onChange={(e) => setInlineMaxGrade(e.target.value)}
                                  className="h-7 w-16 rounded-xl text-sm"
                                  placeholder="Max"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleInlineGradeSave(a.id);
                                    if (e.key === "Escape") setEditingGradeId(null);
                                  }}
                                />
                                <Button
                                  size="sm"
                                  className="h-7 rounded-xl text-xs px-2"
                                  onClick={() => handleInlineGradeSave(a.id)}
                                >
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startInlineEdit(a)}
                                className="text-left hover:underline cursor-pointer"
                              >
                                {pct !== null ? (
                                  <span className={pct >= 70 ? "text-chart-3" : "text-destructive"}>
                                    {a.grade}/{a.max_grade} ({pct}%)
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic">Click to enter grade</span>
                                )}
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl"
                                onClick={() => openEditDialog(a)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                                onClick={() => handleDelete(a.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
