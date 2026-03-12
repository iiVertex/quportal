"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CircleAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type Course = Tables<"courses">;

type AttendanceRecord = {
  maxAbsences: string;
  currentAbsences: string;
};

type WarningLevel = "not-set" | "early" | "safe" | "watch" | "high" | "critical" | "exceeded";

const EMPTY_RECORD: AttendanceRecord = {
  maxAbsences: "",
  currentAbsences: "",
};

function getWarningLevel(currentAbsences: number, maxAbsences: number): WarningLevel {
  if (maxAbsences <= 0) {
    return "not-set";
  }

  if (currentAbsences > maxAbsences) {
    return "exceeded";
  }

  const usage = (currentAbsences / maxAbsences) * 100;

  if (usage >= 90) {
    return "critical";
  }

  if (usage >= 75) {
    return "high";
  }

  if (usage >= 50) {
    return "watch";
  }

  if (usage >= 25) {
    return "early";
  }

  return "safe";
}

function getWarningMeta(level: WarningLevel) {
  switch (level) {
    case "early":
      return {
        label: "25%",
        description: "You have used at least 25% of the attendance limit.",
        badgeClassName: "bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-300",
        accentClassName: "border-sky-200",
      };
    case "safe":
      return {
        label: "Safe",
        description: "You are still below the first warning threshold.",
        badgeClassName: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300",
        accentClassName: "border-emerald-200",
      };
    case "watch":
      return {
        label: "Watch",
        description: "You are halfway to the attendance limit.",
        badgeClassName: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300",
        accentClassName: "border-amber-200",
      };
    case "high":
      return {
        label: "High",
        description: "You are getting close to the attendance limit.",
        badgeClassName: "bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-300",
        accentClassName: "border-orange-200",
      };
    case "critical":
      return {
        label: "Critical",
        description: "One more absence could become a problem soon.",
        badgeClassName: "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300",
        accentClassName: "border-rose-200",
      };
    case "exceeded":
      return {
        label: "Exceeded",
        description: "You have gone over the allowed absence limit.",
        badgeClassName: "bg-destructive text-white hover:bg-destructive",
        accentClassName: "border-destructive/40",
      };
    case "not-set":
    default:
      return {
        label: "Set limit",
        description: "Enter the course absence limit to calculate warnings.",
        badgeClassName: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-500/15 dark:text-slate-300",
        accentClassName: "border-slate-200",
      };
  }
}

function parseAbsenceValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
}

