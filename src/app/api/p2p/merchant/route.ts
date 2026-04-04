import { NextRequest, NextResponse } from 'next/server'
import { userOperations, merchantApplicationOperations, merchantOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'
import { getDb } from '@/lib/firebase'

// GET: get merchant application status for user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    // Check new merchant application system
    const applications = await merchantApplicationOperations.findByUser(userId)
    const approvedApp = applications.find(a => a.status === 'approved')

    if (approvedApp) {
      // Also ensure user document has merchantId set
      const user = await userOperations.findUnique({ id: userId })
      if (user && !user.merchantId) {
        await userOperations.update({ id: userId }, { merchantId: approvedApp.id })
      }
      return NextResponse.json({
        success: true,
        hasApplication: true,
        application: {
          id: approvedApp.id,
          status: approvedApp.status,
          rejectionReason: approvedApp.rejectionReason || null,
          appliedAt: approvedApp.appliedAt,
          reviewedAt: approvedApp.reviewedAt || null,
        },
      })
    }

    // Return latest non-approved application if exists (pending/rejected)
    if (applications.length > 0) {
      const latest = applications[0]
      return NextResponse.json({
        success: true,
        hasApplication: true,
        application: {
          id: latest.id,
          status: latest.status,
          rejectionReason: latest.rejectionReason || null,
          appliedAt: latest.appliedAt,
          reviewedAt: latest.reviewedAt || null,
        },
      })
    }

    // Check old merchant system
    const oldMerchant = await merchantOperations.findApprovedByUser(userId)
    if (oldMerchant) {
      // Ensure user document has merchantId set
      const user = await userOperations.findUnique({ id: userId })
      if (user && !user.merchantId) {
        await userOperations.update({ id: userId }, { merchantId: oldMerchant.id })
      }
      return NextResponse.json({
        success: true,
        hasApplication: true,
        application: {
          id: oldMerchant.id,
          status: 'approved',
          rejectionReason: null,
          appliedAt: oldMerchant.submittedAt || null,
          reviewedAt: oldMerchant.reviewedAt || null,
        },
      })
    }

    // Check if user has merchantId set directly on their document
    const user = await userOperations.findUnique({ id: userId })
    if (user?.merchantId) {
      return NextResponse.json({
        success: true,
        hasApplication: true,
        application: {
          id: user.merchantId,
          status: 'approved',
          rejectionReason: null,
          appliedAt: null,
          reviewedAt: null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      hasApplication: false,
      application: null,
    })
  } catch (error: any) {
    console.error('[Merchant GET]', error)
    return NextResponse.json({ success: false, message: 'خطأ في جلب حالة طلب التاجر' }, { status: 500 })
  }
}

// POST: submit merchant verification application
export async function POST(req: NextRequest) {
  try {
    const { action, userId, idPhoto, selfiePhoto, addressProof } = await req.json()

    if (!action || !userId) {
      return NextResponse.json({ success: false, message: 'الإجراء ومعرف المستخدم مطلوبان' }, { status: 400 })
    }

    if (action === 'apply') {
      // Validate required photos
      if (!idPhoto || !selfiePhoto || !addressProof) {
        return NextResponse.json(
          { success: false, message: 'صورة الهوية والصورة الشخصية وإثبات العنوان مطلوبون' },
          { status: 400 }
        )
      }

      // Find user
      const user = await userOperations.findUnique({ id: userId })
      if (!user) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
      }

      // Check if already has pending or approved application
      const existing = await merchantApplicationOperations.findByUser(userId)
      const hasPending = existing.find((a) => a.status === 'pending')
      if (hasPending) {
        return NextResponse.json({ success: false, message: 'لديك طلب معلق بالفعل، يرجى الانتظار حتى يتم المراجعة' }, { status: 400 })
      }
      const hasApproved = existing.find((a) => a.status === 'approved')
      if (hasApproved) {
        return NextResponse.json({ success: false, message: 'أنت تاجر موثق بالفعل' }, { status: 400 })
      }

      // Create application
      const application = await merchantApplicationOperations.create({
        userId,
        userFullName: user.fullName || '',
        userEmail: user.email,
        userPhone: user.phone || '',
        idPhotoUrl: idPhoto,
        selfiePhotoUrl: selfiePhoto,
        addressProofUrl: addressProof,
      })

      // Notify user
      await notificationOperations.create({
        userId,
        title: 'تم إرسال طلب التوثيق',
        message: 'تم إرسال طلب توثيق التاجر بنجاح. سيتم مراجعة الطلب والرد عليك قريباً.',
        type: 'p2p',
        read: false,
      })

      // Notify admins about new merchant application
      try {
        const db = getDb()
        const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').limit(10).get()
        for (const adminDoc of adminsSnapshot.docs) {
          await notificationOperations.create({
            userId: adminDoc.id,
            title: 'طلب تاجر جديد',
            message: `طلب توثيق تاجر جديد من ${user.fullName || user.email}`,
            type: 'warning',
            read: false,
          })
          sendPushNotification(adminDoc.id, 'طلب تاجر جديد', `طلب توثيق من ${user.fullName || user.email}`, 'warning').catch(() => {})
        }
      } catch (err) {
        console.error('Error notifying admins about merchant application:', err)
      }

      return NextResponse.json({
        success: true,
        message: 'تم إرسال طلب التوثيق بنجاح',
        application,
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: any) {
    console.error('[Merchant POST]', error)
    return NextResponse.json({ success: false, message: 'خطأ في إرسال طلب التوثيق' }, { status: 500 })
  }
}
