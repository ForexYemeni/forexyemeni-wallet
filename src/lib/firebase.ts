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
 * Get a temporary Firestore connection to the DEFAULT database.
 * Always creates a fresh connection using the embedded key, regardless of current state.
 */
export async function getDefaultDb(): Promise<Firestore> {
  const raw = Buffer.from(_fbk, 'base64').toString()
  const serviceAccount = JSON.parse(raw)
  const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
  const { getFirestore: getFs } = await import('firebase-admin/firestore')
  const tempApp = initApp({
    credential: firebaseCert(serviceAccount),
  }, `default-temp-${Date.now()}`)
  const defaultDb = getFs(tempApp)
  return defaultDb
}

/**
 * Check if a custom Firebase config is saved in the DEFAULT database and reinitialize with it.
 * Called once on first API request after server startup.
 */
export async function checkAndApplyCustomFirebase(): Promise<boolean> {
  if (checkedCustomFirebase) return false
  checkedCustomFirebase = true

  try {
    // Always use a temporary connection to the DEFAULT database to read config
    const defaultDb = await getDefaultDb()
    
    const customDoc = await defaultDb.collection('systemSettings').doc('customFirebase').get()
    if (!customDoc.exists) {
      // Clean up temp app
      try { await (defaultDb as any).app?.delete?.() } catch {}
      return false
    }

    const data = customDoc.data()
    if (!data?.encodedKey) {
      try { await (defaultDb as any).app?.delete?.() } catch {}
      return false
    }

    const serviceAccountKeyJson = Buffer.from(data.encodedKey, 'base64').toString()
    
    // Validate JSON
    const serviceAccount = JSON.parse(serviceAccountKeyJson)
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      try { await (defaultDb as any).app?.delete?.() } catch {}
      return false
    }

    // Clean up temp app
    try { await (defaultDb as any).app?.delete?.() } catch {}

    // Reinitialize with custom key
    reinitializeFirebase(serviceAccountKeyJson)
    console.log(`[Firebase] Auto-switched to custom project: ${serviceAccount.project_id}`)
    return true
  } catch (error) {
    console.error('[Firebase] Failed to check/apply custom config:', error)
    return false
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
    // Clean up temp app
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
