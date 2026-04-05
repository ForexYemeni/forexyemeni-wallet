import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, startDate, endDate } = body

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
    const endOfDay = to + 86399999

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

    // Build transaction rows
    let runningBalance = openingBalance
    const txRows: string[] = []
    for (const tx of transactions) {
      runningBalance += (tx.amount || 0)
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
      const isPositive = (tx.amount || 0) >= 0
      txRows.push(`
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap;">${date}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;">${type}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;text-align:${isPositive ? 'left' : 'left'};color:${isPositive ? '#059669' : '#dc2626'};">${isPositive ? '+' : ''}${amt}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;text-align:left;">${runningBalance.toFixed(2)}</td>
        </tr>
      `)
    }

    const totalDeposits = transactions.filter((t: any) => t.amount > 0 && (t.type === 'deposit' || t.type === 'transfer_in')).reduce((s: number, t: any) => s + (t.amount || 0), 0)
    const totalWithdrawals = transactions.filter((t: any) => t.type === 'withdrawal' || t.type === 'transfer_out').reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0)
    const totalBonuses = transactions.filter((t: any) => t.type === 'bonus').reduce((s: number, t: any) => s + (t.amount || 0), 0)

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>كشف حساب - فوركس يمني</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #1f2937;
    background: #fff;
    padding: 30px;
    max-width: 800px;
    margin: 0 auto;
    direction: rtl;
  }
  .header {
    text-align: center;
    padding-bottom: 20px;
    border-bottom: 3px solid #d4af37;
    margin-bottom: 25px;
  }
  .header h1 { font-size: 24px; color: #d4af37; margin-bottom: 5px; }
  .header p { font-size: 13px; color: #6b7280; }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 25px;
  }
  .info-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px 16px;
  }
  .info-card .label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
  .info-card .value { font-size: 14px; font-weight: 600; color: #1f2937; }
  .balance-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 25px;
  }
  .balance-card {
    text-align: center;
    padding: 16px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
  }
  .balance-card.opening { background: #eff6ff; border-color: #bfdbfe; }
  .balance-card.closing { background: #ecfdf5; border-color: #a7f3d0; }
  .balance-card.count { background: #fef3c7; border-color: #fde68a; }
  .balance-card .label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
  .balance-card .value { font-size: 20px; font-weight: 700; }
  .balance-card .unit { font-size: 12px; color: #9ca3af; }
  .summary-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 25px;
  }
  .summary-item {
    text-align: center;
    padding: 12px;
    border-radius: 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
  }
  .summary-item .label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
  .summary-item .value { font-size: 16px; font-weight: 700; }
  .summary-item.deposits .value { color: #059669; }
  .summary-item.withdrawals .value { color: #dc2626; }
  .summary-item.bonuses .value { color: #d4af37; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  thead th {
    padding: 12px;
    text-align: right;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    background: #f9fafb;
  }
  thead th:last-child, thead th:nth-child(3) { text-align: left; }
  .footer {
    text-align: center;
    padding-top: 20px;
    border-top: 2px solid #e5e7eb;
    color: #9ca3af;
    font-size: 11px;
  }
  .footer .brand { color: #d4af37; font-weight: 600; font-size: 13px; margin-bottom: 4px; }
  .no-print { display: none; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>💰 فوركس يمني</h1>
    <p>كشف حساب USDT TRC20</p>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="label">الاسم الكامل</div>
      <div class="value">${userData.fullName || '-'}</div>
    </div>
    <div class="info-card">
      <div class="label">البريد الإلكتروني</div>
      <div class="value" style="direction:ltr;text-align:right;">${userData.email}</div>
    </div>
    <div class="info-card">
      <div class="label">رقم الهاتف</div>
      <div class="value">${userData.phone ? '+967 ' + userData.phone : 'غير محدد'}</div>
    </div>
    <div class="info-card">
      <div class="label">حالة الحساب</div>
      <div class="value" style="color:${userData.status === 'active' ? '#059669' : '#dc2626'}">${userData.status === 'active' ? 'مفعّل' : userData.status}</div>
    </div>
  </div>

  <div class="info-grid" style="margin-bottom:20px;">
    <div class="info-card">
      <div class="label">من</div>
      <div class="value" style="font-size:13px;">${new Date(startDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
    <div class="info-card">
      <div class="label">إلى</div>
      <div class="value" style="font-size:13px;">${new Date(endDate).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  <div class="balance-section">
    <div class="balance-card opening">
      <div class="label">رصيد الافتتاح</div>
      <div class="value">${openingBalance.toFixed(2)}</div>
      <div class="unit">USDT</div>
    </div>
    <div class="balance-card closing">
      <div class="label">رصيد الإغلاق</div>
      <div class="value">${(openingBalance + transactions.reduce((s: number, t: any) => s + (t.amount || 0), 0)).toFixed(2)}</div>
      <div class="unit">USDT</div>
    </div>
    <div class="balance-card count">
      <div class="label">عدد المعاملات</div>
      <div class="value">${transactions.length}</div>
      <div class="unit">معاملة</div>
    </div>
  </div>

  <div class="summary-row">
    <div class="summary-item deposits">
      <div class="label">إجمالي الإيداعات</div>
      <div class="value">+${totalDeposits.toFixed(2)}</div>
    </div>
    <div class="summary-item withdrawals">
      <div class="label">إجمالي السحوبات</div>
      <div class="value">-${totalWithdrawals.toFixed(2)}</div>
    </div>
    <div class="summary-item bonuses">
      <div class="label">المكافآت</div>
      <div class="value">+${totalBonuses.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="label">صافي الحركة</div>
      <div class="value" style="color:${(totalDeposits + totalBonuses - totalWithdrawals) >= 0 ? '#059669' : '#dc2626'}">${(totalDeposits + totalBonuses - totalWithdrawals) >= 0 ? '+' : ''}${(totalDeposits + totalBonuses - totalWithdrawals).toFixed(2)}</div>
    </div>
  </div>

  ${transactions.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>التاريخ</th>
        <th>النوع</th>
        <th style="text-align:left;">المبلغ (USDT)</th>
        <th style="text-align:left;">الرصيد (USDT)</th>
      </tr>
    </thead>
    <tbody>
      ${txRows.join('\n')}
    </tbody>
  </table>
  ` : `
  <div style="text-align:center;padding:40px;color:#9ca3af;">
    <p style="font-size:16px;margin-bottom:8px;">لا توجد معاملات في الفترة المحددة</p>
    <p style="font-size:13px;">جرب تغيير تاريخ البحث</p>
  </div>
  `}

  <div class="footer">
    <div class="brand">ForexYemeni Wallet</div>
    <p>كشف حساب تلقائي صادر في ${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <p style="margin-top:4px;">هذا الكشف تلقائي ولأغراض مرجعية فقط - USDT TRC20 Network</p>
  </div>

  <div class="no-print" style="text-align:center;padding:20px;margin-top:20px;">
    <button onclick="window.print()" style="padding:12px 40px;background:#d4af37;color:#111;font-size:16px;font-weight:700;border:none;border-radius:10px;cursor:pointer;">
      📄 حفظ كـ PDF / طباعة
    </button>
    <p style="margin-top:10px;font-size:12px;color:#9ca3af;">اضغط على الزر أعلاه ثم اختر "Save as PDF" من نافذة الطباعة</p>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
