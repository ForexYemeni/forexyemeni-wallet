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
 * Check if a custom Firebase config is saved and reinitialize with it.
 * Called once on first API request after server startup.
 */
export async function checkAndApplyCustomFirebase(): Promise<boolean> {
  if (checkedCustomFirebase) return false
  checkedCustomFirebase = true

  try {
    // First init with default key to read the config
    const { db: defaultDb } = initializeFirebase()
    
    const customDoc = await defaultDb.collection('systemSettings').doc('customFirebase').get()
    if (!customDoc.exists) return false

    const data = customDoc.data()
    if (!data?.encodedKey) return false

    const serviceAccountKeyJson = Buffer.from(data.encodedKey, 'base64').toString()
    
    // Validate JSON
    const serviceAccount = JSON.parse(serviceAccountKeyJson)
    if (!serviceAccount.project_id || !serviceAccount.private_key) return false

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
