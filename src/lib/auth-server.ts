// ===================== SERVER-SIDE AUTHENTICATION =====================
// Centralized auth verification for all API routes
// Tokens are UUIDs stored in Firestore 'otpCodes' collection (type: 'login')

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from './firebase'

interface AuthUser {
  id: string
  email: string
  role: string
  status: string
  balance: number
  frozenBalance: number
  fullName: string | null
  phone: string | null
  country: string | null
  twoFactorEnabled: boolean
  mustChangePassword: boolean
  hasPin: boolean
  emailVerified: boolean
  merchantId: string | null
}

interface AuthResult {
  success: true
  user: AuthUser
  token: string
}

interface AuthError {
  success: false
  error: string
  status: number
}

type AuthCheckResult = AuthResult | AuthError

// Cache verified tokens for 60 seconds to reduce DB reads
const tokenCache = new Map<string, { user: AuthUser; expiresAt: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

function cleanCache() {
  const now = Date.now()
  for (const [key, val] of tokenCache.entries()) {
    if (now > val.expiresAt) tokenCache.delete(key)
  }
}

/**
 * Extract auth token from request.
 * Checks: Authorization header > x-auth-token header > body.token > body.userId (legacy)
 */
function extractToken(request: NextRequest, body?: Record<string, unknown>): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim()
    if (token) return token
  }

  // 2. x-auth-token header
  const authToken = request.headers.get('x-auth-token')
  if (authToken?.trim()) return authToken.trim()

  // 3. x-user-id header (used by some P2P routes — we'll verify against otpCodes)
  // Note: x-user-id is NOT a token, we handle it separately

  // 4. Body token field
  if (body?.token && typeof body.token === 'string' && body.token.trim()) {
    return body.token.trim()
  }

  return null
}

/**
 * Verify a login token against Firestore.
 * Returns the user data if valid, null if invalid/expired.
 */
async function verifyTokenInDb(token: string): Promise<AuthUser | null> {
  try {
    const db = getDb()
    
    // Find the token in otpCodes
    // NOTE: We do NOT filter by 'verified' because login tokens are created
    // with verified:false by otpCodeOperations.create — they are valid as-is.
    // We check both 'login' (normal login) and 'login_2fa_pending' (after 2FA verification
    // the pending session becomes the login token but keeps its original type).
    const [loginSnap, twoFaSnap] = await Promise.all([
      db.collection('otpCodes').where('code', '==', token).where('type', '==', 'login').limit(1).get(),
      db.collection('otpCodes').where('code', '==', token).where('type', '==', 'login_2fa_pending').where('verified', '==', true).limit(1).get(),
    ])

    const tokenSnap = loginSnap.empty ? twoFaSnap : loginSnap
    if (tokenSnap.empty) return null

    const tokenDoc = tokenSnap.docs[0]
    const tokenData = tokenDoc.data()

    // Check expiry
    if (tokenData.expiresAt) {
      const expiresAt = typeof tokenData.expiresAt === 'string'
        ? new Date(tokenData.expiresAt)
        : tokenData.expiresAt?.toDate?.() || null
      
      if (expiresAt && expiresAt < new Date()) return null
    }

    // Get the user
    const userId = tokenData.userId
    if (!userId) return null

    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) return null

    const userData = userDoc.data()

    return {
      id: userId,
      email: userData.email || '',
      role: userData.role || 'user',
      status: userData.status || 'active',
      balance: userData.balance || 0,
      frozenBalance: userData.frozenBalance || 0,
      fullName: userData.fullName || null,
      phone: userData.phone || null,
      country: userData.country || null,
      twoFactorEnabled: userData.twoFactorEnabled || false,
      mustChangePassword: userData.mustChangePassword || false,
      hasPin: !!userData.pinHash,
      emailVerified: userData.emailVerified || false,
      merchantId: userData.merchantId || null,
    }
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Authenticate a request — verifies token and returns user.
 * Use this in API routes that require authentication.
 * 
 * Usage:
 *   const auth = await authenticateRequest(request)
 *   if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
 *   // auth.user.id, auth.user.role, etc.
 */
export async function authenticateRequest(request: NextRequest, body?: Record<string, unknown>): Promise<AuthCheckResult> {
  const token = extractToken(request, body)

  if (!token) {
    return { success: false, error: 'غير مصرح — لم يتم العثور على رمز المصادقة', status: 401 }
  }

  // Check cache first
  cleanCache()
  const cached = tokenCache.get(token)
  if (cached && Date.now() < cached.expiresAt) {
    return { success: true, user: cached.user, token }
  }

  // Verify in database
  const user = await verifyTokenInDb(token)
  if (!user) {
    return { success: false, error: 'رمز المصادقة غير صالح أو منتهي الصلاحية', status: 401 }
  }

  // Check if user is active
  if (user.status === 'suspended' || user.status === 'banned') {
    return { success: false, error: 'هذا الحساب موقوف. تواصل مع الإدارة.', status: 403 }
  }

  // Cache the result
  tokenCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL })

  return { success: true, user, token }
}

/**
 * Authenticate and require admin role.
 * Use this in admin-only API routes.
 * 
 * Usage:
 *   const auth = await requireAdmin(request)
 *   if (!auth.success) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
 *   // auth.user is guaranteed to be admin
 */
export async function requireAdmin(request: NextRequest, body?: Record<string, unknown>): Promise<AuthCheckResult> {
  const auth = await authenticateRequest(request, body)

  if (!auth.success) return auth

  if (auth.user.role !== 'admin') {
    return { success: false, error: 'غير مصرح — صلاحيات المدير مطلوبة', status: 403 }
  }

  return auth
}

/**
 * Verify that a given userId matches the authenticated user.
 * Prevents users from accessing other users' data by spoofing IDs.
 */
export function verifyUserId(auth: AuthResult, requestedUserId: string): boolean {
  return auth.user.id === requestedUserId
}

/**
 * Get user ID from request body or header — with auth verification.
 * Returns the verified user ID, or null if auth fails.
 */
export async function getVerifiedUserId(request: NextRequest, body?: Record<string, unknown>): Promise<string | null> {
  const auth = await authenticateRequest(request, body)
  if (!auth.success) return null
  return auth.user.id
}

/**
 * Invalidate a token (e.g., on logout or password change).
 */
export async function invalidateToken(token: string): Promise<void> {
  try {
    const db = getDb()
    const snap = await db.collection('otpCodes')
      .where('code', '==', token)
      .where('type', '==', 'login')
      .limit(1)
      .get()

    if (!snap.empty) {
      await snap.docs[0].ref.delete()
    }

    // Remove from cache
    tokenCache.delete(token)
  } catch (error) {
    console.error('[AUTH] Token invalidation failed:', error)
  }
}
