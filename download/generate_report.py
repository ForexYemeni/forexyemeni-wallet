# -*- coding: utf-8 -*-
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Paragraph, Spacer, PageBreak, Table, TableStyle, 
    KeepTogether, Image as RLImage
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import SimpleDocTemplate

# ========== FONT REGISTRATION ==========
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))

registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ========== COLOR SCHEME ==========
TABLE_HEADER_COLOR = colors.HexColor('#1F4E79')
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = colors.HexColor('#F5F5F5')
ACCENT_COLOR = colors.HexColor('#F0B90B')
DANGER_COLOR = colors.HexColor('#F6465D')
WARNING_COLOR = colors.HexColor('#F59E0B')
SUCCESS_COLOR = colors.HexColor('#0ECB81')
DARK_BG = colors.HexColor('#0B0E11')
CRITICAL_RED = colors.HexColor('#DC2626')

# ========== STYLES ==========
cover_title_style = ParagraphStyle(
    name='CoverTitle',
    fontName='SimHei',
    fontSize=32,
    leading=44,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#1F4E79'),
    spaceAfter=12,
    wordWrap='CJK'
)

cover_subtitle_style = ParagraphStyle(
    name='CoverSubtitle',
    fontName='SimHei',
    fontSize=16,
    leading=24,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#555555'),
    spaceAfter=12,
    wordWrap='CJK'
)

cover_info_style = ParagraphStyle(
    name='CoverInfo',
    fontName='SimHei',
    fontSize=12,
    leading=20,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#777777'),
    spaceAfter=8,
    wordWrap='CJK'
)

h1_style = ParagraphStyle(
    name='H1Style',
    fontName='SimHei',
    fontSize=18,
    leading=28,
    textColor=colors.HexColor('#1F4E79'),
    spaceBefore=18,
    spaceAfter=10,
    wordWrap='CJK'
)

h2_style = ParagraphStyle(
    name='H2Style',
    fontName='SimHei',
    fontSize=14,
    leading=22,
    textColor=colors.HexColor('#2C5F8A'),
    spaceBefore=12,
    spaceAfter=8,
    wordWrap='CJK'
)

h3_style = ParagraphStyle(
    name='H3Style',
    fontName='SimHei',
    fontSize=12,
    leading=18,
    textColor=colors.HexColor('#34495E'),
    spaceBefore=8,
    spaceAfter=6,
    wordWrap='CJK'
)

body_style = ParagraphStyle(
    name='BodyStyle',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#333333'),
    spaceAfter=6,
    wordWrap='CJK'
)

body_indent_style = ParagraphStyle(
    name='BodyIndentStyle',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#333333'),
    leftIndent=20,
    spaceAfter=4,
    wordWrap='CJK'
)

bullet_style = ParagraphStyle(
    name='BulletStyle',
    fontName='SimHei',
    fontSize=10,
    leading=16,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#333333'),
    leftIndent=24,
    firstLineIndent=-12,
    spaceAfter=3,
    wordWrap='CJK'
)

danger_style = ParagraphStyle(
    name='DangerStyle',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=CRITICAL_RED,
    leftIndent=20,
    spaceAfter=4,
    wordWrap='CJK'
)

warning_style = ParagraphStyle(
    name='WarningStyle',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#B45309'),
    leftIndent=20,
    spaceAfter=4,
    wordWrap='CJK'
)

code_style = ParagraphStyle(
    name='CodeStyle',
    fontName='SarasaMonoSC',
    fontSize=8.5,
    leading=13,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#D63384'),
    backColor=colors.HexColor('#F8F9FA'),
    leftIndent=20,
    rightIndent=10,
    spaceBefore=4,
    spaceAfter=4,
    borderWidth=0.5,
    borderColor=colors.HexColor('#DEE2E6'),
    borderPadding=6,
    wordWrap='CJK'
)

tbl_header_style = ParagraphStyle(
    name='TblHeader',
    fontName='SimHei',
    fontSize=10,
    leading=14,
    alignment=TA_CENTER,
    textColor=colors.white,
    wordWrap='CJK'
)

tbl_cell_style = ParagraphStyle(
    name='TblCell',
    fontName='SimHei',
    fontSize=9,
    leading=13,
    alignment=TA_CENTER,
    textColor=colors.black,
    wordWrap='CJK'
)

tbl_cell_left = ParagraphStyle(
    name='TblCellLeft',
    fontName='SimHei',
    fontSize=9,
    leading=13,
    alignment=TA_LEFT,
    textColor=colors.black,
    wordWrap='CJK'
)

tbl_cell_left_en = ParagraphStyle(
    name='TblCellLeftEn',
    fontName='Times New Roman',
    fontSize=8.5,
    leading=12,
    alignment=TA_LEFT,
    textColor=colors.black,
    wordWrap='CJK'
)

caption_style = ParagraphStyle(
    name='CaptionStyle',
    fontName='SimHei',
    fontSize=9,
    leading=14,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#666666'),
    spaceAfter=6,
    wordWrap='CJK'
)

# ========== TOC TEMPLATE ==========
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            self.notify('TOCEntry', (level, text, self.page))

