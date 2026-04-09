import { NextRequest, NextResponse } from 'next/server'
import { deleteCustomConfigFromDefaultDb, resetFirebaseToDefault, getDefaultDb } from '@/lib/firebase'

/**
 * Emergency endpoint — NO authentication required.
 * Resets the app to the default Firebase database.
 * 
 * Use this when:
 * - The custom database is deleted or unreachable
 * - You're locked out and can't login
 * - You need to recover the app from a dead database
 * 
 * Access via: POST /api/emergency/reset-db
 * Body: { "secret": "forexyemeni-emergency-reset" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret } = body

    // Simple secret to prevent accidental calls
    if (secret !== 'forexyemeni-emergency-reset') {
      return NextResponse.json({
        success: false,
        message: 'رمز الطوارئ غير صحيح',
      }, { status: 403 })
    }

    // Step 1: Delete custom config from default DB
    await deleteCustomConfigFromDefaultDb()

    // Step 2: Reset Firebase to default
    resetFirebaseToDefault()

    // Step 3: Verify default DB is working
    const defaultDb = await getDefaultDb()
    await defaultDb.collection('systemSettings').doc('testConnection').get()
    try { await (defaultDb as any).app?.delete?.() } catch {}

    const { getCurrentProjectId } = await import('@/lib/firebase')
    const projectId = getCurrentProjectId()

    return NextResponse.json({
      success: true,
      message: 'تم إعادة التطبيق للقاعدة الافتراضية بنجاح',
      projectId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({
      success: false,
      message: `فشل إعادة التعيين: ${message}`,
    }, { status: 500 })
  }
}

/**
 * GET — Check current status without auth (for debugging)
 */
export async function GET() {
  try {
    const { getCurrentProjectId } = await import('@/lib/firebase')
    const projectId = getCurrentProjectId()

    return NextResponse.json({
      success: true,
      projectId,
      hint: 'POST with { "secret": "forexyemeni-emergency-reset" } to reset',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ'
    return NextResponse.json({
      success: false,
      message,
    }, { status: 500 })
  }
}
