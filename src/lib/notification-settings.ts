/**
 * Notification sound settings - v2.6.0
 *
 * Per-category sound toggle system. All sounds enabled by default.
 * Settings persist in localStorage across sessions.
 */

export type NotificationCategory = 'deposit' | 'withdrawal' | 'kyc' | 'transaction' | 'general'

export interface NotificationSoundSettings {
  /** Master switch — when false, NO notification sounds play at all */
  soundEnabled: boolean
  /** Individual category toggles (only checked when soundEnabled = true) */
  categories: Record<NotificationCategory, boolean>
}

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  soundEnabled: true,
  categories: {
    deposit: true,      // إيداع - deposit confirmed/reviewing/rejected
    withdrawal: true,   // سحب - withdrawal accepted/completed/rejected
    kyc: true,          // توثيق - KYC approved/rejected
    transaction: true,  // معاملات - general transaction notifications
    general: true,      // عام - system messages, login, etc.
  },
}

const STORAGE_KEY = 'forexyemeni-notif-sound'

/** Read settings from localStorage (synchronous — safe to call anytime) */
export function getNotificationSoundSettings(): NotificationSoundSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<NotificationSoundSettings>
    return {
      soundEnabled: parsed.soundEnabled ?? true,
      categories: {
        ...DEFAULT_SETTINGS.categories,
        ...(parsed.categories || {}),
      },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Save settings to localStorage */
export function saveNotificationSoundSettings(settings: NotificationSoundSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Silent fail
  }
}

/**
 * Map a notification `type` (from the server) to a `NotificationCategory`.
 * Used to decide whether to play sound for a given notification.
 */
export function mapNotifTypeToCategory(type: string): NotificationCategory {
  switch (type) {
    case 'deposit':
    case 'deposit_confirmed':
    case 'deposit_rejected':
    case 'deposit_reviewing':
      return 'deposit'
    case 'withdrawal':
    case 'withdrawal_confirmed':
    case 'withdrawal_rejected':
    case 'withdrawal_accepted':
      return 'withdrawal'
    case 'kyc':
    case 'kyc_approved':
    case 'kyc_rejected':
    case 'verification':
      return 'kyc'
    case 'transaction':
    case 'transfer':
    case 'payment':
      return 'transaction'
    default:
      return 'general'
  }
}

/**
 * Check if sound should play for a given notification type.
 * Checks master switch first, then the specific category toggle.
 */
export function shouldPlaySound(type: string): boolean {
  const settings = getNotificationSoundSettings()
  if (!settings.soundEnabled) return false
  const category = mapNotifTypeToCategory(type)
  return settings.categories[category] !== false
}

/**
 * Toggle master sound on/off.
 */
export function toggleMasterSound(): NotificationSoundSettings {
  const settings = getNotificationSoundSettings()
  settings.soundEnabled = !settings.soundEnabled
  saveNotificationSoundSettings(settings)
  return settings
}

/**
 * Toggle a specific category sound on/off.
 */
export function toggleCategorySound(category: NotificationCategory): NotificationSoundSettings {
  const settings = getNotificationSoundSettings()
  settings.categories[category] = !settings.categories[category]
  saveNotificationSoundSettings(settings)
  return settings
}

/** Category display info (Arabic labels & descriptions) */
export const NOTIFICATION_CATEGORIES: {
  key: NotificationCategory
  label: string
  description: string
}[] = [
  { key: 'deposit', label: 'الإيداعات', description: 'تنبيهات تأكيد ورفض الإيداعات' },
  { key: 'withdrawal', label: 'السحوبات', description: 'تنبيهات قبول ورفض السحوبات' },
  { key: 'kyc', label: 'التوثيق (KYC)', description: 'تنبيهات قبول ورفض طلبات التوثيق' },
  { key: 'transaction', label: 'المعاملات', description: 'تنبيهات المعاملات العامة' },
  { key: 'general', label: 'عام', description: 'تنبيهات النظام والمستجدات' },
]
