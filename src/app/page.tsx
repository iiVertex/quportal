import Link from "next/link";
import { GraduationCap, ArrowRight, BookOpen, BarChart3, CheckSquare, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-[#F3F4F6] dark:border-[#1E2130] backdrop-blur-md sticky top-0 z-50 bg-background/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary stroke-[2px]" />
            <span className="text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.02em" }}>QU</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="rounded-2xl">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-2xl">
                Get Started
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <GraduationCap className="h-4 w-4" />
            Student Dashboard
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight" style={{ letterSpacing: "-0.02em" }}>
            Everything you need,{" "}
            <span className="text-primary">one dashboard.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Manage your courses, track grades, organize tasks, and let AI analyze
            your syllabi — all in one clean, minimal workspace built for students.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-2xl text-base px-8">
                Start for Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: BookOpen,
              title: "Course Manager",
              desc: "Add and organize all your courses with details, colors, and schedules.",
            },
            {
              icon: BarChart3,
              title: "Grade Tracker",
              desc: "Track assignments, weights, and calculate your GPA automatically.",
            },
            {
              icon: CheckSquare,
              title: "Task Planner",
              desc: "Stay on top of deadlines with a prioritized task system.",
            },
            {
              icon: Brain,
              title: "AI Syllabus",
              desc: "Upload your syllabus PDF and let AI extract key dates and info.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-card border border-[#F3F4F6] dark:border-[#1E2130] rounded-3xl p-6 space-y-3 hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-200"
            >
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary stroke-[2px]" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#F3F4F6] dark:border-[#1E2130] py-6">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} QU. Built for students, by students.
        </div>
      </footer>
    </div>
  );
}