def add_heading(text, style, level=0):
    p = Paragraph(text, style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    return p

def make_table(data, col_widths, has_header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if has_header else 0)
    style_cmds = [
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    if has_header:
        style_cmds.append(('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR))
        style_cmds.append(('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT))
        for i in range(1, len(data)):
            bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def danger_table_style(base_cmds, row_count):
    cmds = list(base_cmds)
    for i in range(1, row_count):
        cmds.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FFF5F5' if i % 2 == 1 else '#FFEBEB')))
    return TableStyle(cmds)

# ========== BUILD DOCUMENT ==========
output_path = '/home/z/my-project/download/forexyemeni_wallet_security_report.pdf'
doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    topMargin=2*cm,
    bottomMargin=2*cm,
    leftMargin=2*cm,
    rightMargin=2*cm,
    title='forexyemeni_wallet_security_report',
    author='Z.ai',
    creator='Z.ai',
    subject='ForexYemeni Wallet Security Analysis Report'
)

story = []

# ==================== COVER PAGE ====================
story.append(Spacer(1, 80))

# Title box
cover_title_data = [[Paragraph('<b><font name="Times New Roman">ForexYemeni Wallet</font></b>', ParagraphStyle(
    name='CoverEng', fontName='Times New Roman', fontSize=28, leading=36, alignment=TA_CENTER, textColor=colors.HexColor('#1F4E79')
))]]
cover_title_table = Table(cover_title_data, colWidths=[doc.width])
cover_title_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0F4FF')),
    ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#1F4E79')),
    ('TOPPADDING', (0, 0), (-1, -1), 16),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 16),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
]))
story.append(cover_title_table)
story.append(Spacer(1, 30))

story.append(Paragraph('<b>تقرير تحليل أمني شامل</b>', cover_title_style))
story.append(Spacer(1, 16))
story.append(Paragraph('دراسة كاملة لالثغرات الأمنية ومتطلبات الحماية', cover_subtitle_style))
story.append(Paragraph('لتحقيق أقصى درجات الأمان مجانا بالكامل', cover_subtitle_style))
story.append(Spacer(1, 48))

info_data = [
    [Paragraph('<b>الإصدار:</b>', cover_info_style), Paragraph('<font name="Times New Roman">v15.3</font>', ParagraphStyle(name='cv1', fontName='Times New Roman', fontSize=12, alignment=TA_LEFT, textColor=colors.HexColor('#333333')))],
    [Paragraph('<b>نوع التطبيق:</b>', cover_info_style), Paragraph('محفظة عملات رقمية - <font name="Times New Roman">PWA</font>', ParagraphStyle(name='cv2', fontName='SimHei', fontSize=12, alignment=TA_LEFT, textColor=colors.HexColor('#333333')))],
    [Paragraph('<b>التقنيات:</b>', cover_info_style), Paragraph('<font name="Times New Roman">Firebase + Vercel + HTML/JS</font>', ParagraphStyle(name='cv3', fontName='Times New Roman', fontSize=12, alignment=TA_LEFT, textColor=colors.HexColor('#333333')))],
    [Paragraph('<b>تاريخ التقرير:</b>', cover_info_style), Paragraph('3 أبريل 2026', cover_info_style)],
    [Paragraph('<b>مستوى الخطورة:</b>', cover_info_style), Paragraph('<b><font color="#DC2626">حرج جدا - يتطلب إصلاح فوري</font></b>', ParagraphStyle(name='cv4', fontName='SimHei', fontSize=12, alignment=TA_LEFT, textColor=CRITICAL_RED))],
]
info_table = Table(info_data, colWidths=[4*cm, 12*cm])
info_table.setStyle(TableStyle([
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DEE2E6')),
    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F8F9FA')),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
]))
story.append(info_table)

story.append(PageBreak())

# ==================== TABLE OF CONTENTS ====================
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle(name='TOC1', fontName='SimHei', fontSize=12, leading=20, leftIndent=20, spaceBefore=6),
    ParagraphStyle(name='TOC2', fontName='SimHei', fontSize=10, leading=16, leftIndent=40, spaceBefore=3),
]
story.append(Paragraph('<b>فهرس المحتويات</b>', ParagraphStyle(name='TOCTitle', fontName='SimHei', fontSize=18, leading=28, alignment=TA_CENTER, textColor=colors.HexColor('#1F4E79'), spaceAfter=18)))
story.append(Spacer(1, 12))
story.append(toc)
story.append(PageBreak())

