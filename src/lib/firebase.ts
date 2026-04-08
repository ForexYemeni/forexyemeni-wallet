import { initializeApp, cert, App, getApps } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { _fbk } from './firebase-key'

let app: App
let db: Firestore

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
