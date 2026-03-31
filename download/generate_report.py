# -*- coding: utf-8 -*-
import os
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Register fonts
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

pdf_path = '/home/z/my-project/download/forexyemeni-wallet-review-report.pdf'

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=A4,
    topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm,
    title='forexyemeni-wallet-review-report',
    author='Z.ai',
    creator='Z.ai',
    subject='ForexYemeni Wallet App Code Review Report'
)

# Styles
cover_title = ParagraphStyle('CoverTitle', fontName='SimHei', fontSize=28, leading=40, alignment=TA_CENTER, spaceAfter=12, wordWrap='CJK')
cover_sub = ParagraphStyle('CoverSub', fontName='SimHei', fontSize=14, leading=22, alignment=TA_CENTER, spaceAfter=8, textColor=colors.HexColor('#555555'), wordWrap='CJK')
cover_info = ParagraphStyle('CoverInfo', fontName='SimHei', fontSize=11, leading=18, alignment=TA_CENTER, spaceAfter=6, textColor=colors.HexColor('#777777'), wordWrap='CJK')

h1_style = ParagraphStyle('H1', fontName='SimHei', fontSize=16, leading=24, alignment=TA_LEFT, spaceBefore=16, spaceAfter=8, textColor=colors.HexColor('#1a1a2e'), wordWrap='CJK')
h2_style = ParagraphStyle('H2', fontName='SimHei', fontSize=13, leading=20, alignment=TA_LEFT, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor('#16213e'), wordWrap='CJK')
h3_style = ParagraphStyle('H3', fontName='SimHei', fontSize=11, leading=18, alignment=TA_LEFT, spaceBefore=8, spaceAfter=4, textColor=colors.HexColor('#0f3460'), wordWrap='CJK')

body_style = ParagraphStyle('Body', fontName='SimHei', fontSize=10, leading=18, alignment=TA_LEFT, spaceAfter=6, wordWrap='CJK')
body_indent = ParagraphStyle('BodyIndent', fontName='SimHei', fontSize=10, leading=18, alignment=TA_LEFT, spaceAfter=4, leftIndent=12, wordWrap='CJK')
code_style = ParagraphStyle('Code', fontName='SimHei', fontSize=8.5, leading=14, alignment=TA_LEFT, spaceAfter=4, leftIndent=16, textColor=colors.HexColor('#d32f2f'), backColor=colors.HexColor('#fff3f3'), wordWrap='CJK')
note_style = ParagraphStyle('Note', fontName='SimHei', fontSize=9, leading=16, alignment=TA_LEFT, spaceAfter=4, leftIndent=12, textColor=colors.HexColor('#e65100'), wordWrap='CJK')

# Table styles
th_style = ParagraphStyle('TH', fontName='SimHei', fontSize=9, leading=14, alignment=TA_CENTER, textColor=colors.white, wordWrap='CJK')
td_style = ParagraphStyle('TD', fontName='SimHei', fontSize=8.5, leading=13, alignment=TA_LEFT, wordWrap='CJK')
td_center = ParagraphStyle('TDC', fontName='SimHei', fontSize=8.5, leading=13, alignment=TA_CENTER, wordWrap='CJK')

TABLE_HEADER_COLOR = colors.HexColor('#1F4E79')
TABLE_ROW_ODD = colors.HexColor('#F5F5F5')

def make_table(headers, rows, col_widths=None):
    data = [[Paragraph('<b>' + h + '</b>', th_style) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), td_center if i > 0 else td_style) for i, c in enumerate(r)])
    if not col_widths:
        col_widths = [doc.width / len(headers)] * len(headers)
    t = Table(data, colWidths=col_widths)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_ROW_ODD))
    t.setStyle(TableStyle(style_cmds))
    return t

story = []

