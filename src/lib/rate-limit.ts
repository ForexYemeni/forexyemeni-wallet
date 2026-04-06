// In-memory rate limiter with auto-cleanup

interface LoginAttempt {
  attempts: number
  firstAttempt: number
  lockedUntil: number | null
}

interface ApiRequest {
  count: number
  resetAt: number
}

const loginAttempts = new Map<string, LoginAttempt>()
const apiRequests = new Map<string, ApiRequest>()

// Configuration
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes lockout
const API_MAX_REQUESTS = 100
const API_WINDOW_MS = 60 * 1000 // 1 minute
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

// Auto-cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now()

  // Cleanup login attempts
  for (const [key, entry] of loginAttempts.entries()) {
    if (entry.lockedUntil && now > entry.lockedUntil) {
      loginAttempts.delete(key)
    } else if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
      loginAttempts.delete(key)
    }
  }

  // Cleanup API requests
  for (const [key, entry] of apiRequests.entries()) {
    if (now > entry.resetAt) {
      apiRequests.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

export function checkLoginRateLimit(ip: string, email: string): {
  blocked: boolean
  retryAfter: number
  remaining: number
} {
  const key = `${ip}:${email}`
  const now = Date.now()
  const entry = loginAttempts.get(key)

  if (!entry) {
    return { blocked: false, retryAfter: 0, remaining: LOGIN_MAX_ATTEMPTS }
  }

  // Check if locked
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      blocked: true,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
      remaining: 0,
    }
  }

  // Check if window expired (auto-reset)
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key)
    return { blocked: false, retryAfter: 0, remaining: LOGIN_MAX_ATTEMPTS }
  }

  return {
    blocked: false,
    retryAfter: 0,
    remaining: Math.max(0, LOGIN_MAX_ATTEMPTS - entry.attempts),
  }
}

export function recordFailedAttempt(ip: string, email: string): void {
  const key = `${ip}:${email}`
  const now = Date.now()
  let entry = loginAttempts.get(key)

  if (!entry) {
    entry = { attempts: 0, firstAttempt: now, lockedUntil: null }
    loginAttempts.set(key, entry)
  }

  // If window expired, reset
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    entry.attempts = 0
    entry.firstAttempt = now
    entry.lockedUntil = null
  }

  entry.attempts++

  // Lock if max attempts reached
  if (entry.attempts >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_LOCKOUT_MS
  }
}

export function clearLoginAttempts(ip: string, email: string): void {
  const key = `${ip}:${email}`
  loginAttempts.delete(key)
}

export function checkApiRateLimit(ip: string): {
  blocked: boolean
  retryAfter: number
  remaining: number
} {
  const now = Date.now()
  let entry = apiRequests.get(ip)

  if (!entry || now > entry.resetAt) {
    // Create new window
    apiRequests.set(ip, { count: 1, resetAt: now + API_WINDOW_MS })
    return { blocked: false, retryAfter: 0, remaining: API_MAX_REQUESTS - 1 }
  }

  if (entry.count >= API_MAX_REQUESTS) {
    return {
      blocked: true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      remaining: 0,
    }
  }

  entry.count++
  return {
    blocked: false,
    retryAfter: 0,
    remaining: API_MAX_REQUESTS - entry.count,
  }
}

// Default export as object for convenient import
export const rateLimit = {
  checkLoginRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  checkApiRateLimit,
}
