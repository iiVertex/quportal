"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, CheckSquare, Circle, CheckCircle2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Course = Tables<"courses">;
type Task = Tables<"tasks">;

export default function TasksPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [priority, setPriority] = useState<NonNullable<Task["priority"]>>("medium");
  const [dueDate, setDueDate] = useState("");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [coursesRes, tasksRes] = await Promise.all([
      supabase.from("courses").select("*").eq("user_id", user.id),
      supabase.from("tasks").select("*").eq("user_id", user.id).order("due_date", { ascending: true }),
    ]);

    setCourses(coursesRes.data || []);
    setTasks(tasksRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCourseId("");
    setPriority("medium");
    setDueDate("");
    setEditingTask(null);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setCourseId(task.course_id || "");
    setPriority(task.priority || "medium");
    setDueDate(task.due_date || "");
    setDialogOpen(true);
  };

  const handleSaveTask = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTask) {
      await supabase.from("tasks").update({
        course_id: courseId || null,
        title,
        description: description || null,
        due_date: dueDate || null,
        priority,
      }).eq("id", editingTask.id);
    } else {
      await supabase.from("tasks").insert({
        user_id: user.id,
        course_id: courseId || null,
        title,
        description: description || null,
        due_date: dueDate || null,
        priority,
        completed: false,
      });
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const toggleTask = async (task: Task) => {
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ completed: !task.completed, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
    fetchData();
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-2xl" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-2xl" />
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
          <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {pendingCount} pending · {completedCount} completed
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl gap-2">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
              <DialogDescription>{editingTask ? "Update the details of your task." : "Add a new task to your list."}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="e.g. Read Chapter 5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="Additional details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-2xl resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Course (optional)</Label>
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder="Select" />
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
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as NonNullable<Task["priority"]>)}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Due Date (optional)</Label>
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
              <Button onClick={handleSaveTask} disabled={!title} className="rounded-2xl">
                {editingTask ? "Save Details" : "Add Task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "completed"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="rounded-2xl capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card className="rounded-3xl border-[#F3F4F6] dark:border-[#1E2130] border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <CheckSquare className="h-8 w-8 text-primary stroke-[2px]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {filter === "completed" ? "No completed tasks" : "No tasks yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {filter === "completed"
                ? "Complete some tasks to see them here."
                : "Add your first task to start organizing."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const course = courses.find((c) => c.id === task.course_id);
            const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date();

            return (
              <Card
                key={task.id}
                className={`rounded-2xl border-[#F3F4F6] dark:border-[#1E2130] transition-all hover:shadow-[0px_4px_20px_rgba(0,0,0,0.05)] ${
                  task.completed ? "opacity-60" : ""
                }`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => toggleTask(task)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-chart-3" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${task.completed ? "line-through" : ""}`}>
                        {task.title}
                      </p>
                      {course && (
                        <Badge variant="outline" className="rounded-xl text-xs">
                          {course.code}
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {task.description}
                      </p>
                    )}
                    {task.due_date && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        Due {new Date(task.due_date).toLocaleDateString()}
                        {isOverdue && " (overdue)"}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-xl text-xs ${
                        task.priority === "high"
                          ? "border-destructive text-destructive"
                          : task.priority === "medium"
                          ? "border-chart-4 text-chart-4"
                          : ""
                      }`}
                    >
                      {task.priority}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary"
                      onClick={() => handleEditTask(task)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
