/**
 * In-memory rate limiter for API routes & signup.
 * Supports per-user sliding windows and IP-based throttling.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 86_400_000);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 600_000);

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds (default: 1 hour) */
  windowMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Check if a key is within its rate limit.
 *
 * @param key - Unique identifier (userId:endpoint, ip:signup, etc.)
 * @param options - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
function check(key: string, options: RateLimitOptions): RateLimitResult {
  const { maxRequests, windowMs = 3600_000 } = options;
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetInMs = oldestInWindow + windowMs - now;
    return { allowed: false, remaining: 0, resetInMs };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetInMs: windowMs,
  };
}

/**
 * Check per-user rate limit for an API endpoint.
 * Enforces BOTH hourly and daily caps — the stricter one wins.
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  options: RateLimitOptions
): RateLimitResult {
  // Hourly check
  const hourlyResult = check(`${userId}:${endpoint}:hourly`, options);
  if (!hourlyResult.allowed) return hourlyResult;

  // Daily check (if a daily preset exists)
  const dailyPreset = DAILY_LIMITS[endpoint as keyof typeof DAILY_LIMITS];
  if (dailyPreset) {
    const dailyResult = check(`${userId}:${endpoint}:daily`, dailyPreset);
    if (!dailyResult.allowed) return dailyResult;
  }

  return hourlyResult;
}

/**
 * Check IP-based rate limit (used for signup throttling).
 */
export function checkIpRateLimit(
  ip: string,
  action: string,
  options: RateLimitOptions
): RateLimitResult {
  return check(`ip:${ip}:${action}`, options);
}

/** Hourly rate limit presets */
export const RATE_LIMITS = {
  /** AI syllabus analysis — expensive operation */
  analyzeSyllabus: { maxRequests: 15, windowMs: 3600_000 }, // 15 per hour
  /** PDF parsing — lighter operation */
  parsePdf: { maxRequests: 30, windowMs: 3600_000 }, // 30 per hour
} as const;

/** Daily rate limit presets (24h sliding window) */
const DAILY_LIMITS: Record<string, RateLimitOptions> = {
  "analyze-syllabus": { maxRequests: 50, windowMs: 86_400_000 }, // 50 per day
  "parse-pdf": { maxRequests: 100, windowMs: 86_400_000 }, // 100 per day
};

/** IP-based presets */
export const IP_LIMITS = {
  /** Max signups from a single IP address */
  signup: { maxRequests: 3, windowMs: 3600_000 }, // 3 accounts per hour per IP
} as const;

/** Max syllabus text length (characters) sent to the AI */
export const MAX_SYLLABUS_LENGTH = 50_000; // ~50k chars ≈ ~12k tokens
