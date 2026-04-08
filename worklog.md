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

## ملاحظات
- لا أخطاء TypeScript في الملفات الجديدة
- جميع النصوص باللغة العربية
- لا env variables جديدة
- المفتاح الافتراضي في `firebase-key.ts` لم يتغير
