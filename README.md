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
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_long_random_secret
```

## Cron Job (cron-job.org)

This project includes a secure cron endpoint that marks past-due assignments as `overdue`:

- Endpoint: `/api/cron/mark-overdue`
- Method: `GET`
- Auth: `Authorization: Bearer <CRON_SECRET>` header (or `?secret=<CRON_SECRET>` query param)

### 1) Deploy your app

Deploy to Vercel (or any host) first, then copy your production URL, for example:

`https://your-app.vercel.app`

### 2) Set production env vars

In your deployment provider, set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### 3) Create the cron on cron-job.org

1. Open [cron-job.org](https://cron-job.org) and create a new cronjob.
2. Use URL: `https://your-app.vercel.app/api/cron/mark-overdue`
3. Request method: `GET`
4. In advanced settings, add header:
	 - `Authorization: Bearer <YOUR_CRON_SECRET>`
5. Set a schedule (recommended: every 15 minutes).
6. Save and run once manually from cron-job.org.

### 4) Verify it works

Call the endpoint once and confirm JSON response like:

```json
{
	"ok": true,
	"updated": 3,
	"ranAt": "2026-03-24T12:34:56.000Z"
}
```
