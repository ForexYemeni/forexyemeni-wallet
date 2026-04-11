# سجل العمل - ميزة "ربط قاعدة البيانات"

## التاريخ: 2025

## المهام المنجزة

### 1. تعديل `src/lib/firebase.ts`
- إضافة دالة `reinitializeFirebase()` لتهيئة Firebase بمفتاح service account جديد
- إضافة دالة `resetFirebaseToDefault()` للرجوع للمفتاح الافتراضي
- إضافة دالة `getCurrentProjectId()` للحصول على معرف المشروع الحالي
- استيراد `deleteApp` من `firebase-admin/app` لحذف التطبيق الحالي قبل إعادة التهيئة

### 2. إنشاء API Route `/src/app/api/admin/firebase-config/route.ts`
- **GET**: يعيد حالة الاتصال الحالية (projectId, connected, isCustom, customProjectId, updatedAt)
- **POST - action: "test"**: يختبر الاتصال بقاعدة Firebase باستخدام مفتاح مؤقت
- **POST - action: "save"**: يحفظ المفتاح المشفر (base64) في `systemSettings/customFirebase` ويعيد تهيئة Firebase
- **POST - action: "revert"**: يحذف الإعدادات المخصصة ويرجع للمفتاح الافتراضي
- التحقق من صلاحية الأدمن في كل الطلبات

### 3. إنشاء مكون `/src/components/admin/FirebaseConfig.tsx`
- بطاقة حالة الاتصال الحالية (projectId, حالة الاتصال, نوع الاتصال)
- حقل إدخال Service Account Key (textarea) مع دعم RTL
- زر "لصق من الحافظة" لنسخ المفتاح
- زر "اختبار الاتصال" - يرسل JSON للـ API ويعرض النتيجة
- زر "حفظ وتفعيل" - يحفظ المفتاح ويعيد تهيئة Firebase
- زر "الرجوع للافتراضي" - يظهر فقط عند استخدام مفتاح مخصص
- تحذير أمني حول حماية المفتاح
- قسم "كيف تحصل على المفتاح؟" مع خطوات مفصلة
- استخدام `glass-card`, `text-gold`, ألوان ذهبية, اتجاه RTL

### 4. تعديل `src/components/admin/AdminPanel.tsx`
- إضافة أيقونة `Database` من lucide-react
- إضافة `FirebaseConfig` كـ lazy import
- إضافة تبويب جديد `firebase-config` في قائمة `allTabs` (بعد "بلاغات السحوبات")
- إضافة عرض المكون مع Suspense fallback
- تحديث نوع `activeTab` state ليشمل `'firebase-config'`

## الملفات المعدلة/المُنشأة
1. ✅ `src/lib/firebase.ts` - معدّل
2. ✅ `src/app/api/admin/firebase-config/route.ts` - جديد
3. ✅ `src/components/admin/FirebaseConfig.tsx` - جديد
4. ✅ `src/components/admin/AdminPanel.tsx` - معدّل

---

## إصلاح: تبويب قاعدة البيانات + خطأ "المستخدم غير موجود"

### المشاكل:
1. تبويب `firebase-config` كان مكرراً مرتين في مصفوفة `allTabs`
2. خطأ "المستخدم غير موجود" يظهر عند فتح تبويب قاعدة البيانات
3. المكون لا يعرض الأخطاء بشكل واضح

### الإصلاحات:
1. **AdminPanel.tsx**: إزالة النسخة المكررة من `firebase-config` - تبقى نسخة واحدة في التبويبات الرئيسية
2. **firebase-config/route.ts**: تحسين `verifyAdmin` مع try-catch أفضل وتصنيف أخطاء أوضح
3. **FirebaseConfig.tsx**: إضافة حالة خطأ مفصّلة مع اقتراحات حل:
   - خطأ "المستخدم غير موجود" → يعرض حلول مقترحة
   - خطأ شبكة → يعرض حلول اتصال
   - زر "إعادة المحاولة"

### التزام: `1ba9bf8`
تم الرفع على GitHub: `github.com/ForexYemeni/forexyemeni-wallet` (main)

