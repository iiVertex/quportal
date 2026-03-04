"use client";

import { useEffect, useState } from "react";
import { BookOpen, BarChart3, CheckSquare, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Course = Tables<"courses">;
type Assignment = Tables<"assignments">;
type Task = Tables<"tasks">;

export default function DashboardPage() {
  const [userName, setUserName] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Student");

      const [coursesRes, assignmentsRes, tasksRes] = await Promise.all([
        supabase.from("courses").select("*").eq("user_id", user.id),
        supabase.from("assignments").select("*").eq("user_id", user.id).order("due_date", { ascending: true }),
        supabase.from("tasks").select("*").eq("user_id", user.id).order("due_date", { ascending: true }),
      ]);

      setCourses(coursesRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setTasks(tasksRes.data || []);
      setLoading(false);
    }

    loadData();
  }, []);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const upcomingAssignments = assignments
    .filter((a) => a.due_date && new Date(a.due_date) >= new Date() && a.status !== "completed")
    .slice(0, 5);

  const pendingTasks = tasks.filter((t) => !t.completed).slice(0, 5);

  const gradedAssignments = assignments.filter((a) => a.grade !== null && a.max_grade !== null);
  const avgGrade = gradedAssignments.length > 0
    ? Math.round(
        gradedAssignments.reduce((acc, a) => acc + ((a.grade! / a.max_grade!) * 100), 0) / gradedAssignments.length
      )
    : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
          {getGreeting()}, {userName} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s an overview of your academic progress.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary stroke-[2px]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Courses</p>
                <p className="text-2xl font-semibold tabular-nums">{courses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-chart-3/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-chart-3 stroke-[2px]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Grade</p>
                <p className="text-2xl font-semibold tabular-nums">{avgGrade !== null ? `${avgGrade}%` : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-chart-4/10 flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-chart-4 stroke-[2px]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasks Done</p>
                <p className="text-2xl font-semibold tabular-nums">{completedTasks}/{totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-chart-5/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-chart-5 stroke-[2px]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-semibold tabular-nums">{taskProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Progress Bar */}
      {totalTasks > 0 && (
        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Overall Task Progress</span>
              <span className="text-sm text-muted-foreground tabular-nums">{taskProgress}%</span>
            </div>
            <Progress value={taskProgress} className="h-2 rounded-full" />
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Assignments */}
        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold" style={{ letterSpacing: "-0.02em" }}>
              <Clock className="h-5 w-5 text-primary stroke-[2px]" />
              Upcoming Assignments
            </CardTitle>
            <CardDescription>Next deadlines to meet</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming assignments. 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((a) => {
                  const course = courses.find((c) => c.id === a.course_id);
                  const dueDate = a.due_date ? new Date(a.due_date) : null;
                  const daysLeft = dueDate
                    ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: course?.color || "#4F46E5" }}
                        />
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {course?.code || "Unknown"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {daysLeft !== null && daysLeft <= 2 && (
                          <AlertCircle className="h-4 w-4 text-destructive stroke-[2px]" />
                        )}
                        <Badge
                          variant={daysLeft !== null && daysLeft <= 2 ? "destructive" : "secondary"}
                          className="rounded-xl text-xs"
                        >
                          {daysLeft !== null
                            ? daysLeft === 0
                              ? "Today"
                              : daysLeft === 1
                              ? "Tomorrow"
                              : `${daysLeft}d left`
                            : "No date"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold" style={{ letterSpacing: "-0.02em" }}>
              <CheckSquare className="h-5 w-5 text-primary stroke-[2px]" />
              Pending Tasks
            </CardTitle>
            <CardDescription>Things to do</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                All tasks completed! 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((t) => {
                  const course = courses.find((c) => c.id === t.course_id);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: course?.color || "#4F46E5",
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium">{t.title}</p>
                          {t.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Due {new Date(t.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`rounded-xl text-xs ${
                          t.priority === "high"
                            ? "border-destructive text-destructive"
                            : t.priority === "medium"
                            ? "border-chart-4 text-chart-4"
                            : ""
                        }`}
                      >
                        {t.priority}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