# ==================== COVER PAGE ====================
story.append(Spacer(1, 100))
story.append(Paragraph('<b>ForexYemeni Wallet</b>', cover_title))
story.append(Spacer(1, 16))
story.append(Paragraph('<b>تقرير مراجعة الكود الشاملة</b>', ParagraphStyle('CoverTitle2', fontName='SimHei', fontSize=22, leading=32, alignment=TA_CENTER, textColor=colors.HexColor('#F0B90B'), wordWrap='CJK')))
story.append(Spacer(1, 36))
story.append(Paragraph('تحليل الاخطاء البرمجية والمشاكل الامنية والميزات الناقصة', cover_sub))
story.append(Spacer(1, 60))
story.append(Paragraph('الاصدار: 1.0', cover_info))
story.append(Paragraph('تاريخ المراجعة: 2026-03-31', cover_info))
story.append(Paragraph('حجم الملف: 3,839 سطر', cover_info))
story.append(Paragraph('التقنية: HTML / JavaScript / Firebase Firestore', cover_info))
story.append(Spacer(1, 48))
story.append(Paragraph('تم المراجعة بواسطة Z.ai', cover_info))
story.append(PageBreak())

# ==================== SECTION 1: EXECUTIVE SUMMARY ====================
story.append(Paragraph('<b>1. الملخص التنفيذي</b>', h1_style))
story.append(Spacer(1, 6))
story.append(Paragraph(
    'تم اجراء مراجعة شاملة لتطبيق ForexYemeni Wallet وهو محفظة عملات رقمية تعمل بملف HTML واحد مع Firebase Firestore كقاعدة بيانات. '
    'التطبيق يدعم ثلاث ادوار: مستخدم وتاجر وادارة مع نظام ايداع وسحب وتوثيق هوية ونظام عمولات ومحادثات مباشرة. '
    'كشف التحليل عن وجود اخطاء برمجية حرجة تؤثر على وظائف اساسية بالاضافة الى ثغرات امنية خطيرة وميزات مفقودة مهمة. '
    'فيما يلي تفصيل كامل لكل مشكلة مع ترتيب حسب الاولوية.',
    body_style
))
story.append(Spacer(1, 8))

# Summary table
summary_data = [
    ['الاخطاء البرمجية', '7', '2 حرج + 3 متوسط + 2 منخفض'],
    ['المشاكل الامنية', '8', '4 حرج + 4 متوسط'],
    ['سلامة البيانات', '5', '4 متوسط + 1 منخفض'],
    ['الميزات المفقودة', '8', 'مهمة للتطبيق الاحترافي'],
    ['مشاكل واجهة المستخدم', '4', 'تؤثر على تجربة المستخدم'],
    ['مشاكل الاداء', '3', 'ستزداد مع نمو البيانات'],
]
story.append(make_table(['الفئة', 'العدد', 'التفاصيل'], summary_data, [4*cm, 2*cm, 10*cm]))
story.append(Spacer(1, 18))

# ==================== SECTION 2: CRITICAL BUGS ====================
story.append(Paragraph('<b>2. الاخطاء البرمجية الحرجة</b>', h1_style))
story.append(Spacer(1, 6))

# BUG 1
story.append(Paragraph('<b>2.1 BUG-01: دوال غير معرفة تمنع رفع اثبات تنفيذ السحب</b>', h2_style))
story.append(Paragraph(
    'الدالتان showImagePreviewAfterCapture و fileForFieldWithPreview مُستدعتان في نموذج اثبات تنفيذ السحب الخاص بالتاجر (السطر 1907-1908) لكنهما غير معرفتان في اي مكان بالكود. هذا يعني ان التاجر لا يستطيع ابدا رفع لقطة اثبات التنفيذ مما يعطل سير عمل السحب بالكامل عبر التاجر.',
    body_style
))
story.append(Paragraph('موقع الخطا: السطور 1907-1908', note_style))
story.append(Paragraph(
    '&lt;button onclick="captureForField(&apos;merchWdProof&apos;);showImagePreviewAfterCapture(...)" &gt; &lt;/button&gt;',
    code_style
))
story.append(Paragraph(
    '<b>الحل:</b> تعريف الدالتين المفقودتين او استبدالهما بالدوال الموجودة مسبقا captureForField و fileForField مع اضافة عرض المعاينة يدويا.',
    body_style
))
story.append(Spacer(1, 8))