export default function AttendancePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [riskFilter, setRiskFilter] = useState<
    "all" | "safe" | "early" | "watch" | "high" | "critical" | "exceeded"
  >("all");

  useEffect(() => {
    async function loadCourses() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const fetchedCourses = data || [];
      const storageKey = `attendance-tracker:${user.id}`;
      const rawValue = window.localStorage.getItem(storageKey);
      let storedAttendance: Record<string, AttendanceRecord> = {};

      if (rawValue) {
        try {
          storedAttendance = JSON.parse(rawValue) as Record<string, AttendanceRecord>;
        } catch {
          storedAttendance = {};
        }
      }

      const normalizedAttendance = fetchedCourses.reduce<Record<string, AttendanceRecord>>((accumulator, course) => {
        accumulator[course.id] = storedAttendance[course.id] || EMPTY_RECORD;
        return accumulator;
      }, {});

      setCourses(fetchedCourses);
      setAttendance(normalizedAttendance);
      setHydrated(true);
      setLoading(false);
    }

    loadCourses();
  }, []);

  useEffect(() => {
    if (!userId || !hydrated) {
      return;
    }

    window.localStorage.setItem(`attendance-tracker:${userId}`, JSON.stringify(attendance));
  }, [attendance, hydrated, userId]);

  const updateAttendanceValue = (
    courseId: string,
    field: keyof AttendanceRecord,
    value: string,
  ) => {
    const sanitizedValue = value.replace(/[^\d]/g, "");

    setAttendance((current) => ({
      ...current,
      [courseId]: {
        ...(current[courseId] || EMPTY_RECORD),
        [field]: sanitizedValue,
      },
    }));
  };

  const resetCourseAttendance = (courseId: string) => {
    setAttendance((current) => ({
      ...current,
      [courseId]: EMPTY_RECORD,
    }));
  };

  const attendanceByCourse = courses.map((course) => {
    const values = attendance[course.id] || EMPTY_RECORD;
    const maxAbsences = parseAbsenceValue(values.maxAbsences);
    const currentAbsences = parseAbsenceValue(values.currentAbsences);
    const warningLevel = getWarningLevel(currentAbsences, maxAbsences);
    const usagePercentage = maxAbsences > 0
      ? Math.min(Math.round((currentAbsences / maxAbsences) * 100), 100)
      : 0;

    return {
      course,
      values,
      maxAbsences,
      currentAbsences,
      warningLevel,
      usagePercentage,
      remainingAbsences: Math.max(maxAbsences - currentAbsences, 0),
      overLimitBy: Math.max(currentAbsences - maxAbsences, 0),
    };
  });

  const configuredCourses = attendanceByCourse.filter((item) => item.maxAbsences > 0).length;
  const safeCourses = attendanceByCourse.filter((item) => item.warningLevel === "safe").length;
  const atRiskCourses = attendanceByCourse.filter((item) => ["early", "watch", "high", "critical"].includes(item.warningLevel)).length;
  const exceededCourses = attendanceByCourse.filter((item) => item.warningLevel === "exceeded").length;
  const filteredAttendance = attendanceByCourse.filter((item) => {
    if (riskFilter === "all") {
      return true;
    }

    return item.warningLevel === riskFilter;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            Attendance
          </h1>
          <p className="mt-1 text-muted-foreground">
            Track absences for each course and see how close you are to the allowed limit.
          </p>
        </div>
        <Badge variant="outline" className="w-fit rounded-xl px-3 py-1 text-sm">
          Saved in this browser for your account
        </Badge>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200/80">
          <CardHeader className="space-y-1">
            <CardDescription>Configured Courses</CardDescription>
            <CardTitle className="text-3xl">{configuredCourses}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Courses with a max absence value entered
          </CardContent>
        </Card>

        <Card className="border-emerald-200/80">
          <CardHeader className="space-y-1">
            <CardDescription>Safe Courses</CardDescription>
            <CardTitle className="text-3xl">{safeCourses}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Below 50% of the absence limit
          </CardContent>
        </Card>

        <Card className="border-amber-200/80">
          <CardHeader className="space-y-1">
            <CardDescription>At Risk</CardDescription>
            <CardTitle className="text-3xl">{atRiskCourses}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            25%, watch, high, and critical warning levels
          </CardContent>
        </Card>

        <Card className="border-rose-200/80">
          <CardHeader className="space-y-1">
            <CardDescription>Exceeded Limit</CardDescription>
            <CardTitle className="text-3xl">{exceededCourses}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Courses that are already over the limit
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter by Riskiness</CardTitle>
          <CardDescription>
            Show only courses that match a specific attendance warning level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "safe", label: "Safe" },
              { value: "early", label: "25%" },
              { value: "watch", label: "Watch" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
              { value: "exceeded", label: "Exceeded" },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={riskFilter === option.value ? "default" : "outline"}
                className="rounded-2xl"
                onClick={() => setRiskFilter(option.value as typeof riskFilter)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {filteredAttendance.length} of {attendanceByCourse.length} course{attendanceByCourse.length === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>

      {attendanceByCourse.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-muted p-4">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold">No courses yet</h2>
              <p className="text-sm text-muted-foreground">
                Add your courses first, then you can track absences and warning levels here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredAttendance.map((item) => {
            const meta = getWarningMeta(item.warningLevel);

            return (
              <Card key={item.course.id} className={meta.accentClassName}>
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.course.color || "#D4AF37" }}
                        />
                        <Badge variant="outline" className="rounded-xl px-2.5 py-1 text-xs">
                          {item.course.code}
                        </Badge>
                      </div>
                      <div>
                        <CardTitle className="text-xl">{item.course.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {item.course.instructor || "Instructor not set"}
                        </CardDescription>
                      </div>
                    </div>

                    <Badge className={`rounded-xl px-3 py-1 ${meta.badgeClassName}`}>
                      {item.warningLevel === "critical" || item.warningLevel === "exceeded" ? (
                        <CircleAlert className="h-3.5 w-3.5" />
                      ) : null}
                      {meta.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`max-${item.course.id}`}>Max absences</Label>
                      <Input
                        id={`max-${item.course.id}`}
                        inputMode="numeric"
                        placeholder="e.g. 7"
                        value={item.values.maxAbsences}
                        onChange={(event) => updateAttendanceValue(item.course.id, "maxAbsences", event.target.value)}
                        className="rounded-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`current-${item.course.id}`}>Current absences</Label>
                      <Input
                        id={`current-${item.course.id}`}
                        inputMode="numeric"
                        placeholder="e.g. 3"
                        value={item.values.currentAbsences}
                        onChange={(event) => updateAttendanceValue(item.course.id, "currentAbsences", event.target.value)}
                        className="rounded-2xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Absence usage</span>
                      <span className="font-medium">
                        {item.maxAbsences > 0 ? `${item.usagePercentage}%` : "Waiting for limit"}
                      </span>
                    </div>
                    <Progress value={item.usagePercentage} className="h-2.5" />
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current</p>
                      <p className="mt-2 text-2xl font-semibold">{item.currentAbsences}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {item.maxAbsences > 0 ? item.remainingAbsences : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Over limit</p>
                      <p className="mt-2 text-2xl font-semibold">{item.overLimitBy}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {item.maxAbsences > 0
                        ? `${item.currentAbsences} out of ${item.maxAbsences} absences used`
                        : "Enter the max absences to enable warnings"}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => resetCourseAttendance(item.course.id)}
                    >
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {attendanceByCourse.length > 0 && filteredAttendance.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No courses match the selected risk level.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}