# ==================== SECTION 1: APP OVERVIEW ====================
story.append(add_heading('<b>1. نظرة عامة على التطبيق</b>', h1_style, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>1.1 وصف التطبيق</b>', h2_style, 1))
story.append(Paragraph(
    'تطبيق <font name="Times New Roman">ForexYemeni Wallet</font> هو محفظة عملات رقمية موجهة بشكل أساسي للسوق اليمني، '
    'يعمل كتطبيق ويب تقدمي يمكن تثبيته على الهواتف المحمولة كأنه تطبيق أصلي. '
    'يتيح التطبيق للمستخدمين إيداع وسحب العملات الرقمية وخاصة عملة <font name="Times New Roman">USDT</font> عبر شبكة <font name="Times New Roman">TRC20</font>، '
    'كما يدعم التحويلات البنكية المحلية عبر بنك اليمن والكويت. يتميز التطبيق بواجهة عربية بالكامل مع دعم الوضع الداكن والفاتح، '
    'ويوفر نظام صرف عملات بين الدولار الأمريكي والريال اليمني والريال السعودي.',
    body_style
))
story.append(Paragraph(
    'يبني التطبيق بنية عميل-خادم حيث يتم تنفيذ كل المنطق البرمجي في ملف <font name="Times New Roman">HTML</font> واحد بحجم يقارب <font name="Times New Roman">841</font> كيلوبايت '
    '(أكثر من <font name="Times New Roman">9800</font> سطر برمجي يحتوي على <font name="Times New Roman">359</font> دالة). '
    'يعتمد على قاعدة بيانات <font name="Times New Roman">Firebase Firestore</font> كمخزن رئيسي للبيانات، '
    'ويستضيف وظائف الخادم عبر <font name="Times New Roman">Vercel Serverless Functions</font> لإرسال رسائل البريد الإلكتروني وإشعارات الدفع والتحقق من معاملات البلوكتشين.',
    body_style
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>1.2 البنية التقنية</b>', h2_style, 1))

tech_data = [
    [Paragraph('<b>المكون</b>', tbl_header_style), Paragraph('<b>التقنية</b>', tbl_header_style), Paragraph('<b>الغرض</b>', tbl_header_style)],
    [Paragraph('الواجهة الأمامية', tbl_cell_style), Paragraph('<font name="Times New Roman">HTML/CSS/JavaScript</font>', tbl_cell_style), Paragraph('تطبيق صفحة واحدة بالكامل', tbl_cell_left)],
    [Paragraph('إطار التصميم', tbl_cell_style), Paragraph('<font name="Times New Roman">TailwindCSS (CDN)</font>', tbl_cell_style), Paragraph('تنسيق الواجهة والتصميم المتجاوب', tbl_cell_left)],
    [Paragraph('قاعدة البيانات', tbl_cell_style), Paragraph('<font name="Times New Roman">Firebase Firestore</font>', tbl_cell_style), Paragraph('تخزين المستخدمين والمعاملات والإعدادات', tbl_cell_left)],
    [Paragraph('الاستضافة', tbl_cell_style), Paragraph('<font name="Times New Roman">Vercel</font>', tbl_cell_style), Paragraph('استضافة الملفات والوظائف الخادمية', tbl_cell_left)],
    [Paragraph('إرسال البريد', tbl_cell_style), Paragraph('<font name="Times New Roman">Nodemailer + Gmail SMTP</font>', tbl_cell_style), Paragraph('إرسال رموز التحقق والإشعارات', tbl_cell_left)],
    [Paragraph('إرسال الرسائل', tbl_cell_style), Paragraph('<font name="Times New Roman">Vonage + Gmail</font>', tbl_cell_style), Paragraph('إرسال رموز التحقق عبر الرسائل', tbl_cell_left)],
    [Paragraph('الإشعارات', tbl_cell_style), Paragraph('<font name="Times New Roman">Firebase FCM</font>', tbl_cell_style), Paragraph('إشعارات الدفع للهواتف', tbl_cell_left)],
    [Paragraph('تحقق البلوكتشين', tbl_cell_style), Paragraph('<font name="Times New Roman">TronGrid API</font>', tbl_cell_style), Paragraph('التحقق من معاملات الايداع والسحب', tbl_cell_left)],
    [Paragraph('المكتبات الأخرى', tbl_cell_style), Paragraph('<font name="Times New Roman">Chart.js, jsPDF, SheetJS</font>', tbl_cell_style), Paragraph('الرسوم البيانية وتقارير البى دى', tbl_cell_left)],
]
story.append(Spacer(1, 8))
story.append(make_table(tech_data, [3.2*cm, 4.8*cm, 8.5*cm]))
story.append(Spacer(1, 4))
story.append(Paragraph('جدول 1: البنية التقنية لتطبيق <font name="Times New Roman">ForexYemeni Wallet</font>', caption_style))

story.append(Spacer(1, 12))
story.append(add_heading('<b>1.3 الميزات الأساسية</b>', h2_style, 1))
story.append(Paragraph(
    'يقدم التطبيق مجموعة واسعة من الميزات التي تغطي العمليات المالية الأساسية لنظام محفظة عملات رقمية متكامل، '
    'وتشمل هذه الميزات ثلاثة أنواع من المستخدمين (مدير، تاجر، مستخدم عادي) مع صلاحيات مختلفة لكل نوع. '
    'فيما يلي قائمة بأبرز الميزات المتوفرة في التطبيق:',
    body_style
))

features = [
    ('نظام تسجيل الدخول والتسجيل', 'باستخدام رقم الهاتف وكلمة المرور مع تحقق بخطوتين عبر البريد والرسائل'),
    ('لوحة تحكم المدير', 'إدارة المستخدمين والمعاملات والإعدادات واعتماد طلبات السحب والإيداع'),
    ('نظام الإيداع والسحب', 'دعم عملة <font name="Times New Roman">USDT TRC20</font> والتحويلات البنكية المحلية'),
    ('نظام صرف العملات', 'تحويل تلقائي بين <font name="Times New Roman">USDT</font> والريال اليمني والريال السعودي'),
    ('نظام التسويق بالعمولة', 'ثلاث مستويات من العمولات مع تتبع الإحالات'),
    ('نظام التجار', 'تسجيل التجار ومعاملاتهم الخاصة وعمولاتهم'),
    ('نظام المراسلة', 'محادثة مباشرة بين المستخدمين والإدارة والتجار'),
    ('التحقق من الهوية', 'رفع وتوثيق صور الهوية الشخصية'),
    ('الإشعارات الفورية', 'إشعارات دفع عبر <font name="Times New Roman">FCM</font> تعمل حتى عند إغلاق التطبيق'),
    ('تقارير وتصدير', 'تصدير التقارير بصيغة <font name="Times New Roman">PDF</font> وملفات <font name="Times New Roman">Excel</font>'),
]
for title, desc in features:
    story.append(Paragraph('- <b>' + title + ':</b> ' + desc, bullet_style))

# ==================== SECTION 2: SECURITY ANALYSIS ====================
story.append(Spacer(1, 18))
story.append(add_heading('<b>2. التحليل الأمني - الثغرات الحرجة</b>', h1_style, 0))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'بعد تحليل شامل ومتعمق للكود المصدري للتطبيق، تم رصد عدد كبير جدا من الثغرات الأمنية الخطيرة '
    'التي تجعل التطبيق حاليا عرضة للاختراق بسهولة تامة. تتراوح هذه الثغرات بين ثغرات حرجة تؤثر على '
    'حماية البيانات المالية وثغرات متوسطة تؤثر على تجربة المستخدم. يوضح هذا القسم كل ثغرة بالتفصيل '
    'مع توضيح مدى خطورتها وكيفية استغلالها من قبل المهاجمين.',
    body_style
))

# --- VULNERABILITY 1: OPEN FIREBASE RULES ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.1 الثغرة الأشد خطورة: قواعد الحماية مفتوحة بالكامل</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#DC2626">مستوى الخطورة: حرج جدا - خطير للغاية</font></b>',
    danger_style
))
story.append(Paragraph(
    'تعتبر هذه الثغرة الأخطر على الإطلاق في التطبيق. قواعد حماية قاعدة بيانات <font name="Times New Roman">Firebase Firestore</font> '
    'مفتوحة بالكامل مما يعني أن أي شخص يمكنه القراءة والكتابة في جميع المجموعات البيانية دون أي قيد أو شرط. '
    'تم التحقق من ملف <font name="Times New Roman">firestore.rules</font> وتبين أن جميع الصلاحيات مضبوطة على السماح المطلق '
    'للقراءة والكتابة لكل من المستخدمين والإيداعات والسحوبات والإعدادات وجميع البيانات الأخرى.',
    body_style
))
story.append(Paragraph(
    'ما يعنيه هذا عمليا هو أن أي شخص يعرف معرف مشروع <font name="Times New Roman">Firebase</font> (وهو مكشوف في الكود) '
    'يمكنه الوصول إلى جميع بيانات المستخدمين بما في ذلك أرصدة الحسابات وأرقام الهواتف والعناوين وكلمات المرور المجزأة '
    'وسجل المعاملات المالية الكاملة. كما يمكنه تعديل أي بيانات بما في ذلك زيادة أرصدة المستخدمين أو تعديل حالة المعاملات أو حذف سجلات كاملة.',
    body_style
))

story.append(Paragraph('<b>الملف المصاب: <font name="Times New Roman">firestore.rules</font></b>', code_style))
story.append(Paragraph(
    'allow read: if true;  // القراءة مفتوحة للجميع<br/>'
    'allow write: if true; // الكتابة مفتوحة للجميع',
    code_style
))
story.append(Paragraph(
    'باستخدام أدوات مثل <font name="Times New Roman">Firebase CLI</font> أو حتى مكتبة <font name="Times New Roman">firebase-admin</font> في <font name="Times New Roman">Node.js</font>، '
    'يمكن لأي مهاجم الاتصال مباشرة بقاعدة البيانات وتنفيذ أي عملية يريدها. هذا يعني أن جميع إجراءات الحماية الموجودة '
    'في واجهة المستخدم لا فائدة منها لأن المهاجم يمكنه تجاوزها بالكامل والتعامل مع قاعدة البيانات مباشرة.',
    body_style
))