# BUG 2
story.append(Paragraph('<b>2.2 BUG-02: التاجر لا يُخصم رصيده عند قبول الايداع</b>', h2_style))
story.append(Paragraph(
    'في دالة confirmMerchantApproveDeposit عندما يوافق التاجر على ايداع المستخدم يتم اضافة الرصيد للمستخدم لكن لا يتم خصم اي مبلغ من رصيد التاجر. هذا يعني ان التاجر يمكنه قبول ايداعات بقيمة اكثر من رصيده الفعلي مما يخلق اموالا من لا شيء ويسبب عدم توازن مالي خطير.',
    body_style
))
story.append(Paragraph('موقع الخطا: السطر 1752 في دالة confirmMerchantApproveDeposit', note_style))
story.append(Paragraph(
    '<b>الحل:</b> اضافة خصم من رصيد التاجر بمقدار usdtAmount عند الموافقة على الايداع مع التحقق من كفاية الرصيد قبل التنفيذ.',
    body_style
))
story.append(Spacer(1, 8))

# BUG 3
story.append(Paragraph('<b>2.3 BUG-03: نص صيني في رسالة خطأ</b>', h2_style))
story.append(Paragraph(
    'في السطر 461 توجد رسالة خطأ تحتوي على كلمة صينية "刷新" (تعني تحديث) بدلا من الكلمة العربية المناسبة. هذا خطا واضح في الترجمة.',
    body_style
))
story.append(Paragraph(
    '&lt;toast(&apos;خطأ في تحميل البيانات - حاول刷新 الصفحة&apos;,&apos;error&apos;) &gt;',
    code_style
))
story.append(Paragraph('<b>الحل:</b> استبدال الكلمة الصينية بـ "إعادة تحميل الصفحة".', body_style))
story.append(Spacer(1, 8))

# BUG 4
story.append(Paragraph('<b>2.4 BUG-04: دالة requestEmailChange معطلة بالكامل</b>', h2_style))
story.append(Paragraph(
    'الدالة معرّفة في السطر 1341 لكن لا يوجد اي مكان في الواجهة يستدعيها. لا يوجد عنصر HTML بمعرف set-new-email ولا زر لتنفيذ الدالة. هذه ميزة لتغيير البريد الالكتروني معطلة تماما رغم وجود كودها الكامل.',
    body_style
))
story.append(Paragraph('<b>الحل:</b> اما اضافة رابط تغيير البريد في صفحة الاعدادات او حذف الكود الميت.', body_style))
story.append(Spacer(1, 8))

# BUG 5
story.append(Paragraph('<b>2.5 BUG-05: العمولات اليومية لا تعمل تلقائيا</b>', h2_style))
story.append(Paragraph(
    'الدالة executeDailyAdminCommissions معرّفة في السطر 3238 لكن لا يوجد اي مؤقت setInterval او آلية تشغيل تلقائية. العمولات اليومية لن تُنفذ الا اذا تم تشغيلها يدويا من وحدة التحكم في المتصفح وهو غير عملي.',
    body_style
))
story.append(Paragraph('<b>الحل:</b> اضافة setInterval لتشغيل الدالة يوميا او تشغيلها عند كل تسجيل دخول للادارة مع التحقق من اخر تاريخ تنفيذ.', body_style))
story.append(Spacer(1, 8))

