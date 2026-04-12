import { NextResponse } from 'next/server'

// Diagnostic endpoint — no auth required
export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: [],
  }

  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT || ''
  results.steps.push({ step: 'env', has: !!envKey, length: envKey.length })

  if (!envKey) {
    results.steps.push({ step: 'error', message: 'FIREBASE_SERVICE_ACCOUNT not set' })
    return NextResponse.json(results)
  }

  // Parse key
  try {
    const { _fbk } = await import('@/lib/firebase-key')
    results.steps.push({ step: 'parse', success: !!_fbk, keyLength: _fbk?.length })
    
    if (!_fbk) {
      results.steps.push({ step: 'error', message: 'Key parsing returned empty' })
      return NextResponse.json(results)
    }
  } catch (err: any) {
    results.steps.push({ step: 'error', message: err.message })
    return NextResponse.json(results)
  }

  // Initialize and test
  try {
    const { initializeFirebase, getCurrentProjectId, getDb } = await import('@/lib/firebase')
    const { app } = initializeFirebase()
    const projectId = getCurrentProjectId()
    results.steps.push({ step: 'init', projectId })

    // Test read with detailed error
    try {
      const db = getDb()
      const t0 = Date.now()
      const doc = await db.collection('counters').doc('accountNumber').get()
      const elapsed = Date.now() - t0
      results.steps.push({ step: 'read', ok: true, ms: elapsed, exists: doc.exists })
      
      // Count users
      const usersSnap = await db.collection('users').limit(5).get()
      const users = usersSnap.docs.map(d => ({ id: d.id, email: d.data().email, role: d.data().role }))
      results.steps.push({ step: 'users', count: usersSnap.size, users })
    } catch (readErr: any) {
      results.steps.push({ 
        step: 'read-error', 
        message: readErr.message,
        stack: readErr.stack?.substring(0, 500)
      })
    }
  } catch (err: any) {
    results.steps.push({ step: 'error', message: err.message })
  }

  return NextResponse.json(results)
}
