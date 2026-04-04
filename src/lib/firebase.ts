import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let app: App
let db: Firestore

export function initializeFirebase(): { app: App; db: Firestore } {
  if (!app) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    if (serviceAccount) {
      try {
        const serviceAccountObj = JSON.parse(serviceAccount)
        app = initializeApp({
          credential: cert(serviceAccountObj),
        })
      } catch {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT environment variable is set but contains invalid JSON. Please check your Firebase service account key.'
        )
      }
    } else {
      // For development, try to use default credentials or throw a helpful error
      if (getApps().length === 0) {
        app = initializeApp()
      } else {
        app = getApps()[0]
      }
    }
  }

  if (!db) {
    db = getFirestore(app)
  }

  return { app, db }
}

export function getDb(): Firestore {
  const { db: firestore } = initializeFirebase()
  return firestore
}

// Helper to generate a unique ID (similar to cuid)
export function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Helper to generate affiliate code
export function generateAffiliateCode(): string {
  const bytes = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

// Timestamp helpers
export function nowTimestamp() {
  return new Date().toISOString()
}

export function fromFirestoreTimestamp(date: unknown): string {
  if (!date) return new Date().toISOString()
  if (typeof date === 'string') return date
  if (date && typeof date === 'object' && 'toDate' in (date as object)) {
    return (date as { toDate: () => Date }).toDate().toISOString()
  }
  if (date instanceof Date) return date.toISOString()
  return new Date().toISOString()
}