# --- VULNERABILITY 2: HARDCODED CREDENTIALS ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.2 بيانات الدخول مكشوفة في الكود المصدري</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#DC2626">مستوى الخطورة: حرج</font></b>',
    danger_style
))
story.append(Paragraph(
    'تم اكتشاف عدة بيانات دخول حساسة مكتوبة مباشرة في الكود المصدري للتطبيق ويمكن لأي مستخدم عرضها بسهولة '
    'عبر أدوات المطور في المتصفح. هذه الثغرة خطيرة جدا لأنها تكشف أدوات التحكم الأساسية في التطبيق. '
    'فيما يلي جدول يوضح جميع البيانات المكشوفة:',
    body_style
))

cred_data = [
    [Paragraph('<b>البيان المكشوف</b>', tbl_header_style), Paragraph('<b>القيمة</b>', tbl_header_style), Paragraph('<b>الموقع</b>', tbl_header_style), Paragraph('<b>الأثر</b>', tbl_header_style)],
    [Paragraph('كلمة مرور المدير الافتراضية', tbl_cell_left), Paragraph('<font name="Times New Roman">admin123</font>', tbl_cell_style), Paragraph('سطر 2229', tbl_cell_style), Paragraph('دخول كامل بصفة مدير', tbl_cell_left)],
    [Paragraph('رقم هاتف المدير', tbl_cell_left), Paragraph('<font name="Times New Roman">+967773178684</font>', tbl_cell_style), Paragraph('سطر 2228', tbl_cell_style), Paragraph('الوصول لحساب المدير', tbl_cell_left)],
    [Paragraph('كلمة مرور الاستعادة', tbl_cell_left), Paragraph('<font name="Times New Roman">admin123admin123</font>', tbl_cell_style), Paragraph('سطر 2231', tbl_cell_style), Paragraph('إعادة تعيين كلمة المدير', tbl_cell_left)],
    [Paragraph('بريد Gmail وكلمة المرور', tbl_cell_left), Paragraph('كلمة مرور التطبيق', tbl_cell_style), Paragraph('ملفات الوظائف', tbl_cell_style), Paragraph('إرسال بريد مزيف بأسم التطبيق', tbl_cell_left)],
    [Paragraph('مفتاح واجهة <font name="Times New Roman">Firebase</font>', tbl_cell_left), Paragraph('<font name="Times New Roman">AIzaSyD...</font>', tbl_cell_style), Paragraph('سطر 246', tbl_cell_style), Paragraph('الوصول لقاعدة البيانات', tbl_cell_left)],
    [Paragraph('مفتاح إشعارات الدفع', tbl_cell_left), Paragraph('<font name="Times New Roman">VAPID</font> Key', tbl_cell_style), Paragraph('سطر 852', tbl_cell_style), Paragraph('إرسال إشعارات مزيفة', tbl_cell_left)],
]
story.append(Spacer(1, 8))
cred_table = Table(cred_data, colWidths=[3.5*cm, 4*cm, 2.5*cm, 6.5*cm])
cred_style_cmds = [
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
    ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
]
for i in range(1, len(cred_data)):
    cred_style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FFF5F5' if i % 2 == 1 else '#FFEBEB')))
cred_table.setStyle(TableStyle(cred_style_cmds))
story.append(cred_table)
story.append(Spacer(1, 4))
story.append(Paragraph('جدول 2: البيانات الحساسة المكشوفة في الكود المصدري', caption_style))

# --- VULNERABILITY 3: CLIENT-SIDE LOGIC ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.3 كل المنطق البرمجي في جانب العميل</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#DC2626">مستوى الخطورة: حرج</font></b>',
    danger_style
))
story.append(Paragraph(
    'المشكلة الأكثر هيكلية في التطبيق هي أن جميع العمليات الحساسة تتم في كود <font name="Times New Roman">JavaScript</font> '
    'الذي يعمل في متصفح المستخدم. هذا يشمل عمليات التحقق من كلمات المرور ومقارنة رموز التحقق '
    'وتعديل الأرصدة وإنشاء المعاملات المالية وتغيير أدوار المستخدمين. يمكن لأي شخص مطلع على أدوات المطور '
    'في المتصفح تعديل هذا الكود أثناء التشغيل وتغيير سلوك التطبيق بالكامل.',
    body_style
))
story.append(Paragraph(
    'على سبيل المثال، عملية التحقق من رمز البريد الإلكتروني تتم بمقارنة بسيطة في الكود: '
    'يتم توليد الرمز وتخزينه في متغير محلي في المتصفح ثم مقارنته بإدخال المستخدم. '
    'يمكن للمهاجم ببساطة قراءة قيمة هذا المتغير من وحدة التحكم أو تعديل دالة التحقق لتعيد دائما القيمة الصحيحة. '
    'نفس الأمر ينطبق على التحقق من رقم الهاتف عبر الرسائل القصيرة. '
    'كما أن جميع عمليات تعديل الأرصدة تتم مباشرة في الكود دون أي تحقق من الخادم مما يعني أن المهاجم '
    'يمكنه ببساطة استدعاء دوال زيادة الرصيد مباشرة من وحدة التحكم.',
    body_style
))

# --- VULNERABILITY 4: PASSWORD HASHING ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.4 تجزئة كلمات المرور بدون ملح</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#DC2626">مستوى الخطورة: حرج</font></b>',
    danger_style
))
story.append(Paragraph(
    'يستخدم التطبيق خوارزمية <font name="Times New Roman">SHA-256</font> لتجزئة كلمات المرور لكنه لا يستخدم أي ملح '
    'أي قيمة عشوائية تضاف لكلمة المرور قبل تجزئتها. هذا يعني أن نفس كلمة المرور ستعطي دائما نفس التجزئة، '
    'مما يجعل من السهل جدا مهاجمة التجزئات باستخدام جداول القوس المسبقة الإعداد أو الهجمات بالقوة الغاشمة. '
    'الأفضل استخدام خوارزميات متخصصة مثل <font name="Times New Roman">bcrypt</font> أو <font name="Times New Roman">Argon2</font> '
    'التي تضمن ملحا فريدا لكل كلمة مرور وتوفر عامل عمل قابل للتعديل.',
    body_style
))
story.append(Paragraph(
    'إضافة إلى ذلك، فإن خوارزمية التجزئة مكتوبة يدويا في كود <font name="Times New Roman">JavaScript</font> '
    'بدلا من استخدام مكتبات مجربة وموثوقة. هذا يزيد من احتمال وجود أخطاء في التنفيذ قد تؤدي إلى ثغرات أمنية إضافية. '
    'كما أن تخزين تجزئة كلمة المرور الافتراضية للمدير في الكود يعني أن أي شخص يمكنه استنتاج تجزئة أي كلمة مرور '
    'والمقارنة معها لمعرفة كلمة المرور الأصلية.',
    body_style
))

