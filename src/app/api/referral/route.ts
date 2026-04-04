import { NextRequest, NextResponse } from 'next/server'
import { userOperations, referralOperations, systemSettingsOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'
import { sendPushNotification } from '@/lib/push-notification'

const ADMIN_EMAIL = 'mshay2024m@gmail.com'

// GET /api/referral?action=get_settings|my_stats|my_commissions|validate_code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (!action) {
      return NextResponse.json({ success: false, message: 'الإجراء مطلوب' }, { status: 400 })
    }

    // Public: get referral settings
    if (action === 'get_settings') {
      const settings = await systemSettingsOperations.getReferralSettings()
      // Return only public info (don't expose all internal details)
      return NextResponse.json({
        success: true,
        settings: {
          isEnabled: settings.isEnabled,
          commissionType: settings.commissionType,
          commissionLevels: settings.commissionLevels,
          maxLevels: settings.maxLevels,
        },
      })
    }

    // Validate referral code
    if (action === 'validate_code') {
      const code = searchParams.get('code')
      if (!code) {
        return NextResponse.json({ success: false, message: 'الكود مطلوب' }, { status: 400 })
      }
      const referrer = await systemSettingsOperations.findByAffiliateCode(code.toUpperCase().trim())
      if (!referrer) {
        return NextResponse.json({ success: false, message: 'كود الدعوة غير صالح' })
      }
      return NextResponse.json({ success: true, valid: true })
    }

    // Auth-required actions below
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ success: false, message: 'التصريح مطلوب' }, { status: 401 })
    }

    // Simple token validation (find user by checking token is valid format)
    // In production, verify JWT. Here we use a simple approach.
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 })
    }

    const user = await userOperations.findUnique({ id: userId })
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }

    // My referral stats
    if (action === 'my_stats') {
      const referrals = await referralOperations.findByReferrer(userId)
      const activeReferrals = referrals.filter(r => r.status === 'active')
      const totalEarnings = referrals.reduce((sum, r) => sum + (r.totalEarnings || 0), 0)

      // Group by level
      const levelStats: { level: number; count: number; earnings: number }[] = []
      const maxLevels = 5
      for (let i = 1; i <= maxLevels; i++) {
        const levelReferrals = referrals.filter(r => r.level === i)
        if (levelReferrals.length > 0 || i <= 3) {
          levelStats.push({
            level: i,
            count: levelReferrals.length,
            earnings: levelReferrals.reduce((sum, r) => sum + (r.totalEarnings || 0), 0),
          })
        }
      }

      return NextResponse.json({
        success: true,
        stats: {
          totalReferrals: referrals.length,
          activeReferrals: activeReferrals.length,
          totalEarnings,
          levelStats,
          referralCode: user.affiliateCode,
        },
      })
    }

    // My commission history
    if (action === 'my_commissions') {
      const commissions = await referralOperations.findByReferrerCommissions(userId)
      return NextResponse.json({ success: true, commissions })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST /api/referral?action=apply_code|update_settings|process_commissions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ success: false, message: 'الإجراء مطلوب' }, { status: 400 })
    }

    // Apply referral code during registration
    if (action === 'apply_code') {
      const { userId, referralCode } = body
      if (!userId || !referralCode) {
        return NextResponse.json({ success: false, message: 'البيانات مطلوبة' }, { status: 400 })
      }

      const settings = await systemSettingsOperations.getReferralSettings()
      if (!settings.isEnabled) {
        return NextResponse.json({ success: false, message: 'نظام الدعوات غير مفعل حالياً' })
      }

      // Check if user already has a referral
      const existingReferral = await referralOperations.findByReferred(userId)
      if (existingReferral.length > 0) {
        return NextResponse.json({ success: false, message: 'تم تطبيق كود دعوة مسبقاً' })
      }

      // Find the referrer
      const referrer = await systemSettingsOperations.findByAffiliateCode(referralCode.toUpperCase().trim())
      if (!referrer) {
        return NextResponse.json({ success: false, message: 'كود الدعوة غير صالح' })
      }

      // Can't refer yourself
      if (referrer.id === userId) {
        return NextResponse.json({ success: false, message: 'لا يمكنك استخدام كودك الخاص' })
      }

      const referred = await userOperations.findUnique({ id: userId })
      if (!referred) {
        return NextResponse.json({ success: false, message: 'المستخدم غير موجود' })
      }

      // Create the referral relationship (Level 1)
      const referral = await referralOperations.create({
        referrerId: referrer.id,
        referredId: userId,
        referredEmail: referred.email,
        referralCode: referralCode.toUpperCase().trim(),
        level: 1,
        status: 'active',
      })

      // Update the referred user's referredBy field
      await userOperations.update({ id: userId }, { referredBy: referrer.id })

      // Now create higher-level referrals (Level 2, 3, etc.)
      // Find who referred the referrer (Level 2)
      let currentReferrerId = referrer.id
      for (let level = 2; level <= settings.maxLevels; level++) {
        const parentReferrals = await referralOperations.findByReferred(currentReferrerId)
        const parentReferral = parentReferrals.find(r => r.level === 1)
        if (!parentReferral) break

        await referralOperations.create({
          referrerId: parentReferral.referrerId,
          referredId: userId,
          referredEmail: referred.email,
          referralCode: referralCode.toUpperCase().trim(),
          level,
          status: 'active',
        })

        currentReferrerId = parentReferral.referrerId
      }

      // Notify the referrer
      const title = 'دعوة جديدة! 🎉'
      const msg = `قام ${referred.fullName || referred.email} بالتسجيل باستخدام كود الدعوة الخاص بك`
      await notificationOperations.create({ userId: referrer.id, title, message: msg, type: 'success', read: false })
      sendPushNotification(referrer.id, title, msg, 'success').catch(() => {})

      return NextResponse.json({ success: true, message: 'تم تطبيق كود الدعوة بنجاح', referral })
    }

    // Admin: update referral settings
    if (action === 'update_settings') {
      const { adminId, settings: newSettings } = body
      if (!adminId) {
        return NextResponse.json({ success: false, message: 'معرف المدير مطلوب' }, { status: 400 })
      }

      const admin = await userOperations.findUnique({ id: adminId })
      if (!admin || (admin.role !== 'admin' && admin.email !== ADMIN_EMAIL)) {
        return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 403 })
      }

      const updated = await systemSettingsOperations.updateReferralSettings(newSettings)
      return NextResponse.json({ success: true, message: 'تم تحديث الإعدادات بنجاح', settings: updated })
    }

    // Process commissions (called when deposit is confirmed)
    if (action === 'process_commissions') {
      const { depositId } = body
      if (!depositId) {
        return NextResponse.json({ success: false, message: 'معرف الإيداع مطلوب' }, { status: 400 })
      }

      const settings = await systemSettingsOperations.getReferralSettings()
      if (!settings.isEnabled) {
        return NextResponse.json({ success: true, message: 'نظام الدعوات غير مفعل', commissionsProcessed: 0 })
      }

      // Find the user who made the deposit
      const { depositOperations } = await import('@/lib/db-firebase')
      const deposit = await depositOperations.findUnique(depositId)
      if (!deposit || deposit.status !== 'confirmed') {
        return NextResponse.json({ success: false, message: 'الإيداع غير موجود أو غير مؤكد' }, { status: 400 })
      }

      const creditAmount = deposit.netAmount ?? deposit.amount
      if (creditAmount < settings.minDepositForCommission) {
        return NextResponse.json({ success: true, message: 'المبلغ أقل من الحد الأدنى للعمولة', commissionsProcessed: 0 })
      }

      // Find referral chain for this user
      const userReferrals = await referralOperations.findByReferred(deposit.userId)
      if (userReferrals.length === 0) {
        return NextResponse.json({ success: true, message: 'لا يوجد سلسلة دعوات', commissionsProcessed: 0 })
      }

      let commissionsProcessed = 0
      const errors: string[] = []

      // Process each level
      for (const referral of userReferrals) {
        if (referral.status !== 'active') continue
        if (referral.level > settings.maxLevels) continue

        const levelIndex = referral.level - 1
        const commissionValue = settings.commissionLevels[levelIndex]
        if (!commissionValue || commissionValue <= 0) continue

        // Calculate commission amount
        let commissionAmount: number
        if (settings.commissionType === 'percentage') {
          commissionAmount = (creditAmount * commissionValue) / 100
        } else {
          commissionAmount = commissionValue
        }

        // Round to 2 decimal places
        commissionAmount = Math.round(commissionAmount * 100) / 100
        if (commissionAmount <= 0) continue

        try {
          // Credit commission to referrer's balance
          const referrerUser = await userOperations.findUnique({ id: referral.referrerId })
          if (!referrerUser) {
            errors.push(`المستخدم ${referral.referrerId} غير موجود`)
            continue
          }

          const balanceBefore = referrerUser.balance
          const balanceAfter = balanceBefore + commissionAmount

          await userOperations.updateBalance(referral.referrerId, balanceAfter)

          // Create transaction record for the referrer
          await transactionOperations.create({
            userId: referral.referrerId,
            type: 'referral_commission',
            amount: commissionAmount,
            balanceBefore,
            balanceAfter,
            description: `عمولة دعوة مستوى ${referral.level} - من إيداع ${deposit.userId.substring(0, 8)}`,
            referenceId: deposit.id,
          })

          // Create commission record
          await referralOperations.createCommission({
            referrerId: referral.referrerId,
            referredId: deposit.userId,
            referralId: referral.id,
            depositId: deposit.id,
            amount: commissionAmount,
            level: referral.level,
            description: `عمولة مستوى ${referral.level} من إيداع بقيمة ${creditAmount.toFixed(2)} USDT`,
          })

          // Update referral total earnings
          await referralOperations.updateEarnings(referral.id, commissionAmount)

          // Notify the referrer
          const title = 'عمولة دعوة جديدة 💰'
          const msg = `حصلت على ${commissionAmount.toFixed(2)} USDT عمولة من دعوة مستوى ${referral.level}`
          await notificationOperations.create({ userId: referral.referrerId, title, message: msg, type: 'success', read: false })
          sendPushNotification(referral.referrerId, title, msg, 'success').catch(() => {})

          commissionsProcessed++
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`خطأ في معالجة العمولة للمستوى ${referral.level}: ${errMsg}`)
        }
      }

      return NextResponse.json({
        success: true,
        message: `تم معالجة ${commissionsProcessed} عمولة`,
        commissionsProcessed,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
