import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, token, startDate, endDate } = body

    if (!userId || !startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم وتاريخ البداية والنهاية مطلوبان' }, { status: 400 })
    }

    const db = getDb()

    // Fetch user info
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 })
    }
    const userData = userDoc.data()

    // Fetch transactions for the user
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .limit(500)
      .get()

    let transactions = snapshot.docs.map(doc => doc.data())

    // Filter by date range
    const from = new Date(startDate).getTime()
    const to = new Date(endDate).getTime()
    const endOfDay = to + 86399999 // Include the full end date

    transactions = transactions.filter((tx: any) => {
      const txTime = new Date(tx.createdAt).getTime()
      return txTime >= from && txTime <= endOfDay
    })

    // Sort by date ascending for the statement
    transactions.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    // Calculate balances
    const currentBalance = userData.balance || 0
    let openingBalance = currentBalance
    for (const tx of transactions) {
      openingBalance -= (tx.amount || 0)
    }

    let closingBalance = openingBalance
    const txLines: string[] = []
    for (const tx of transactions) {
      closingBalance += (tx.amount || 0)
      const date = new Date(tx.createdAt).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      const type = tx.type === 'deposit' ? 'إيداع' :
                   tx.type === 'withdrawal' ? 'سحب' :
                   tx.type === 'transfer_in' ? 'تحويل وارد' :
                   tx.type === 'transfer_out' ? 'تحويل صادر' :
                   tx.type === 'bonus' ? 'مكافأة' : tx.type
      const amt = (tx.amount || 0).toFixed(2)
      const bal = closingBalance.toFixed(2)

      txLines.push(
        `| ${date.padEnd(20)} | ${type.padEnd(15)} | ${amt.padStart(10)} | ${bal.padStart(12)} |`
      )
    }

    // Build the text statement
    const separator = '+' + '-'.repeat(22) + '+' + '-'.repeat(17) + '+' + '-'.repeat(12) + '+' + '-'.repeat(14) + '+'
    const headerLine = `| ${'التاريخ'.padEnd(20)} | ${'النوع'.padEnd(15)} | ${'المبلغ'.padStart(10)} | ${'الرصيد'.padStart(12)} |`

    const statement = `
${'═'.repeat(60)}
        كشف حساب - فوركس يمني
${'═'.repeat(60)}

معلومات الحساب
${'─'.repeat(40)}
  الاسم:          ${userData.fullName || '-'}
  البريد:         ${userData.email}
  رقم الهاتف:     ${userData.phone || '-'}
  حالة الحساب:    ${userData.status === 'active' ? 'مفعّل' : userData.status}

فترة الكشف
${'─'.repeat(40)}
  من:  ${new Date(startDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
  إلى:  ${new Date(endDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
  تاريخ الإصدار:  ${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}

الرصيد
${'─'.repeat(40)}
  رصيد الافتتاح:  ${openingBalance.toFixed(2)} USDT
  رصيد الإغلاق:   ${closingBalance.toFixed(2)} USDT
  عدد المعاملات:  ${transactions.length}

${transactions.length > 0 ? `
المعاملات
${separator}
${headerLine}
${separator}
${txLines.join('\n')}
${separator}
` : `
لا توجد معاملات في الفترة المحددة.
`}

${'═'.repeat(60)}
  هذا الكشف تلقائي من فوركس يمني - USDT TRC20 Wallet
  ForexYemeni Wallet - forexyemeni.com
${'═'.repeat(60)}
`.trim()

    // Create downloadable text file
    const fileName = `account_statement_${new Date().toISOString().split('T')[0]}.txt`
    const buffer = Buffer.from(statement, 'utf-8')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