# --- VULNERABILITY 5: SESSION MANAGEMENT ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.5 إدارة الجلسات غير آمنة</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#DC2626">مستوى الخطورة: عالي</font></b>',
    warning_style
))
story.append(Paragraph(
    'يتم تخزين معرف الجلسة في التخزين المحلي للمتصفح (<font name="Times New Roman">localStorage</font>) '
    'وهو مكان غير مشفر يمكن قراءته وتعديله بسهولة. لا توجد آليات لتشفير معرف الجلسة أو التحقق من سلامته '
    'أو انتهاء صلاحيته تلقائيا بعد فترة من عدم النشاط. علاوة على ذلك، حساب المدير معفي من قيود الجلسة الفردية '
    'مما يعني أنه يمكن استخدامه من عدة أجهزة في نفس الوقت دون أي تحذير، وهو ما يزيد من سطح الهجوم المحتمل.',
    body_style
))
story.append(Paragraph(
    'كما أن بيانات المستخدم المسجل الدخول يتم حفظها أيضا في التخزين المحلي دون تشفير، '
    'مما يعني أن أي كود خبيث يعمل في المتصفح يمكنه قراءة هذه البيانات بما في ذلك معرف المستخدم ودوره وصلاته.',
    body_style
))

# --- VULNERABILITY 6: ADMIN BRUTE FORCE ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.6 حساب المدير معفي من الحماية ضد التخمين</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#DC2626">مستوى الخطورة: عالي</font></b>',
    warning_style
))
story.append(Paragraph(
    'يحتوي التطبيق على آلية حماية ضد هجمات التخمين تحد من عدد محاولات تسجيل الدخول الفاشلة إلى 5 محاولات '
    'ثم تقفل الحساب لمدة 15 دقيقة. لكن هذه الحماية معطلة تماما لحساب المدير، حيث يتم التحقق أولا من رقم الهاتف '
    'وإذا كان مطابقا لرقم المدير يتم تجاوز فحص التخمين بالكامل. بالنظر إلى أن رقم هاتف المدير مكشوف في الكود '
    'وكلمة المرور الافتراضية معروفة، فإن هذا يجعل حساب المدير هدفا سهلا للغاية.',
    body_style
))
story.append(Paragraph(
    'في الكود البرمجي يوجد شرط صريح يعفي المدير من فحص التخمين: '
    'إذا كان رقم الهاتف مطابقا لرقم المدير يتم إرجاع السماح دائما مع 5 محاولات متبقية بغض النظر عن عدد المحاولات الفاشلة السابقة. '
    'هذا يعني أن المهاجم يمكنه تجربة آلاف كلمات المرور على حساب المدير دون أي تقييد.',
    body_style
))

# --- VULNERABILITY 7: XSS ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.7 ثغرات البرمجة عبر المواقع</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#B45309">مستوى الخطورة: عالي</font></b>',
    warning_style
))
story.append(Paragraph(
    'يستخدم التطبيق دالة هروب بسيطة من أكواد <font name="Times New Roman">HTML</font> لتطهير المدخلات قبل عرضها، '
    'لكن هذه الدالة لا تغطي جميع حالات الهجوم المحتملة. التطبيق يعرض محتوى المستخدمين (أسماء ورسائل وإشعارات) '
    'مباشرة في واجهة المستخدم عبر خاصية <font name="Times New Roman">innerHTML</font> مما يفتح الباب لهجمات البرمجة عبر المواقع. '
    'يمكن لمستخدم خبيث إدخال كود خبيث في اسمه أو رسائله وسيتم تنفيذه في متصفحات جميع المستخدمين الذين يعرضون هذا المحتوى.',
    body_style
))
story.append(Paragraph(
    'الأخطار الناتجة عن هذه الثغرة تشمل سرقة معرفات الجلسات وتحويل المستخدمين إلى مواقع خبيثة وعرض محتوى مزيف '
    'وتنفيذ عمليات غير مصرح نيابة عن المستخدم الضحية. في تطبيق مالي هذا يعني إمكانية سرقة الأموال أو التلاعب بالمعاملات.',
    body_style
))

# --- VULNERABILITY 8: CORS & API ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>2.8 مشاكل في واجهات البرمجة والأمان عبر النطاقات</b>', h2_style, 1))
story.append(Paragraph(
    '<b><font color="#B45309">مستوى الخطورة: متوسط إلى عالي</font></b>',
    warning_style
))
story.append(Paragraph(
    'وظيفة إرسال الإشعارات تسمح بالوصول من جميع النطاقات عبر ترويسة '
    '<font name="Times New Roman">Access-Control-Allow-Origin: *</font> مما يعني أن أي موقع ويب يمكنه إرسال إشعارات '
    'للمستخدمين باسم التطبيق. كما لا تحتوي الوظائف الخادمية على أي تحقق من الهوية أو تقييد للمعدل '
    'مما يسمح بإساءة الاستخدام عبر إرسال عدد كبير جدا من الطلبات. عدم وجود ترويسات أمان مثل '
    '<font name="Times New Roman">Content-Security-Policy</font> و<font name="Times New Roman">X-Frame-Options</font> '
    'يعرض التطبيق لهجمات النقر المختطف والتحميل من إطارات خارجية.',
    body_style
))

# ==================== SECTION 3: FREE SECURITY SOLUTIONS ====================
story.append(Spacer(1, 24))
story.append(add_heading('<b>3. خطة الحماية الشاملة مجانا بالكامل</b>', h1_style, 0))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'فيما يلي خطة تفصيلية لسد جميع الثغرات الأمنية المكتشفة باستخدام أدوات وخدمات مجانية بالكامل. '
    'تم ترتيب الحلول حسب الأولوية مع تحديد الأداة المجانية المناسبة لكل ثغرة. '
    'جميع الخدمات المذكورة لديها خطط مجانية سخية كافية لتطبيق بحجم هذا المشروع.',
    body_style
))