## ملاحظات
- لا أخطاء TypeScript في الملفات الجديدة
- جميع النصوص باللغة العربية
- لا env variables جديدة
- المفتاح الافتراضي في `firebase-key.ts` لم يتغير

---

## إضافة قسم الإشعارات الصوتية (FCM) في لوحة الاستعادة السرية

### التاريخ: 2026-04-10

### الفكرة
إضافة قسم الإشعارات الصوتية (Firebase Cloud Messaging) في لوحة الاستعادة السرية، بحيث يمكن للإدارة اختبار الإشعارات بعد تغيير قاعدة البيانات والتأكد من عمل التنبيهات الصوتية.

### الملفات المعدلة
1. ✅ `src/app/api/emergency/secret-recovery/route.ts` — إضافة 4 إجراءات FCM جديدة
2. ✅ `src/components/auth/SecretRecoveryPanel.tsx` — إضافة تبويب الإشعارات الصوتية

### التغييرات في API (secret-recovery/route.ts)
- `getDirectMessaging()`: دالة جديدة لإنشاء اتصال FCM مستقل (Firebase Messaging + Firestore)
- `getCurrentServiceAccountKey()`: دالة للحصول على المفتاح الحالي
- `fcm-status`: فحص حالة FCM — عدد التوكنات، المستخدمين، حالة الاتصال
- `fcm-test`: إرسال إشعار اختباري صوتي لجميع الأجهزة أو مستخدم محدد
- `fcm-send`: إرسال إشعار مخصص لمستخدم محدد
- `fcm-cleanup`: تنظيف التوكنات غير الصالحة باستخدام dry-run

### التغييرات في SecretRecoveryPanel
- إضافة نظام تبويبات (Tabs): "قاعدة البيانات" و "الإشعارات الصوتية"
- تبويب الإشعارات يتضمن:
  - بطاقة حالة FCM (متصل/غير متصل، عدد التوكنات، المستخدمين، أجهزة الإدارة)
  - زر اختبار التنبيه الصوتي (إرسال إشعار اختباري مع صوت)
  - زر تنظيف التوكنات القديمة (من المشروع السابق)
  - نموذج إرسال إشعار مخصص (userId + عنوان + نص)
  - عرض قائمة الأجهزة المسجلة (قابل للطي)
  - ملاحظات تعليمية حول FCM

### التزام: `190bb08`

---

## إعادة تصميم نموذج الإيداع - فصل أنواع الإيداع والعملات

### التاريخ: 2026-04-12

### الفكرة
إعادة تصميم صفحة الإيداع بحيث يظهر للمستخدم:
1. أولاً: اختيار **نوع الإيداع** (إيداع بنكي / تحويل بنكي / عملات رقمية)
2. للإيداع البنكي والتحويل البنكي فقط: اختيار **العملة** (دولار / يمني / سعودي)
3. العملات الرقمية تبقى كما هي بدون اختيار عملة

### الملفات المعدلة
1. `src/components/wallet/DepositForm.tsx` — إعادة كتابة كاملة للنموذج
2. `src/components/admin/AdminPanel.tsx` — إضافة نوع "تحويل بنكي" + حقوله

### التغييرات في DepositForm.tsx
- تغيير الـ Steps من 3 إلى 4 خطوات: category → currency → methods → details
- للعملات الرقمية: 3 خطوات فقط (category → methods → details) بدون اختيار عملة
- إضافة `selectedCategory` state لتتبع نوع الإيداع المختار
- إضافة `DEPOSIT_CATEGORIES`: إيداع بنكي، تحويل بنكي، عملات رقمية
- إضافة وصف سعر الصرف الحي في خيارات العملة
- فلترة طرق الدفع حسب النوع + العملة المختارة
- مؤشر خطوات ديناميكي (3 خطوات للعملات الرقمية، 4 للبنكي)

### التغييرات في AdminPanel.tsx
- إضافة `bank_transfer` كنوع جديد في القائمة المنسدلة (إيداع بنكي / تحويل بنكي / تحويل عبر صراف)
- إضافة قسم حقول "بيانات التحويل البنكي" (recipientName, recipientPhone, network)
- تحديث TYPE_LABELS ليشمل bank_transfer

