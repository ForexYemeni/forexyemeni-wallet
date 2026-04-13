---
Task ID: 1
Agent: Main Agent
Task: إضافة التحديث الفوري للعمليات (KYC, الرصيد, الحالة) بدون الحاجة لسحب الشاشة

Work Log:
- بحث في قاعدة الكود عن مصدر نص "2 من 3" — وجد في BalanceChart.tsx KYCProgressRing
- تحليل نظام KYC: 3 خطوات (هاتف، تحقق، مستندات) و kycStatus: none/pending/approved/rejected
- فهم المشكلة: عند موافقة الإدارة على KYC، بيانات المستخدم في zustand store لا تتحدث تلقائياً
- إنشاء useRealtimeSync hook — يطلب /api/user/profile كل 10 ثوانٍ ويقارن البيانات ويحدث store عند التغيير
- إضافة useRealtimeSync() في page.tsx ليعمل عالمياً لجميع الشاشات
- تحديث /api/transactions ليعيد kycStatus بالإضافة ل balance و frozenBalance و accountNumber
- تحديث Dashboard.tsx ليتفحص kycStatus من استجابة الـ transactions ويحدث store
- إصلاح سباق البيانات في AdminPanel: تغيير "قبول الكل" من طلبات متوازية إلى طلبات متسلسلة

Stage Summary:
- الملفات الجديدة: src/hooks/useRealtimeSync.ts
- الملفات المعدلة: src/app/page.tsx, src/app/api/transactions/route.ts, src/components/wallet/Dashboard.tsx, src/components/admin/AdminPanel.tsx
- الآن أي عملية من الإدارة (موافقة KYC, تحديث رصيد, تعليق حساب) تنعكس فوراً على تطبيق المستخدم خلال 10 ثوانٍ كحد أقصى
- إصلاح مشكلة "2 من 3" — عندما يتم الموافقة على KYC يتغير kycStatus إلى approved وتتحدث الشاشة فوراً