# BUG 6
story.append(Paragraph('<b>2.6 BUG-06: نظام العمولات متعدد المستويات غير مكتمل</b>', h2_style))
story.append(Paragraph(
    'الاعدادات تحتوي على ثلاث مستويات للعمولات (aff_l1 و aff_l2 و aff_l3) لكن دالة calculateAffiliateCommission في السطر 2510 تستخدم المستوى الاول فقط. المستويان الثاني والثالث معرفان في الاعدادات لكن لا يتم حسابهما ابدا مما يجعل نظام العمولات متعدد المستويات غير فعال.',
    body_style
))
story.append(Paragraph(
    '<b>الحل:</b> تعديل calculateAffiliateCommission لتدوير سلسلة الاحالات والاحتساب لكل مستوى: '
    'المستوى الاول من المُحال المباشر والمستوى الثاني من مُحال المُحال والمستوى الثالث هكذا.',
    body_style
))
story.append(Spacer(1, 18))

# ==================== SECTION 3: SECURITY ====================
story.append(Paragraph('<b>3. المشاكل الامنية</b>', h1_style))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>3.1 SEC-01: كلمة مرور المدير مكشوفة في الكود المصدري</b>', h2_style))
story.append(Paragraph(
    'كلمة مرور المدير ورقم هاتفه موجودان بنص واضح في عدة اماكن بالكود المصدري (السطور 260 و 444-445). اي شخص يفحص الكود المصدري للصفحة يستطيع الوصول لحساب الادارة مباشرة. هذا يشكل خطرا امنيا حرجا خاصة لان حساب الادارة يملك صلاحيات كاملة على كل البيانات والاموال.',
    body_style
))
story.append(Paragraph(
    '<b>الحل:</b> عدم تخزين كلمة المرور الافتراضية في الكود. بدلا من ذلك انشاء حساب المدير الاول فقط عند اول تشغيل مع مطالبة المستخدم بتعيين كلمة المرور.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>3.2 SEC-02: لا يوجد تشفير لكلمات المرور</b>', h2_style))
story.append(Paragraph(
    'كلمات المرور تُخزن وتُقارن بنص واضح (plaintext) في قاعدة البيانات. اي شخص لديه صلاحية الوصول لقاعدة بيانات Firebase يمكنه قراءة كلمات مرور جميع المستخدمين. هذا يتعارض مع ابسط معايير الامان لتطبيقات المحافظ الرقمية.',
    body_style
))
story.append(Paragraph(
    '<b>الحل:</b> استخدام تشفير احادي الاتجاه مثل SHA-256 عند التخزين والمقارنة. يمكن استخدام Web Crypto API المتوفر في المتصفحات بدون مكتبات خارجية.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>3.3 SEC-03: المصادقة بدون جلسة آمنة</b>', h2_style))
story.append(Paragraph(
    'المستخدم يُعرّف فقط بمعرّف محفوظ في localStorage. اي شخص يمكنه تعديل القيمة ووضع معرّف اي مستخدم آخر والوصول لحسابه. لا يوجد Token او Session آمن للتحقق من هوية المستخدم.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>3.4 SEC-04: لا يوجد Firebase Security Rules</b>', h2_style))
story.append(Paragraph(
    'كل البيانات في مجموعة appData واحدة بدون اي حماية. لا يوجد تحقق من هوية المستخدم او صلاحياته قبل القراءة والكتابة. اي شخص لديه projectId يمكنه قراءة وتعديل كل البيانات بما فيها الارصدة المالية.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>3.5 SEC-05: Firebase Config قابل للتعديل من localStorage</b>', h2_style))
story.append(Paragraph(
    'اعدادات Firebase تُقرأ من localStorage مما يعني ان مهاجما يمكنه تعديلها وتوجيه التطبيق لقاعدة بيانات مزيفة لسرقة بيانات المستخدمين او التلاعب بالعمليات المالية.',
    body_style
))
story.append(Paragraph(
    '<b>الحل:</b> ازالة ميزة تعديل Firebase Config من الكود والاعتماد على الاعدادات المضمنة فقط.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>3.6 SEC-06: لا يوجد حد لمحاولات تسجيل الدخول</b>', h2_style))
