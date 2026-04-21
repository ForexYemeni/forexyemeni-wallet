import { initializeApp, cert, deleteApp, App, getApps } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { _fbk } from './firebase-key'

let app: App
let db: Firestore

/** Parse the service account key — supports both raw JSON and base64 */
function parseServiceAccount(key: string) {
  // Try raw JSON first (most common in Vercel env vars)
  const trimmed = key.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.type === 'service_account' && parsed.private_key) return parsed
    } catch {}
  }
  // Try base64
  try {
    const raw = Buffer.from(key, 'base64').toString()
    const parsed = JSON.parse(raw)
    if (parsed.type === 'service_account' && parsed.private_key) return parsed
  } catch {}
  throw new Error('Invalid Firebase service account key format')
}

export function initializeFirebase() {
  if (!app) {
    if (!_fbk) throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not configured')
    const serviceAccount = parseServiceAccount(_fbk)
    
    // Ensure project ID is available as env var (required by some Firebase internals)
    process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id
    
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
  }
  if (!db) {
    db = getFirestore(app)
  }
  return { app, db }
}

/**
 * Timeout wrapper — rejects after `ms` milliseconds if the promise doesn't resolve.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

/**
 * Get a temporary Firestore connection using the service account key.
 * Used by admin panel to test/save custom configs.
 */
export async function getDefaultDb(): Promise<Firestore> {
  if (!_fbk) throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not configured')
  const serviceAccount = parseServiceAccount(_fbk)
  const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
  const { getFirestore: getFs } = await import('firebase-admin/firestore')
  const tempApp = initApp({
    credential: firebaseCert(serviceAccount),
    projectId: serviceAccount.project_id,
  }, `temp-${Date.now()}`)
  const tempDb = getFs(tempApp)
  return tempDb
}

/**
 * Create a temporary Firestore connection using a custom service account key.
 * Used by admin panel to test a custom Firebase connection before switching.
 */
export async function createTempCustomDb(serviceAccountKeyJson: string): Promise<{ tempDb: Firestore; cleanup: () => Promise<void> }> {
  const serviceAccount = JSON.parse(serviceAccountKeyJson)
  const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
  const { getFirestore: getFs } = await import('firebase-admin/firestore')
  const tempApp = initApp({
    credential: firebaseCert(serviceAccount),
    projectId: serviceAccount.project_id,
  }, `custom-test-${Date.now()}`)
  const tempDb = getFs(tempApp)
  return {
    tempDb,
    cleanup: async () => { try { await delApp(tempApp) } catch {} }
  }
}

/**
 * DISABLED: Automatic custom Firebase switching is not compatible with Vercel serverless.
 * Different server instances can't share global state, causing tokens created in one
 * database to be unreadable from another instance.
 *
 * Database selection is now handled EXCLUSIVELY via the FIREBASE_SERVICE_ACCOUNT env var.
 * The admin panel's explicit "Save" action still works for manual switching.
 */
export async function checkAndApplyCustomFirebase(): Promise<{ active: boolean; fallback: boolean; projectId?: string }> {
  // No-op: database is configured via FIREBASE_SERVICE_ACCOUNT env var only.
  // This prevents inconsistent DB state across serverless instances.
  return { active: false, fallback: false }
}

/**
 * Save custom Firebase config to the database.
 * Used by admin panel when explicitly saving a custom config.
 */
export async function saveCustomConfigToDefaultDb(encodedKey: string, projectId: string): Promise<void> {
  const defaultDb = await getDefaultDb()
  try {
    await defaultDb.collection('systemSettings').doc('customFirebase').set({
      encodedKey,
      projectId,
      updatedAt: nowTimestamp(),
    }, { merge: true })
  } finally {
    try { await (defaultDb as any).app?.delete?.() } catch {}
  }
}

/**
 * Delete custom Firebase config from the database.
 * Used by admin panel when reverting to default config.
 */