# --- FIX 1: FIREBASE RULES ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.1 إصلاح قواعد الحماية لقاعدة البيانات (الأولوية القصوى)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: قواعد <font name="Times New Roman">Firebase Security Rules</font></font></b>',
    body_indent_style
))
story.append(Paragraph(
    'أول وأهم خطوة هي تقييد الوصول لقاعدة البيانات عبر قواعد الحماية. خدمة <font name="Times New Roman">Firebase Security Rules</font> '
    'مجانية تماما وتأتي مع جميع خطط <font name="Times New Roman">Firebase</font>. يجب تعديل ملف <font name="Times New Roman">firestore.rules</font> '
    'ليسمح فقط بالعمليات المصادق عليها. القاعدة الأساسية هي أن جميع عمليات الكتابة يجب أن تتم من خلال واجهات برمجة '
    'الخادم فقط بينما القراءة تسمح فقط للمستخدمين المصادق عليهم بقراءة بياناتهم الخاصة.',
    body_style
))

story.append(Paragraph(
    '<b>القواعد المطلوبة:</b> يجب أن تضمن أن المستخدم العادي لا يمكنه إلا قراءة بياناته الخاصة وكتابة الحقول المسموح له بها، '
    'وأن عمليات تعديل الأرصدة والمعاملات المالية تتم فقط عبر وظائف الخادم التي تتحقق من صلاحية المستخدم. '
    'يجب منع الوصول المجهول بالكامل وتقييد عمليات الحذف على المدير فقط. يمكن نشر هذه القواعد مجانا عبر '
    'واجهة سطر أوامر <font name="Times New Roman">Firebase</font> باستخدام الأمر <font name="Times New Roman">firebase deploy --only firestore:rules</font>.',
    body_style
))

# --- FIX 2: CLOUD FUNCTIONS ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.2 نقل المنطق الحساس إلى وظائف السحابة (الأولوية القصوى)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: <font name="Times New Roman">Firebase Cloud Functions</font> (خطة سبارك المجانية)</font></b>',
    body_indent_style
))
story.append(Paragraph(
    'يجب نقل جميع العمليات الحساسة من كود المتصفح إلى وظائف تعمل على الخادم. خدمة '
    '<font name="Times New Roman">Firebase Cloud Functions</font> توفر خطة مجانية (سبارك) تشمل مليوني استدعاء شهريا '
    'و400 ألف ثانية من وقت الحوسبة وهو أكثر من كاف لتطبيق بحجم هذا المشروع. '
    'العمليات التي يجب نقلها تشمل:',
    body_style
))

ops = [
    'التحقق من كلمات المرور ومقارنة رموز التحقق (يجب أن تتم على الخادم فقط)',
    'تعديل الأرصدة المالية (يجب أن يتم عبر وظيفة خادم تتحقق من الصلاحيات)',
    'إنشاء المعاملات المالية وتغيير حالاتها (يجب أن يتحقق الخادم من صحة العملية)',
    'تغيير أدوار المستخدمين وحظر الحسابات (مقتصر على المدير عبر الخادم)',
    'التحقق من معاملات البلوكتشين بالكامل (ينتقل حاليا من واجهة المستخدم)',
    'تسجيل الدخول وإنشاء الجلسات (مع تحقق الخادم من صلاحيات المستخدم)',
]
for op in ops:
    story.append(Paragraph('- ' + op, bullet_style))

# --- FIX 3: FIREBASE AUTH ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.3 استخدام مصادقة فايربيز الرسمية (الأولوية العالية)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: <font name="Times New Roman">Firebase Authentication</font></font></b>',
    body_indent_style
))
story.append(Paragraph(
    'بدلا من نظام المصادقة المخصص الحالي الذي يحفظ كلمات المرور المجزأة في قاعدة البيانات، '
    'يجب استخدام خدمة <font name="Times New Roman">Firebase Authentication</font> المجانية بالكامل. '
    'هذه الخدمة تدعم المصادقة عبر رقم الهاتف مع إرسال رسالة التحقق تلقائيا، '
    'وكذلك المصادقة عبر البريد الإلكتروني مع رابط التحقق. توفر الخدمة حماية مدمجة ضد التخمين '
    'وإدارة الجلسات الآمنة مع رموز مميزة مشفرة وتحديث تلقائي للصلاحيات.',
    body_style
))
story.append(Paragraph(
    'ميزة إضافية هي أن <font name="Times New Roman">Firebase Auth</font> يوفر توكينات وصول آمنة '
    'يمكن التحقق منها في وظائف السحابة لتحديد هوية المستخدم وصلاحياته بشكل موثوق. '
    'هذا يحل مشكلة إدارة الجلسات الحالية ويضمن عدم إمكانية تزوير هوية المستخدم. '
    'الخطة المجانية تدعم 50 ألف مستخدم شهريا مع مصادقة الهاتف والبريد.',
    body_style
))

# --- FIX 4: ENVIRONMENT VARIABLES ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.4 إزالة البيانات الحساسة من الكود المصدري (الأولوية العالية)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: متغيرات البيئة في <font name="Times New Roman">Vercel</font> و<font name="Times New Roman">Firebase</font></font></b>',
    body_indent_style
))
story.append(Paragraph(
    'جميع البيانات الحساسة المذكورة في الجدول أعلاه يجب نقلها إلى متغيرات البيئة على الخادم. '
    'منصة <font name="Times New Roman">Vercel</font> توفر إدارة متغيرات بيئة مجانية من خلال لوحة التحكم أو واجهة سطر الأوامر. '
    'كذلك <font name="Times New Roman">Firebase Cloud Functions</font> تدعم متغيرات البيئة عبر ملف التكوين. '
    'هذا يضمن عدم ظهور أي بيانات حساسة في الكود الذي يتم إرساله لمتصفح المستخدم.',
    body_style
))

env_data = [
    [Paragraph('<b>البيان</b>', tbl_header_style), Paragraph('<b>الإجراء المطلوب</b>', tbl_header_style), Paragraph('<b>الأداة المجانية</b>', tbl_header_style)],
    [Paragraph('كلمة مرور المدير', tbl_cell_left), Paragraph('نقلها لمتغير بيئة مع تغييرها فورا', tbl_cell_left), Paragraph('<font name="Times New Roman">Vercel Env</font>', tbl_cell_style)],
    [Paragraph('بريد وكلمة مرور الغراميل', tbl_cell_left), Paragraph('استخدام متغيرات بيئة مشفرة', tbl_cell_left), Paragraph('<font name="Times New Roman">Vercel Env</font>', tbl_cell_style)],
    [Paragraph('مفاتيح فايربيز', tbl_cell_left), Paragraph('تقييد بمفاتيح الخادم فقط', tbl_cell_left), Paragraph('<font name="Times New Roman">Firebase Console</font>', tbl_cell_style)],
    [Paragraph('مفتاح فونيج', tbl_cell_left), Paragraph('نقله لمتغير بيئة مشفر', tbl_cell_left), Paragraph('<font name="Times New Roman">Vercel Env</font>', tbl_cell_style)],
    [Paragraph('مفاتيح إشعارات الدفع', tbl_cell_left), Paragraph('نقلها لوظائف السحابة فقط', tbl_cell_left), Paragraph('<font name="Times New Roman">Firebase Functions</font>', tbl_cell_style)],
]
story.append(Spacer(1, 8))
story.append(make_table(env_data, [4*cm, 7*cm, 5.5*cm]))
story.append(Spacer(1, 4))
story.append(Paragraph('جدول 3: خطة إزالة البيانات الحساسة من الكود المصدري', caption_style))

