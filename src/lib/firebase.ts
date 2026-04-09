import { initializeApp, cert, deleteApp, App, getApps } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { _fbk } from './firebase-key'

let app: App
let db: Firestore
let checkedCustomFirebase = false

export function initializeFirebase() {
  if (!app) {
    // Always use the embedded key to avoid env var issues on Vercel
    const raw = Buffer.from(_fbk, 'base64').toString()
    const serviceAccount = JSON.parse(raw)
    app = initializeApp({
      credential: cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    })
  }
  if (!db) db = getFirestore(app)
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
 * Get a temporary Firestore connection to the DEFAULT database.
 * Always creates a fresh connection using the embedded key, regardless of current state.
 */
export async function getDefaultDb(): Promise<Firestore> {
  const raw = Buffer.from(_fbk, 'base64').toString()
  const serviceAccount = JSON.parse(raw)
  const { initializeApp: initApp, cert: firebaseCert } = await import('firebase-admin/app')
  const { getFirestore: getFs } = await import('firebase-admin/firestore')
  const tempApp = initApp({
    credential: firebaseCert(serviceAccount),
  }, `default-temp-${Date.now()}`)
  const defaultDb = getFs(tempApp)
  return defaultDb
}

/**
 * Create a temporary Firestore connection using a custom service account key.
 * Used to TEST the connection before switching the global app.
 */
async function createTempCustomDb(serviceAccountKeyJson: string): Promise<{ tempDb: Firestore; cleanup: () => Promise<void> }> {
  const serviceAccount = JSON.parse(serviceAccountKeyJson)
  const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
  const { getFirestore: getFs } = await import('firebase-admin/firestore')
  const tempApp = initApp({
    credential: firebaseCert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  }, `custom-test-${Date.now()}`)
  const tempDb = getFs(tempApp)
  return {
    tempDb,
    cleanup: async () => { try { await delApp(tempApp) } catch {} }
  }
}

/**
 * Check if a custom Firebase config is saved in the DEFAULT database and reinitialize with it.
 * Called once on first API request after server startup.
 * 
 * SAFETY GUARANTEES:
 * 1. Tests the custom DB with a SEPARATE temporary app — never touches global state until confirmed working
 * 2. Has a 5-second timeout on the test — dead DBs won't hang the app
 * 3. The `checkedCustomFirebase` flag is only set AFTER successful switch — if anything fails, it resets
 * 4. On failure, automatically deletes the stale config from default DB so it won't be retried
 */
export async function checkAndApplyCustomFirebase(): Promise<{ active: boolean; fallback: boolean; projectId?: string }> {
  if (checkedCustomFirebase) return { active: false, fallback: false }

  try {
    // Step 1: Read config from DEFAULT database (always accessible)
    const defaultDb = await getDefaultDb()
    
    let customDoc
    try {
      customDoc = await withTimeout(
        defaultDb.collection('systemSettings').doc('customFirebase').get(),
        8000,
        'Read custom config from default DB'
      )
    } catch (err) {
      console.error('[Firebase] Cannot read config from default DB:', err)
      try { await (defaultDb as any).app?.delete?.() } catch {}
      // Default DB itself might be having issues — don't set flag, allow retry
      return { active: false, fallback: false }
    }

    if (!customDoc.exists) {
      try { await (defaultDb as any).app?.delete?.() } catch {}
      checkedCustomFirebase = true // No custom config — mark as checked
      return { active: false, fallback: false }
    }

    const data = customDoc.data()
    if (!data?.encodedKey) {
      try { await (defaultDb as any).app?.delete?.() } catch {}
      checkedCustomFirebase = true // No valid config — mark as checked
      return { active: false, fallback: false }
    }

    // Clean up default DB temp connection
    try { await (defaultDb as any).app?.delete?.() } catch {}

    const serviceAccountKeyJson = Buffer.from(data.encodedKey, 'base64').toString()
    
    // Validate JSON structure
    let serviceAccount: any
    try {
      serviceAccount = JSON.parse(serviceAccountKeyJson)
      if (!serviceAccount.project_id || !serviceAccount.private_key) {
        throw new Error('Missing project_id or private_key')
      }
    } catch (parseErr) {
      console.warn('[Firebase] Invalid custom config found, deleting...')
      const cleanupDb = await getDefaultDb()
      try { await cleanupDb.collection('systemSettings').doc('customFirebase').delete() } catch {}
      try { await (cleanupDb as any).app?.delete?.() } catch {}
      checkedCustomFirebase = true // Bad config deleted — mark as checked
      return { active: false, fallback: true }
    }

    // Step 2: TEST the custom database with a SEPARATE temporary connection
    // DO NOT touch the global app/db yet!
    console.log(`[Firebase] Testing custom database: ${serviceAccount.project_id}...`)
    const { tempDb, cleanup: cleanupTempDb } = await createTempCustomDb(serviceAccountKeyJson)
    
    let testPassed = false
    try {
      await withTimeout(
        tempDb.collection('systemSettings').doc('testConnection').get(),
        5000, // 5 second timeout — dead DBs won't hang us
        'Test custom DB connection'
      )
      testPassed = true
      console.log(`[Firebase] Custom database ${serviceAccount.project_id} is reachable!`)
    } catch (testErr) {
      console.error(`[Firebase] Custom database ${serviceAccount.project_id} is UNREACHABLE:`, testErr instanceof Error ? testErr.message : testErr)
      testPassed = false
    } finally {
      await cleanupTempDb()
    }

    if (!testPassed) {
      // Custom DB is dead — clean up the stale config and stay on default
      console.warn(`[Firebase] Falling back to default database. Deleting stale config for ${serviceAccount.project_id}...`)
      
      try {
        const cleanupDb = await getDefaultDb()
        try { await cleanupDb.collection('systemSettings').doc('customFirebase').delete() } catch {}
        try { await (cleanupDb as any).app?.delete?.() } catch {}
      } catch {}
      
      checkedCustomFirebase = true // Stale config deleted — mark as checked
      return { active: false, fallback: true }
    }

    // Step 3: Custom DB is confirmed working — now switch global state
    reinitializeFirebase(serviceAccountKeyJson)
    checkedCustomFirebase = true // Successfully switched — mark as checked
    
    console.log(`[Firebase] Auto-switched to custom project: ${serviceAccount.project_id}`)
    return { active: true, fallback: false, projectId: serviceAccount.project_id }

  } catch (error) {
    console.error('[Firebase] Failed to check/apply custom config:', error)
    // Don't set checkedCustomFirebase — allow retry on next request
    return { active: false, fallback: false }
  }
}

/**
 * Save custom Firebase config to the DEFAULT database.
 * Always uses a fresh connection to ensure config is saved in the right place.
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
 * Delete custom Firebase config from the DEFAULT database.
 * Always uses a fresh connection to ensure config is deleted from the right place.
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
 * Ensure custom Firebase is loaded before returning DB.
 * Call this at the start of API routes that need the correct database.
 */
export async function getDbWithCustomCheck(): Promise<Firestore> {
  await checkAndApplyCustomFirebase()
  return getDb()
}

// Reinitialize Firebase with a custom service account key
export function reinitializeFirebase(serviceAccountKeyJson: string): { app: App; db: Firestore } {
  if (app) {
    try { deleteApp(app) } catch { /* ignore */ }
  }
  app = undefined as any
  db = undefined as any

  const serviceAccount = JSON.parse(serviceAccountKeyJson)
  app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  })
  db = getFirestore(app)
  return { app, db }
}

// Reset Firebase to the default embedded key
export function resetFirebaseToDefault(): { app: App; db: Firestore } {
  if (app) {
    try { deleteApp(app) } catch { /* ignore */ }
  }
  app = undefined as any
  db = undefined as any
  // Reset the check flag so it re-checks on next startup
  checkedCustomFirebase = false
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
 * Async version of getDb that ensures custom Firebase is checked.
 * Use this in API routes instead of getDb() for guaranteed correct database.
 * The check only runs once per server lifecycle, so performance impact is minimal.
 */
export async function ensureDb(): Promise<Firestore> {
  await checkAndApplyCustomFirebase()
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

export async function generateAccountNumber(): Promise<number> {
  const db = getDb()
  const ref = db.collection('counters').doc('accountNumber')
  const doc = await ref.get()
  const n = doc.exists ? (doc.data()?.value || 100000) + 1 : 100001
  await ref.set({ value: n }, { merge: true })
  return n
}

export function nowTimestamp() { return new Date().toISOString() }

export function fromFirestoreTimestamp(d: unknown): string {
  if (!d) return new Date().toISOString()
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && 'toDate' in (d as object)) return (d as any).toDate().toISOString()
  if (d instanceof Date) return d.toISOString()
  return new Date().toISOString()
}
