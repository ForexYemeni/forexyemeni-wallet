'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Database,
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  Copy,
  RefreshCw,
  AlertTriangle,
  Shield,
  Loader2,
  ClipboardPaste,
} from 'lucide-react'

interface ConnectionStatus {
  projectId: string | null
  connected: boolean
  isCustom: boolean
  customProjectId: string | null
  updatedAt: string | null
}

export default function FirebaseConfig() {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [serviceAccountKey, setServiceAccountKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; projectId?: string } | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/admin/firebase-config?userId=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setStatus(data)
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في جلب حالة الاتصال')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setServiceAccountKey(text)
        setTestResult(null)
        toast.success('تم اللصق من الحافظة')
      } else {
        toast.error('الحافظة فارغة')
      }
    } catch {
      toast.error('لا يمكن الوصول للحافظة. تأكد من منح الإذن.')
    }
  }

  const handleTest = async () => {
    if (!serviceAccountKey.trim()) {
      toast.error('يرجى إدخال مفتاح Service Account')
      return
    }

    // Basic JSON validation
    try {
      JSON.parse(serviceAccountKey)
    } catch {
      toast.error('صيغة JSON غير صالحة')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          userId: user?.id,
          serviceAccountKey: serviceAccountKey.trim(),
        }),
      })
      const data = await res.json()
      setTestResult({
        success: data.success,
        message: data.message,
        projectId: data.projectId,
      })
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch {
      setTestResult({ success: false, message: 'خطأ في الاتصال بالخادم' })
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!serviceAccountKey.trim()) {
      toast.error('يرجى إدخال مفتاح Service Account')
      return
    }

    // Validate JSON
    try {
      JSON.parse(serviceAccountKey)
    } catch {
      toast.error('صيغة JSON غير صالحة')
      return
    }

    if (!testResult?.success) {
      toast.error('يرجى اختبار الاتصال أولاً قبل الحفظ')
      return
    }

    if (!confirm(`هل أنت متأكد من حفظ هذا المفتاح وتفعيله؟\nسيتم التحول لقاعدة البيانات الجديدة فوراً.\n\nالمشروع: ${testResult.projectId}`)) {
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          userId: user?.id,
          serviceAccountKey: serviceAccountKey.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setTestResult(null)
        setServiceAccountKey('')
        await fetchStatus()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = async () => {
    if (!confirm('هل أنت متأكد من الرجوع للمفتاح الافتراضي؟\nسيتم التحول لقاعدة البيانات الأصلية.')) {
      return
    }

    setReverting(true)
    try {
      const res = await fetch('/api/admin/firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revert',
          userId: user?.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setTestResult(null)
        setServiceAccountKey('')
        await fetchStatus()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('خطأ في الرجوع للمفتاح الافتراضي')
    } finally {
      setReverting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold gold-text">ربط قاعدة البيانات</h2>
            <p className="text-xs text-muted-foreground">ربط تطبيقك بقاعدة بيانات Firebase مختلفة</p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          title="تحديث الحالة"
        >
          <RefreshCw className="w-4 h-4 text-gold" />
        </button>
      </div>

      {/* Connection Status Card */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gold" />
          حالة الاتصال الحالية
        </h3>
        {status && (
          <div className="space-y-3">
            {/* Project Info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">معرّف المشروع</span>
              </div>
              <span className="text-sm font-mono font-bold text-gold" dir="ltr">
                {status.projectId || 'غير متاح'}
              </span>
            </div>

            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                {status.connected ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-xs text-muted-foreground">حالة الاتصال</span>
              </div>
              {status.connected ? (
                <span className="text-sm font-bold text-green-400">متصل ✓</span>
              ) : (
                <span className="text-sm font-bold text-red-400">غير متصل ✗</span>
              )}
            </div>

            {/* Custom Config Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">نوع الاتصال</span>
              </div>
              {status.isCustom ? (
                <span className="text-sm font-bold text-amber-400">مخصص</span>
              ) : (
                <span className="text-sm font-bold text-muted-foreground">افتراضي</span>
              )}
            </div>

            {/* Custom config details */}
            {status.isCustom && (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">مشروع مخصص</span>
                  <span className="text-xs font-mono text-amber-400" dir="ltr">
                    {status.customProjectId || '—'}
                  </span>
                </div>
                {status.updatedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">آخر تحديث</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(status.updatedAt).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security Warning */}
      <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-400">تحذير أمني</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              مفتاح Service Account حساس جداً ويمكنه الوصول الكامل لقاعدة البيانات.
              تأكد من حماية هذا المفتاح وعدم مشاركته مع أي شخص.
              سيتم تخزين المفتاح مشفراً في قاعدة البيانات.
            </p>
          </div>
        </div>
      </div>

      {/* Service Account Key Input */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold" />
          إعداد اتصال جديد
        </h3>
        <p className="text-xs text-muted-foreground">
          الصق مفتاح Service Account JSON من لوحة تحكم Firebase لربط قاعدة بيانات جديدة.
        </p>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">مفتاح Service Account (JSON)</Label>
          <div className="relative">
            <textarea
              value={serviceAccountKey}
              onChange={(e) => {
                setServiceAccountKey(e.target.value)
                setTestResult(null)
              }}
              placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "..."}'
              dir="ltr"
              rows={8}
              className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50 placeholder:text-muted-foreground/50"
            />
            <div className="absolute top-2 left-2 flex gap-1">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                title="لصق من الحافظة"
              >
                <ClipboardPaste className="w-3 h-3 text-gold" />
                <span className="text-[10px] text-gold">لصق</span>
              </button>
              {serviceAccountKey && (
                <button
                  type="button"
                  onClick={() => {
                    setServiceAccountKey('')
                    setTestResult(null)
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                  title="مسح"
                >
                  <XCircle className="w-3 h-3 text-red-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-lg border ${
            testResult.success
              ? 'bg-green-500/5 border-green-500/10'
              : 'bg-red-500/5 border-red-500/10'
          }`}>
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <div>
                <p className={`text-xs font-bold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.success ? 'اتصال ناجح' : 'فشل الاتصال'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{testResult.message}</p>
                {testResult.success && testResult.projectId && (
                  <p className="text-xs font-mono text-green-400/70 mt-1" dir="ltr">
                    المشروع: {testResult.projectId}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={handleTest}
              disabled={testing || !serviceAccountKey.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-lg h-10"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin text-gold" />
              ) : (
                <Link2 className="w-4 h-4 text-gold" />
              )}
              <span className="text-xs font-medium">
                {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
              </span>
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || !testResult?.success}
              className="flex-1 flex items-center justify-center gap-2 bg-gold/20 hover:bg-gold/30 text-gold rounded-lg h-10 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">
                {saving ? 'جارٍ الحفظ...' : 'حفظ وتفعيل'}
              </span>
            </Button>
          </div>

          {/* Revert Button */}
          {status?.isCustom && (
            <Button
              onClick={handleRevert}
              disabled={reverting}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-lg h-10"
            >
              {reverting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">
                {reverting ? 'جارٍ الرجوع...' : 'الرجوع للافتراضي'}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* How to get the key */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Copy className="w-4 h-4 text-muted-foreground" />
          كيف تحصل على المفتاح؟
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium text-white/80">الخطوات:</p>
          <ol className="list-decimal list-inside space-y-1 mr-2">
            <li>افتح لوحة تحكم Firebase</li>
            <li>اذهب إلى إعدادات المشروع (Project Settings)</li>
            <li>اختر تبويب Service Accounts</li>
            <li>اضغط على &quot;Generate new private key&quot;</li>
            <li>انسخ محتوى ملف JSON بالكامل</li>
            <li>الصقه في الحقل أعلاه واضغط &quot;اختبار الاتصال&quot;</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