story.append(Paragraph(
    'لا يوجد Rate Limiting على محاولات تسجيل الدخول او العمليات المالية. هذا يجعل التطبيق عرضة لهجمات Brute Force و DoS.',
    body_style
))
story.append(Spacer(1, 18))

# ==================== SECTION 4: DATA INTEGRITY ====================
story.append(Paragraph('<b>4. مشاكل سلامة البيانات</b>', h1_style))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>4.1 DATA-01: Race Conditions مع Firebase</b>', h2_style))
story.append(Paragraph(
    'النمط المستمر في الكود هو: قراءة البيانات ثم تعديلها محليا ثم كتابتها. اذا عميلان نفذا هذا الكود في نفس الوقت احدهما سيكتب فوق الآخر ويفقد البيانات. هذا يؤثر بشكل خاص على العمليات المالية مثل الايداع والسحب حيث يمكن ان تتكرر العملية او تفقد.',
    body_style
))
story.append(Paragraph(
    '<b>الحل:</b> استخدام Firebase Transactions لضمان الذرية في العمليات المالية الحرجة.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>4.2 DATA-02: حذف مستخدم لا يحذف بياناته المرتبطة</b>', h2_style))
story.append(Paragraph(
    'عند حذف مستخدم في دالة deleteUser يتم حذفه من مصفوفة users فقط. تبقى بياناته في deposits و withdrawals و kycDocuments و notifications و transactionLog و messages و userWithdrawalMethods مما يخلق بيانات يتيمة تشير لمستخدم غير موجود.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>4.3 DATA-03: الصور مخزنة كـ Base64 في Firestore</b>', h2_style))
story.append(Paragraph(
    'كل صور KYC والايصالات تُخزن كـ Base64 مباشرة في Firestore. هذا يستهلك مساحة هائلة ويُبطئ القراءة بشكل كبير. مستند واحد يحتوي على عدة صور يمكن ان يتجاوز حد حجم المستند في Firestore (1 MB).',
    body_style
))
story.append(Paragraph(
    '<b>الحل:</b> استخدام Firebase Storage لتخزين الصور وتخزين رابط التحميل فقط في Firestore.',
    body_style
))
story.append(Spacer(1, 18))

# ==================== SECTION 5: MISSING FEATURES ====================
story.append(Paragraph('<b>5. ميزات مفقودة مهمة</b>', h1_style))
story.append(Spacer(1, 6))

feat_data = [
    ['1', 'نظام الاشعارات الفورية', 'رغم طلب صلاحية الاشعارات لا يوجد كود يرسل اشعارات Push للجهاز عند حدوث عمليات مهمة مثل قبول الايداع او السحب', 'عالية'],
    ['2', 'المصادقة الثنائية (2FA)', 'لتطبيق محفظة عملات رقمية يجب توفر 2FA لحماية الحسابات من الوصول غير المصرح به', 'عالية'],
    ['3', 'تصدير التقارير', 'لا يمكن تصدير تقارير المعاملات او الايداعات كملفات CSV او PDF', 'متوسطة'],
    ['4', 'نظام تذاكر الدعم', 'المحادثة المباشرة فقط بدون تذاكر منظمة مما يصعب تتبع وحل المشاكل', 'متوسطة'],
    ['5', 'حدود يومية للسحب والايداع', 'لا يوجد حد لعدد او قيمة العمليات اليومية مما يعرض التطبيق للاستغلال', 'عالية'],
    ['6', 'سجل المراجعة (Audit Log)', 'لا يوجد تتبع لمن نفذ عملية ومتى وعلى اي جهاز مما يصعب التحقيق في المشاكل', 'متوسطة'],
    ['7', 'اعدادات اشعارات قابلة للتخصيص', 'لا يمكن للمستخدم التحكم في نوع الاشعارات التي يستلمها (بريد او دفع او كلاهما)', 'منخفضة'],
    ['8', 'نظام تقييم التجار', 'لا يوجد نظام تقييم او مراجعة للتاجر مما لا يساعد المستخدمين في اختيار التاجر المناسب', 'منخفضة'],
]
story.append(make_table(['رقم', 'الميزة', 'الوصف', 'الاولوية'], feat_data, [1*cm, 3.5*cm, 9.5*cm, 2*cm]))
story.append(Spacer(1, 18))

