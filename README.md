# UTM – University Tool Manager

A comprehensive university dashboard for managing courses, grades, tasks, and AI-powered syllabus analysis.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** (Auth, Database, RLS)
- **ShadCN UI** + **Tailwind CSS v4**
- **Gemini 2.0 Flash** (Syllabus Analysis)

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
GEMINI_API_KEY=your_key  # optional
```
