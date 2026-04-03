import { NextRequest, NextResponse } from 'next/server'
import { userOperations, withdrawalOperations, transactionOperations, notificationOperations } from '@/lib/db-firebase'

// GET all withdrawals (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const withdrawals = await withdrawalOperations.findMany(status ? { status } : undefined)

    return NextResponse.json({ success: true, withdrawals })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// POST update withdrawal status (admin)
export async function POST(request: NextRequest) {
  try {
    const { withdrawalId, status, adminNote, txId } = await request.json()

    if (!withdrawalId || !status) {
      return NextResponse.json({ success: false, message: 'معرف السحب والحالة مطلوبان' }, { status: 400 })
    }

    if (!['approved', 'rejected', 'processing'].includes(status)) {
      return NextResponse.json({ success: false, message: 'حالة غير صحيحة' }, { status: 400 })
    }

    const withdrawal = await withdrawalOperations.findUnique(withdrawalId)
    if (!withdrawal) {
      return NextResponse.json({ success: false, message: 'السحب غير موجود' }, { status: 404 })
    }

    const updatedWithdrawal = await withdrawalOperations.update(withdrawalId, {
      status,
      adminNote: adminNote || null,
      txId: txId || null,
    })

    if (status === 'approved' || status === 'processing') {
      const user = await userOperations.findUnique({ id: withdrawal.userId })
      if (user) {
        const newFrozen = user.frozenBalance - (withdrawal.amount + withdrawal.fee)
        await userOperations.updateFrozenBalance(withdrawal.userId, newFrozen)

        await transactionOperations.create({
          userId: withdrawal.userId,
          type: 'withdrawal',
          amount: -(withdrawal.amount + withdrawal.fee),
          balanceBefore: user.balance,
          balanceAfter: user.balance,
          description: `سحب USDT TRC20 إلى ${withdrawal.toAddress.substring(0, 10)}...`,
          referenceId: withdrawal.id,
        })

        await notificationOperations.create({
          userId: withdrawal.userId,
          title: status === 'approved' ? 'تم اعتماد السحب' : 'جاري معالجة السحب',
          message: `جاري معالجة سحبك بقيمة ${withdrawal.amount} USDT`,
          type: 'info',
        })
      }
    }

    if (status === 'rejected') {
      const user = await userOperations.findUnique({ id: withdrawal.userId })
      if (user) {
        const totalRefund = withdrawal.amount + withdrawal.fee
        await userOperations.update({ id: withdrawal.userId }, {
          balance: user.balance + totalRefund,
          frozenBalance: user.frozenBalance - totalRefund,
        })

        await notificationOperations.create({
          userId: withdrawal.userId,
          title: 'تم رفض السحب',
          message: `تم رفض طلب سحبك بقيمة ${withdrawal.amount} USDT. تم إعادة المبلغ إلى رصيدك.`,
          type: 'warning',
        })
      }
    }

    return NextResponse.json({ success: true, withdrawal: updatedWithdrawal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