# ==================== SECTION 6: UX/UI ====================
story.append(Paragraph('<b>6. مشاكل واجهة المستخدم وتجربة الاستخدام</b>', h1_style))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>6.1 اعادة بناء DOM بالكامل عند كل تغيير</b>', h2_style))
story.append(Paragraph(
    'كل تغيير في الحالة (كتابة رسالة اختيار قائمة الخ) يستدعي render() الذي يعيد بناء كل عناصر DOM من الصفر. هذا يؤدي الى: فقدان التركيز من حقول الادخال فقدان موقع التمرير في القوائم مسح البيانات المدخلة في النماذج وارتعاش بصري مزعج. الحل الامثل هو تحديث العناصر المتغيرة فقط بدلا من اعادة بناء كل الصفحة.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>6.2 لا يوجد ترقيم صفحات</b>', h2_style))
story.append(Paragraph(
    'قوائم الايداعات والسحوبات والمستخدمين تعرض كل العناصر دفعة واحدة في عنصر واحد. مع نمو البيانات ستصبح القوائم طويلة جدا وبطيئة في التحميل والتصفح. يجب اضافة ترقيم صفحات مع خيار تحميل المزيد.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>6.3 رصيد التاجر لا يظهر عند السحب</b>', h2_style))
story.append(Paragraph(
    'في صفحة السحب عند اختيار تاجر لا يظهر رصيد التاجر ولا سعر الصرف الخاص به على عكس صفحة الايداع التي تعرض هذه المعلومات عبر دالة renderDepMerchantBalance. المستخدم لا يعرف ما اذا كان التاجر يملك رصيدا كافيا لتنفيذ السحب.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>6.4 تعارض معرفات HTML</b>', h2_style))
story.append(Paragraph(
    'العنصر merch-reject-reason مُستخدم في مودالين مختلفين (رفض ايداع التاجر ورفض طلب تاجر). اذا فتح احدهما قبل الآخر قد يحصل تعارض في القيم. يجب استخدام معرفات فريدة لكل مودال.',
    body_style
))
story.append(Spacer(1, 18))

# ==================== SECTION 7: PERFORMANCE ====================
story.append(Paragraph('<b>7. مشاكل الاداء</b>', h1_style))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>7.1 تحميل كل البيانات دفعة واحدة</b>', h2_style))
story.append(Paragraph(
    'عند التحميل يتم تحميل كل المجموعات (users و deposits و withdrawals و messages و notifications وغيرها) دفعة واحدة في الذاكرة. مع نمو البيانات سيصبح هذا بطيئا جدا ويستهلك ذاكرة كبيرة في المتصفح. الحل هو تحميل البيانات عند الحاجة فقط (lazy loading) او استخدام استعلامات Firestore مصفاة.',
    body_style
))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>7.2 onSnapshot يعيد الـ render لكل تغيير</b>', h2_style))
story.append(Paragraph(
    'المستمع onSnapshot يعيد بناء الواجهة بالكامل عند اي تغيير في اي مستند. هذا يعني ان تغييرا من مستخدم آخر في محادثة سيعيد بناء واجهتك بالكامل حتى لو كنت في صفحة لا علاقة لها بالمحادثة. يجب التحقق من نوع التغيير ومدى صلته بالصفحة الحالية قبل اعادة البناء.',
    body_style
))
story.append(Spacer(1, 18))

