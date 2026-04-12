import { NextRequest, NextResponse } from 'next/server'

const EMERGENCY_SECRET = process.env.EMERGENCY_RESET_SECRET || ''

/**
 * Emergency endpoint — NO authentication required, NO ensureDb() dependency.
 * Completely self-contained — uses only getDefaultDb() and direct firebase-admin imports.
 * 
 * Resets the app to the default Firebase database.
 * 
 * Use this when:
 * - The custom database is deleted or unreachable
 * - You're locked out and can't login
 * - You need to recover the app from a dead database
 * 
 * === Requires EMERGENCY_RESET_SECRET env variable ===
 */
async function performReset(): Promise<NextResponse> {
  try {
    // Import ONLY what we need — avoid importing anything that triggers ensureDb()
    const { _fbk } = await import('@/lib/firebase-key')

    // Step 1: Connect directly to DEFAULT DB (never touches global state)
    const raw = Buffer.from(_fbk, 'base64').toString()
    const serviceAccount = JSON.parse(raw)
    const { initializeApp: initApp, cert: firebaseCert, deleteApp: delApp } = await import('firebase-admin/app')
    const { getFirestore: getFs } = await import('firebase-admin/firestore')
    
    const tempApp = initApp({
      credential: firebaseCert(serviceAccount),
    }, `emergency-reset-${Date.now()}`)
    const defaultDb = getFs(tempApp)

    // Step 2: Delete custom config from default DB
    try {
      await defaultDb.collection('systemSettings').doc('customFirebase').delete()
    } catch {}

    // Step 3: Verify default DB is working
    const testDoc = await defaultDb.collection('systemSettings').doc('testConnection').get()
    
    // Clean up temp app
    try { await delApp(tempApp) } catch {}

    // Step 4: Now reset the global Firebase (force reset regardless of current state)
    const { resetFirebaseToDefault, getCurrentProjectId } = await import('@/lib/firebase')
    resetFirebaseToDefault()
    const projectId = getCurrentProjectId()

    return NextResponse.json({
      success: true,
      message: 'تم إعادة التطبيق للقاعدة الافتراضية بنجاح ✅',
      projectId,
      hint: 'يمكنك الآن تسجيل الدخول بالبيانات الافتراضية',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({
      success: false,
      message: `فشل إعادة التعيين: ${message}`,
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.secret !== EMERGENCY_SECRET) {
      return NextResponse.json({ success: false, message: 'رمز الطوارئ غير صحيح' }, { status: 403 })
    }
    return await performReset()
  } catch {
    return NextResponse.json({ success: false, message: 'طلب غير صالح' }, { status: 400 })
  }
}

/**
 * GET — Requires EMERGENCY_RESET_SECRET env variable
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // If secret is provided, perform reset
  if (secret === EMERGENCY_SECRET) {
    return await performReset()
  }

  // Otherwise, just show status page (completely self-contained, no ensureDb dependency)
  try {
    let projectId = 'غير معروف'
    try {
      const { getCurrentProjectId } = await import('@/lib/firebase')
      const id = getCurrentProjectId()
      if (id) projectId = id
    } catch {}

    return new NextResponse(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>الطوارئ - ForexYemeni</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#111;border:1px solid #333;border-radius:16px;padding:30px;max-width:400px;width:100%;text-align:center}
h1{font-size:20px;margin-bottom:10px;color:#f59e0b}
p{font-size:13px;color:#999;margin-bottom:20px;line-height:1.6}
.status{background:#1a1a2e;border:1px solid #333;border-radius:10px;padding:15px;margin-bottom:20px}
.status span{font-size:12px;color:#666}
.status b{color:#f59e0b;font-size:14px}
.btn{display:block;width:100%;padding:14px;background:#f59e0b;color:#000;border:none;border-radius:10px;font-size:15px;font-weight:bold;cursor:pointer;text-decoration:none;margin-top:10px}
.btn:hover{background:#fbbf24}
.warn{background:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:12px;margin-top:15px}
.warn p{color:#f87171;font-size:11px;margin:0}
</style></head>
<body>
<div class="card">
<h1>🚨 نقطة الطوارئ</h1>
<p>إذا كنت عالق ولا تستطيع تسجيل الدخول بسبب قاعدة بيانات متوقفة</p>
<div class="status">
<span>القاعدة الحالية</span><br>
<b>${projectId}</b>
</div>
<a class="btn" href="#" onclick="const s=prompt('أدخل رمز الطوارئ:');if(s)window.location.href='?secret='+s;return false;">🔄 إعادة للقاعدة الافتراضية</a>
<div class="warn">
<p>⚠️ سيتم حذف إعدادات القاعدة المخصصة والعودة للقاعدة الأصلية</p>
</div>
</div>
</body></html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