# --- FIX 5: BETTER AUTH ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.5 حماية متقدمة لكلمات المرور (الأولوية العالية)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: استخدام <font name="Times New Roman">Firebase Auth</font> + سياسات قوية لكلمات المرور</font></b>',
    body_indent_style
))
story.append(Paragraph(
    'باستخدام <font name="Times New Roman">Firebase Authentication</font> يتم حل مشكلة تجزئة كلمات المرور بالكامل '
    'لأن الخدمة تتولى إدارة كلمات المرور بشكل آمن باستخدام خوارزميات حماية متقدمة مع ملح لكل كلمة مرور. '
    'في حال الرغبة بالاحتفاظ بنظام المصادقة المخصص، يمكن استخدام مكتبات مثل <font name="Times New Roman">bcrypt.js</font> '
    'المجانية مفتوحة المصدر والتي توفر تجزئة آمنة مع ملح وعامل عمل قابل للتعديل. '
    'كما يجب إلغاء كلمة مرور المدير الافتراضية فورا وتغييرها إلى كلمة مرور قوية فريدة.',
    body_style
))
story.append(Paragraph(
    'يجب أيضا تطبيق سياسة كلمات مرور قوية تتطلب 8 أحرف على الأقل مع مزيج من الأحرف الكبيرة والصغيرة والأرقام والرموز، '
    'مع منع استخدام كلمات المرور الشائعة والمتكررة. يمكن تنفيذ هذه السياسة في واجهة التسجيل وتغيير كلمة المرور '
    'مع إرسال تنبيه للمستخدم عند اكتشاف محاولات تسجيل دخول مشبوهة.',
    body_style
))

# --- FIX 6: XSS PROTECTION ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.6 الحماية من هجمات البرمجة عبر المواقع (الأولوية العالية)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: ترويسات أمان + تطهير شامل</font></b>',
    body_indent_style
))
story.append(Paragraph(
    'يجب إضافة ترويسات أمان أساسية عبر ملف <font name="Times New Roman">vercel.json</font> وهي مجانية تماما. '
    'أهم هذه الترويسات هي سياسة أمان المحتوى التي تحدد المصادر المسموح بها لتحميل الموارد وتنفيذ الأكواد. '
    'كذلك يجب إضافة ترويسة منع التضمين في إطارات لمنع هجمات النقر المختطف وترويسة منع الوضع المتشابه لمنع استغلال أنواع المحتوى.',
    body_style
))

headers_data = [
    [Paragraph('<b>الترويسة</b>', tbl_header_style), Paragraph('<b>القيمة المقترحة</b>', tbl_header_style), Paragraph('<b>الغرض</b>', tbl_header_style)],
    [Paragraph('<font name="Times New Roman">Content-Security-Policy</font>', tbl_cell_left_en), Paragraph('تقييد مصادر السكريبت والأنماط', tbl_cell_left), Paragraph('منع تنفيذ أكواد خبيثة', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">X-Frame-Options</font>', tbl_cell_left_en), Paragraph('<font name="Times New Roman">DENY</font>', tbl_cell_style), Paragraph('منع التضمين في إطارات', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">X-Content-Type-Options</font>', tbl_cell_left_en), Paragraph('<font name="Times New Roman">nosniff</font>', tbl_cell_style), Paragraph('منع تخمين أنواع المحتوى', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Referrer-Policy</font>', tbl_cell_left_en), Paragraph('<font name="Times New Roman">strict-origin</font>', tbl_cell_style), Paragraph('حماية معلومات المصدر', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Permissions-Policy</font>', tbl_cell_left_en), Paragraph('تقييد واجهات المتصفح', tbl_cell_left), Paragraph('منع الوصول غير المصرح', tbl_cell_left)],
]
story.append(Spacer(1, 8))
story.append(make_table(headers_data, [4.5*cm, 5*cm, 7*cm]))
story.append(Spacer(1, 4))
story.append(Paragraph('جدول 4: ترويسات الأمان المطلوبة في ملف <font name="Times New Roman">vercel.json</font>', caption_style))

# --- FIX 7: RATE LIMITING ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.7 تقييد معدل الطلبات (الأولوية المتوسطة)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: <font name="Times New Roman">Vercel Middleware</font> + <font name="Times New Roman">Firebase Realtime DB</font></font></b>',
    body_indent_style
))
story.append(Paragraph(
    'يمكن استخدام وسيط <font name="Times New Roman">Vercel</font> (مجاني مع الخطة الأساسية) لتنفيذ تقييد معدل الطلبات '
    'على جميع واجهات البرمجة. هذا يمنع هجمات الحرمان من الخدمة وهجمات التخمين. '
    'كما يجب تفعيل حماية التخمين لحساب المدير أيضا وإزالة الإعفاء الحالي. '
    'يمكن استخدام <font name="Times New Roman">Firebase Realtime Database</font> المجاني لتخزين عدادات المحاولات '
    'بشكل متزامن بين جميع مثيلات التطبيق.',
    body_style
))

# --- FIX 8: MONITORING ---
story.append(Spacer(1, 12))
story.append(add_heading('<b>3.8 المراقبة الأمنية والتنبيهات (الأولوية المتوسطة)</b>', h2_style, 1))

story.append(Paragraph(
    '<b><font color="#0ECB81">الحل المجاني: <font name="Times New Roman">Firebase App Check</font> + <font name="Times New Roman">Sentry</font></font></b>',
    body_indent_style
))
story.append(Paragraph(
    'خدمة <font name="Times New Roman">Firebase App Check</font> (مجانية حتى 10 آلاف تحقق شهريا) تضمن أن الطلبات '
    'تأتي من التطبيق الأصلي وليس من أدوات أو سكريبتات خارجية. يمكن تفعيلها بسهولة مع تطبيقات الويب باستخدام '
    'تقنية <font name="Times New Roman">reCAPTCHA Enterprise</font> (مجانية حتى 10 آلاف تقييم شهريا). '
    'كما يمكن استخدام خدمة <font name="Times New Roman">Sentry</font> (خطة مجانية سخية) لمراقبة الأخطاء والأعطال '
    'في التطبيق والحصول على تنبيهات فورية عند حدوث أي نشاط مشبوه.',
    body_style
))