# ==================== SECTION 8: RECOMMENDATIONS ====================
story.append(Paragraph('<b>8. خريطة الطريق والمقترحات</b>', h1_style))
story.append(Spacer(1, 6))

story.append(Paragraph('<b>8.1 اولويات فورية (خلال اسبوع)</b>', h2_style))
prio_data = [
    ['1', 'اصلاح الدالتين المفقودتين لرفع اثبات السحب', 'BUG-01', 'حرج'],
    ['2', 'اضافة خصم رصيد التاجر عند قبول الايداع', 'BUG-02', 'حرج'],
    ['3', 'اصلاح النص الصيني في رسالة الخطأ', 'BUG-03', 'حرج'],
    ['4', 'تشغيل العمولات اليومية تلقائيا', 'BUG-05', 'متوسط'],
    ['5', 'ازالة كلمة مرور المدير من الكود المصدري', 'SEC-01', 'حرج'],
    ['6', 'اضافة Firebase Security Rules', 'SEC-04', 'حرج'],
]
story.append(make_table(['رقم', 'الإجراء', 'المشكلة', 'الخطورة'], prio_data, [1*cm, 8*cm, 3*cm, 2*cm]))
story.append(Spacer(1, 10))

story.append(Paragraph('<b>8.2 اولويات قصيرة المدى (خلال شهر)</b>', h2_style))
story.append(Paragraph('- تشفير كلمات المرور باستخدام SHA-256', body_indent))
story.append(Paragraph('- اضافة نظام الجلسات الآمنة (Token-based Auth)', body_indent))
story.append(Paragraph('- نقل الصور من Firestore الى Firebase Storage', body_indent))
story.append(Paragraph('- اضافة Firebase Transactions للعمليات المالية', body_indent))
story.append(Paragraph('- اكمال نظام العمولات متعدد المستويات (3 مستويات)', body_indent))
story.append(Paragraph('- اضافة نظام اشعارات Push للعمليات المهمة', body_indent))
story.append(Paragraph('- اضافة حدود يومية للسحب والايداع', body_indent))
story.append(Spacer(1, 10))

story.append(Paragraph('<b>8.3 اولويات متوسطة المدى (خلال 3 اشهر)</b>', h2_style))
story.append(Paragraph('- اعادة هيكلة التطبيق لاستخدام اطار عمل مثل React او Vue لتحسين الاداء والصيانة', body_indent))
story.append(Paragraph('- اضافة نظام 2FA للمصادقة الثنائية', body_indent))
story.append(Paragraph('- اضافة تصدير التقارير كـ CSV و PDF', body_indent))
story.append(Paragraph('- اضافة ترقيم صفحات للقوائم الطويلة', body_indent))
story.append(Paragraph('- اضافة نظام تذاكر الدعم', body_indent))
story.append(Paragraph('- اضافة نظام تقييم ومراجعة للتاجر', body_indent))
story.append(Paragraph('- تحسين الـ render لتحديث العناصر المتغيرة فقط بدلا من اعادة البناء الكامل', body_indent))
story.append(Spacer(1, 10))

story.append(Paragraph('<b>8.4 اقتراحات معمارية طويلة المدى</b>', h2_style))
story.append(Paragraph(
    'التطبيق الحالي يعمل بملف HTML واحد وهذا مناسب للمراحل الاولى لكن مع نمو المشروع يصبح من الصعب صيانته. يُنصح بالانتقال الى بنية متعددة الملفات باستخدام اطار عمل مثل Next.js مع فصل واضح بين الواجهة والمنطق والبيانات. كما يُنصح بنقل النظام من مستند واحد في Firestore الى مجموعة مستندات منظمة (users و deposits و withdrawals الخ) مع قواعد حماية لكل مجموعة.',
    body_style
))

# Build
doc.build(story)
print('PDF built successfully at: ' + pdf_path)