export async function deleteCustomConfigFromDefaultDb(): Promise<void> {
  const defaultDb = await getDefaultDb()
  try {
    await defaultDb.collection('systemSettings').doc('customFirebase').delete()
  } finally {
    try { await (defaultDb as any).app?.delete?.() } catch {}
  }
}

/**
 * Ensure DB is ready. Since we disabled automatic switching,
 * this simply returns the DB initialized from the env var.
 */
export async function getDbWithCustomCheck(): Promise<Firestore> {
  return getDb()
}

// Reinitialize Firebase with a custom service account key.
// Used by admin panel when explicitly switching databases.
export function reinitializeFirebase(serviceAccountKeyJson: string): { app: App; db: Firestore } {
  if (app) {
    try { deleteApp(app) } catch { /* ignore */ }
  }
  app = undefined as any
  db = undefined as any

  const serviceAccount = parseServiceAccount(serviceAccountKeyJson)
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  })
  db = getFirestore(app)
  return { app, db }
}

// Reset Firebase to the env var configuration.
export function resetFirebaseToDefault(): { app: App; db: Firestore } {
  if (app) {
    try { deleteApp(app) } catch { /* ignore */ }
  }
  app = undefined as any
  db = undefined as any
  return initializeFirebase()
}

// Get the current project ID
export function getCurrentProjectId(): string | null {
  if (!app) return null
  try {
    return app.options.projectId || null
  } catch { return null }
}

export function getDb(): Firestore {
  return initializeFirebase().db
}

/**
 * Async version of getDb. Returns the same DB as getDb() since
 * automatic custom switching is disabled.
 */
export async function ensureDb(): Promise<Firestore> {
  return getDb()
}

export function generateId(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let r = ''
  for (let i = 0; i < 25; i++) r += c[Math.floor(Math.random() * c.length)]
  return r
}

export function generateAffiliateCode(): string {
  const b = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < 4; i++) b[i] = Math.floor(Math.random() * 256)
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * Generate a new account number, reusing deleted numbers when possible.
 * Scans the users collection directly for gaps (works even for accounts
 * deleted before the freedNumbers tracking existed).
 */
export async function generateAccountNumber(): Promise<number> {
  const db = getDb()
  const ref = db.collection('counters').doc('accountNumber')

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref)
    const data = doc.data() || {}
    const maxValue = data.value || 1000

    // Get all used account numbers in one query
    const usersSnap = await db.collection('users')
      .where('accountNumber', '>=', 1001)
      .where('accountNumber', '<=', maxValue)
      .select('accountNumber')
      .get()

    // Build a set of used numbers
    const usedNumbers = new Set<number>()
    for (const uDoc of usersSnap.docs) {
      const num = Number(uDoc.data().accountNumber)
      if (num >= 1001) usedNumbers.add(num)
    }

    // Find the first gap
    for (let n = 1001; n <= maxValue; n++) {
      if (!usedNumbers.has(n)) {
        // Found a gap — reuse this number
        // Clean up freedNumbers since we scan directly now
        transaction.set(ref, { value: maxValue, freedNumbers: [] })
        return n
      }
    }

    // No gaps found, increment counter
    const newNumber = maxValue + 1
    transaction.set(ref, { value: newNumber, freedNumbers: [] })
    return newNumber
  })
}

/**
 * Free an account number so it can be reused by the next new user.
 * Kept for compatibility — the actual gap detection happens in generateAccountNumber.
 */
export async function freeAccountNumber(_accountNumber: number): Promise<void> {
  // No-op: generateAccountNumber now scans users directly for gaps.
  // This function is kept so existing delete-user code doesn't break.
}

export function nowTimestamp() { return new Date().toISOString() }

export function fromFirestoreTimestamp(d: unknown): string {
  if (!d) return new Date().toISOString()
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && 'toDate' in (d as object)) return (d as any).toDate().toISOString()
  if (d instanceof Date) return d.toISOString()
  return new Date().toISOString()
}