# ==================== SECTION 4: IMPLEMENTATION PLAN ====================
story.append(Spacer(1, 24))
story.append(add_heading('<b>4. خطة التنفيذ المقترحة</b>', h1_style, 0))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'لتنفيذ خطة الحماية الشاملة المقترحة، نوصي باتباع ترتيب زمني محدد يراعي الأولوية والتبعيات بين المهام. '
    'تم تقسيم خطة التنفيذ إلى ثلاث مراحل حسب الإلحاح مع تحديد الأدوات المجانية المطلوبة لكل مرحلة. '
    'يجب البدء بالمرحلة الأولى فورا لأنها تتناول الثغرات الحرجة التي يمكن استغلالها في أي لحظة.',
    body_style
))

phase_data = [
    [Paragraph('<b>المرحلة</b>', tbl_header_style), Paragraph('<b>الإطار الزمني</b>', tbl_header_style), Paragraph('<b>المهام</b>', tbl_header_style), Paragraph('<b>الأدوات المجانية</b>', tbl_header_style)],
    [Paragraph('<b>الأولى - حرجة</b>', tbl_cell_style), Paragraph('فوري - يوم واحد', tbl_cell_style), 
     Paragraph('تقييد قواعد فايربيز ونقل البيانات الحساسة لمتغيرات البيئة', tbl_cell_left),
     Paragraph('<font name="Times New Roman">Firebase Rules, Vercel Env</font>', tbl_cell_left)],
    [Paragraph('<b>الثانية - عالية</b>', tbl_cell_style), Paragraph('1-2 أسبوع', tbl_cell_style),
     Paragraph('نقل المنطق الحساس لوظائف السحابة وتبني مصادقة فايربيز', tbl_cell_left),
     Paragraph('<font name="Times New Roman">Cloud Functions, Firebase Auth</font>', tbl_cell_left)],
    [Paragraph('<b>الثالثة - متوسطة</b>', tbl_cell_style), Paragraph('2-4 أسابيع', tbl_cell_style),
     Paragraph('ترويسات الأمان وتقييد المعدلات والمراقبة', tbl_cell_left),
     Paragraph('<font name="Times New Roman">Vercel, Sentry, App Check</font>', tbl_cell_left)],
]
story.append(Spacer(1, 8))
story.append(make_table(phase_data, [3*cm, 3*cm, 5.5*cm, 5*cm]))
story.append(Spacer(1, 4))
story.append(Paragraph('جدول 5: خطة التنفيذ المقترحة على ثلاث مراحل', caption_style))

# ==================== SECTION 5: FREE TOOLS SUMMARY ====================
story.append(Spacer(1, 24))
story.append(add_heading('<b>5. ملخص الأدوات المجانية الكاملة</b>', h1_style, 0))
story.append(Spacer(1, 6))

story.append(Paragraph(
    'يلخص الجدول التالي جميع الأدوات والخدمات المجانية التي يمكن استخدامها لتأمين التطبيق بالكامل. '
    'جميع هذه الأدوات لها خطط مجانية سخية كافية لتشغيل تطبيق مالي بهذا الحجم بدون أي تكلفة مادية. '
    'المجموع الإجمالي للتكلفة هو صفر مع توفير مستوى أمان ممتاز يضارع التطبيقات المصرفية الكبرى.',
    body_style
))

tools_data = [
    [Paragraph('<b>الأداة / الخدمة</b>', tbl_header_style), Paragraph('<b>الخطة المجانية</b>', tbl_header_style), Paragraph('<b>الغرض الأمني</b>', tbl_header_style)],
    [Paragraph('<font name="Times New Roman">Firebase Security Rules</font>', tbl_cell_left_en), Paragraph('غير محدود', tbl_cell_style), Paragraph('حماية قاعدة البيانات', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Firebase Authentication</font>', tbl_cell_left_en), Paragraph('50 ألف مستخدم/شهر', tbl_cell_style), Paragraph('مصادقة آمنة مع حماية من التخمين', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Firebase Cloud Functions</font>', tbl_cell_left_en), Paragraph('2 مليون استدعاء/شهر', tbl_cell_style), Paragraph('تنفيذ المنطق الحساس على الخادم', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Firebase App Check</font>', tbl_cell_left_en), Paragraph('10 آلاف تحقق/شهر', tbl_cell_style), Paragraph('منع الوصول من تطبيقات مزيفة', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Vercel Environment Variables</font>', tbl_cell_left_en), Paragraph('غير محدود', tbl_cell_style), Paragraph('حماية البيانات الحساسة', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Vercel Headers</font>', tbl_cell_left_en), Paragraph('غير محدود', tbl_cell_style), Paragraph('ترويسات أمان المتصفح', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">Sentry</font>', tbl_cell_left_en), Paragraph('5 آلاف خطأ/شهر', tbl_cell_style), Paragraph('مراقبة الأخطاء والتنبيهات', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">bcrypt.js</font>', tbl_cell_left_en), Paragraph('مفتوح المصدر', tbl_cell_style), Paragraph('تجزئة آمنة لكلمات المرور', tbl_cell_left)],
    [Paragraph('<font name="Times New Roman">DOMPurify</font>', tbl_cell_left_en), Paragraph('مفتوح المصدر', tbl_cell_style), Paragraph('تطهير المدخلات من الأكواد الخبيثة', tbl_cell_left)],
]
story.append(Spacer(1, 8))
story.append(make_table(tools_data, [5*cm, 4*cm, 7.5*cm]))
story.append(Spacer(1, 4))
story.append(Paragraph('جدول 6: ملخص الأدوات والخدمات المجانية لتأمين التطبيق', caption_style))

story.append(Spacer(1, 18))
story.append(Paragraph(
    'من خلال تطبيق هذه الخطة الشاملة باستخدام الأدوات المجانية المذكورة أعلاه، يمكن رفع مستوى أمان التطبيق '
    'من مستوى حرج جدا إلى مستوى آمن وموثوق. المفتاح الأساسي هو نقل الثقة من واجهة المستخدم إلى الخادم، '
    'حيث لا يمكن للمستخدم أو المهاجم تعديل المنطق البرمجي أو تجاوز عمليات التحقق. '
    'جميع الخدمات المقترحة مجانية بالكامل وتوفر مستوى حماية يتناسب مع طبيعة التطبيق المالي الحساسة.',
    body_style
))

# ========== BUILD ==========
doc.multiBuild(story)
print(f"PDF generated: {output_path}")
