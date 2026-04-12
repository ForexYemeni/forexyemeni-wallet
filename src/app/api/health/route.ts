import { NextResponse } from 'next/server'

// Diagnostic endpoint — no auth required, returns detailed connection info
export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {},
    firebase: {},
    steps: [],
  }

  // Step 1: Check env var
  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT || ''
  results.env.hasEnvVar = !!envKey
  results.env.envVarLength = envKey.length
  results.env.envVarPrefix = envKey.substring(0, 30) + '...'

  if (!envKey) {
    results.steps.push({ step: 1, status: 'FAIL', message: 'FIREBASE_SERVICE_ACCOUNT is NOT set' })
    return NextResponse.json(results)
  }

  results.steps.push({ step: 1, status: 'OK', message: 'FIREBASE_SERVICE_ACCOUNT is set' })

  // Step 2: Parse key
  try {
    const { _fbk } = await import('@/lib/firebase-key')
    const hasKey = !!_fbk
    results.firebase.parsedKey = hasKey
    results.steps.push({ step: 2, status: hasKey ? 'OK' : 'FAIL', message: hasKey ? 'Key parsed successfully' : 'Key parsing FAILED (empty result)' })
    
    if (!hasKey) {
      return NextResponse.json(results)
    }
  } catch (err: any) {
    results.steps.push({ step: 2, status: 'FAIL', message: `Key parsing error: ${err.message}` })
    return NextResponse.json(results)
  }

  // Step 3: Initialize Firebase
  try {
    const { initializeFirebase, getCurrentProjectId } = await import('@/lib/firebase')
    const { app } = initializeFirebase()
    const projectId = getCurrentProjectId()
    results.firebase.projectId = projectId
    results.steps.push({ step: 3, status: 'OK', message: `Firebase initialized, project: ${projectId}` })
  } catch (err: any) {
    results.steps.push({ step: 3, status: 'FAIL', message: `Firebase init error: ${err.message}` })
    return NextResponse.json(results)
  }

  // Step 4: Test Firestore read
  try {
    const { getDb } = await import('@/lib/firebase')
    const db = getDb()
    const start = Date.now()
    await db.collection('counters').doc('accountNumber').get()
    const elapsed = Date.now() - start
    results.firestore.readTime = elapsed
    results.steps.push({ step: 4, status: 'OK', message: `Firestore read OK (${elapsed}ms)` })
  } catch (err: any) {
    results.steps.push({ step: 4, status: 'FAIL', message: `Firestore read error: ${err.message}` })
    return NextResponse.json(results)
  }

  // Step 5: Count users
  try {
    const { getDb } = await import('@/lib/firebase')
    const db = getDb()
    const usersSnap = await db.collection('users').limit(5).get()
    const users = usersSnap.docs.map(d => ({ id: d.id, email: d.data().email, role: d.data().role }))
    results.firestore.userCount = usersSnap.size
    results.firestore.sampleUsers = users
    results.steps.push({ step: 5, status: 'OK', message: `Found ${usersSnap.size} users (first 5 shown)` })
  } catch (err: any) {
    results.steps.push({ step: 5, status: 'FAIL', message: `Users query error: ${err.message}` })
  }

  // Step 6: Check for login tokens
  try {
    const { getDb } = await import('@/lib/firebase')
    const db = getDb()
    const tokensSnap = await db.collection('otpCodes').where('type', '==', 'login').limit(3).get()
    results.firestore.loginTokens = tokensSnap.size
    results.steps.push({ step: 6, status: 'OK', message: `Found ${tokensSnap.size} login tokens` })
  } catch (err: any) {
    results.steps.push({ step: 6, status: 'FAIL', message: `Tokens query error: ${err.message}` })
  }

  return NextResponse.json(results)
}
