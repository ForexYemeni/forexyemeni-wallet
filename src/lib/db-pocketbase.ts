import PocketBase from 'pocketbase'

const SERVER_IP = '47.243.212.226'
const POCKETBASE_URL = process.env.POCKETBASE_URL ||
  (process.env.VERCEL ? `http://${SERVER_IP}:81` : 'http://127.0.0.1:8090')

let _pb: PocketBase | null = null

function getPB(): PocketBase {
  if (!_pb) {
    _pb = new PocketBase(POCKETBASE_URL)
    _pb.autoCancellation(false)
    // When running on Vercel/external, route through Caddy proxy via XTransformPort
    if (!POCKETBASE_URL.includes('127.0.0.1') && !POCKETBASE_URL.includes('localhost')) {
      _pb.beforeSend = function(url, options) {
        const urlObj = new URL(url, POCKETBASE_URL)
        urlObj.searchParams.set('XTransformPort', '8090')
        return { url: urlObj.toString(), options }
      }
    }
  }
  return _pb
}

// ===================== HELPERS =====================

export function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateAffiliateCode(): string {
  const bytes = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export async function generateAccountNumber(): Promise<number> {
  const pb = getPB()
  try {
    const record = await pb.collection('counters').getFirstListItem('key = "accountNumber"')
    const newVal = (record.value || 100000) + 1
    await pb.collection('counters').update(record.id, { value: newVal, key: 'accountNumber' })
    return newVal
  } catch {
    const record = await pb.collection('counters').create({ value: 100001, key: 'accountNumber' })
    return record.value
  }
}

export function nowTimestamp() {
  return new Date().toISOString()
}

export function fromFirestoreTimestamp(date: unknown): string {
  if (!date) return new Date().toISOString()
  if (typeof date === 'string') return date
  if (date && typeof date === 'object' && 'toDate' in (date as object)) {
    return (date as { toDate: () => Date }).toDate().toISOString()
  }
  if (date instanceof Date) return date.toISOString()
  return new Date().toISOString()
}

// Alias for compatibility
export function getDb() {
  return getPB()
}

// ===================== TYPES =====================

export interface User {
  id: string
  email: string
  passwordHash: string
  fullName?: string | null
  phone?: string | null
  country?: string | null
  role: string
  status: string
  emailVerified: boolean
  phoneVerified: boolean
  kycStatus: string
  kycIdPhoto?: string | null
  kycSelfie?: string | null
  kycNotes?: string | null
  balance: number
  frozenBalance: number
  mustChangePassword: boolean
  affiliateCode: string
  referredBy?: string | null
  merchantId?: string | null
  pinHash?: string | null
  pendingConfirmation?: string | null
  permissions?: string | null
  twoFactorEnabled?: boolean | null
  backupCodes?: string[] | null
  createdAt: string
  updatedAt: string
  accountNumber?: number | null
  tempPinHash?: string | null
  tempPinExpiresAt?: string | null
}

export interface OtpCode {
  id: string
  userId?: string | null
  email: string
  phone?: string | null
  code: string
  type: string
  purpose?: string | null
  verified: boolean
  expiresAt: string
  createdAt: string
}

export interface KYCRecord {
  id: string; userId: string; type: string; fileUrl: string; status: string;
  reviewedAt?: string | null; reviewerId?: string | null; notes?: string | null; createdAt: string;
}

export interface Deposit {
  id: string; userId: string; amount: number; fee?: number; netAmount?: number;
  currency: string; network: string; txId?: string | null; fromAddress?: string | null;
  toAddress?: string | null; status: string; method: string; merchantId?: string | null;
  merchantNote?: string | null; adminNote?: string | null; screenshot?: string | null;
  paymentMethodName?: string | null; paymentMethodId?: string | null;
  createdAt: string; updatedAt: string;
}

export interface Withdrawal {
  id: string; userId: string; amount: number; currency: string; network: string;
  toAddress: string; status: string; method: string; merchantId?: string | null;
  txId?: string | null; fee: number; netAmount?: number; adminNote?: string | null;
  screenshot?: string | null; paymentMethodName?: string | null; paymentMethodId?: string | null;
  createdAt: string; updatedAt: string;
}

export interface Transaction {
  id: string; userId: string; type: string; amount: number;
  balanceBefore: number; balanceAfter: number; description?: string | null;
  referenceId?: string | null; createdAt: string;
}

export interface Notification {
  id: string; userId: string; title: string; message: string;
  type: string; read: boolean; createdAt: string;
}

export interface PaymentMethod {
  id: string; name: string; type: string; category: string; purpose: string;
  isActive: boolean; network?: string | null; walletAddress?: string | null;
  accountName?: string | null; accountNumber?: string | null; beneficiaryName?: string | null;
  phone?: string | null; recipientName?: string | null; recipientPhone?: string | null;
  minAmount?: number | null; maxAmount?: number | null; instructions?: string | null;
  createdAt: string; updatedAt: string;
}

export interface UserPaymentMethod {
  id: string; userId: string; name: string; type: string; category: string;
  isActive: boolean; network?: string | null; walletAddress?: string | null;
  accountName?: string | null; accountNumber?: string | null; beneficiaryName?: string | null;
  phone?: string | null; recipientName?: string | null; recipientPhone?: string | null;
  createdAt: string; updatedAt: string;
}

export interface FaqItem {
  id: string; question: string; keywords: string[]; answer: string;
  category: string; isActive: boolean; priority: number; createdAt: string; updatedAt: string;
}

export interface Referral {
  id: string; referrerId: string; referredId: string; referredEmail: string;
  referralCode: string; level: number; status: string; totalEarnings: number; createdAt: string;
}

export interface ReferralCommission {
  id: string; referrerId: string; referredId: string; referralId: string;
  depositId?: string | null; withdrawalId?: string | null; amount: number;
  level: number; description: string; createdAt: string;
}

export interface ReferralSettings {
  isEnabled: boolean; commissionType: string; commissionLevels: number[];
  minDepositForCommission: number; maxLevels: number;
}

export interface Chat {
  id: string; userId: string; adminId: string; participants: string[];
  lastMessage: string; lastMessageAt: string; lastMessageBy: string;
  userUnreadCount: number; adminUnreadCount: number; status: string;
  createdAt: string; updatedAt: string;
}

export interface ChatMessage {
  id: string; chatId: string; senderId: string; senderType: string;
  message: string; type: string; imageUrl?: string | null; read: boolean; createdAt: string;
}

export interface Merchant {
  id: string; userId: string; status: 'pending' | 'approved' | 'rejected';
  idPhoto: string; selfiePhoto: string; addressProof: string; fullName: string;
  phone: string; submittedAt: string; reviewedAt?: string | null;
  reviewNote?: string | null; reviewedBy?: string | null;
}

// ===================== USER OPERATIONS =====================

export const userOperations = {
  async findUnique(where: { email?: string; id?: string }): Promise<User | null> {
    const pb = getPB()
    try {
      if (where.email) {
        const records = await pb.collection('users').getFullList({ filter: `email = '${where.email.replace(/'/g, "\\'")}'`, limit: 1 })
        if (records.length === 0) return null
        const r = records[0] as any
        return { id: r.id, email: r.email, passwordHash: r.passwordHash, fullName: r.fullName || null, phone: r.phone || null, country: r.country || null, role: r.role || 'user', status: r.status || 'active', emailVerified: !!r.emailVerified, phoneVerified: !!r.phoneVerified, kycStatus: r.kycStatus || 'none', kycIdPhoto: r.kycIdPhoto || null, kycSelfie: r.kycSelfie || null, kycNotes: r.kycNotes || null, balance: r.balance || 0, frozenBalance: r.frozenBalance || 0, mustChangePassword: !!r.mustChangePassword, affiliateCode: r.affiliateCode || '', referredBy: r.referredBy || null, merchantId: r.merchantId || null, pinHash: r.pinHash || null, pendingConfirmation: r.pendingConfirmation || null, permissions: r.permissions || null, twoFactorEnabled: r.twoFactorEnabled || false, backupCodes: r.backupCodes || null, accountNumber: r.accountNumber || null, tempPinHash: r.tempPinHash || null, tempPinExpiresAt: r.tempPinExpiresAt || null, createdAt: r.created, updatedAt: r.updated }
      }
      if (where.id) {
        const r = await pb.collection('users').getOne(where.id) as any
        return { id: r.id, email: r.email, passwordHash: r.passwordHash, fullName: r.fullName || null, phone: r.phone || null, country: r.country || null, role: r.role || 'user', status: r.status || 'active', emailVerified: !!r.emailVerified, phoneVerified: !!r.phoneVerified, kycStatus: r.kycStatus || 'none', kycIdPhoto: r.kycIdPhoto || null, kycSelfie: r.kycSelfie || null, kycNotes: r.kycNotes || null, balance: r.balance || 0, frozenBalance: r.frozenBalance || 0, mustChangePassword: !!r.mustChangePassword, affiliateCode: r.affiliateCode || '', referredBy: r.referredBy || null, merchantId: r.merchantId || null, pinHash: r.pinHash || null, pendingConfirmation: r.pendingConfirmation || null, permissions: r.permissions || null, twoFactorEnabled: r.twoFactorEnabled || false, backupCodes: r.backupCodes || null, accountNumber: r.accountNumber || null, tempPinHash: r.tempPinHash || null, tempPinExpiresAt: r.tempPinExpiresAt || null, createdAt: r.created, updatedAt: r.updated }
      }
      return null
    } catch (e: any) {
      if (e?.status === 404) return null
      throw e
    }
  },

  async findMany(options?: { orderBy?: string; take?: number; select?: string[] }): Promise<User[]> {
    const pb = getPB()
    const records = await pb.collection('users').getFullList({
      sort: '-created',
      limit: options?.take || 100,
    })
    return records.map((r: any) => ({ id: r.id, email: r.email, passwordHash: r.passwordHash, fullName: r.fullName || null, phone: r.phone || null, country: r.country || null, role: r.role || 'user', status: r.status || 'active', emailVerified: !!r.emailVerified, phoneVerified: !!r.phoneVerified, kycStatus: r.kycStatus || 'none', balance: r.balance || 0, frozenBalance: r.frozenBalance || 0, mustChangePassword: !!r.mustChangePassword, affiliateCode: r.affiliateCode || '', referredBy: r.referredBy || null, merchantId: r.merchantId || null, pinHash: r.pinHash || null, pendingConfirmation: r.pendingConfirmation || null, permissions: r.permissions || null, twoFactorEnabled: r.twoFactorEnabled || false, backupCodes: r.backupCodes || null, accountNumber: r.accountNumber || null, tempPinHash: r.tempPinHash || null, tempPinExpiresAt: r.tempPinExpiresAt || null, createdAt: r.created, updatedAt: r.updated }))
  },

  async create(data: any): Promise<User> {
    const pb = getPB()
    const now = nowTimestamp()
    const r = await pb.collection('users').create({
      email: data.email, passwordHash: data.passwordHash, fullName: data.fullName || null,
      phone: data.phone || null, country: data.country || null, role: data.role || 'user',
      status: data.status || 'active', emailVerified: data.emailVerified || false,
      phoneVerified: data.phoneVerified || false, kycStatus: data.kycStatus || 'none',
      kycIdPhoto: data.kycIdPhoto || null, kycSelfie: data.kycSelfie || null,
      kycNotes: data.kycNotes || null, balance: data.balance || 0,
      frozenBalance: data.frozenBalance || 0, mustChangePassword: data.mustChangePassword || false,
      referredBy: data.referredBy || null, merchantId: data.merchantId || null,
      affiliateCode: data.affiliateCode || generateAffiliateCode(),
      accountNumber: data.accountNumber || null,
      pinHash: data.pinHash || null, permissions: data.permissions || null,
      twoFactorEnabled: data.twoFactorEnabled || false, backupCodes: data.backupCodes || null,
    }) as any
    return { id: r.id, email: r.email, passwordHash: r.passwordHash, fullName: r.fullName || null, phone: r.phone || null, country: r.country || null, role: r.role || 'user', status: r.status || 'active', emailVerified: !!r.emailVerified, phoneVerified: !!r.phoneVerified, kycStatus: r.kycStatus || 'none', kycIdPhoto: r.kycIdPhoto || null, kycSelfie: r.kycSelfie || null, kycNotes: r.kycNotes || null, balance: r.balance || 0, frozenBalance: r.frozenBalance || 0, mustChangePassword: !!r.mustChangePassword, affiliateCode: r.affiliateCode || '', referredBy: r.referredBy || null, merchantId: r.merchantId || null, pinHash: r.pinHash || null, pendingConfirmation: r.pendingConfirmation || null, permissions: r.permissions || null, twoFactorEnabled: r.twoFactorEnabled || false, backupCodes: r.backupCodes || null, accountNumber: r.accountNumber || null, tempPinHash: r.tempPinHash || null, tempPinExpiresAt: r.tempPinExpiresAt || null, createdAt: r.created, updatedAt: r.updated }
  },

  async update(where: { id: string }, data: Partial<User>): Promise<User> {
    const pb = getPB()
    const updateData: any = { ...data, updatedAt: nowTimestamp() }
    // Remove undefined fields
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k])
    const r = await pb.collection('users').update(where.id, updateData) as any
    return { id: r.id, email: r.email, passwordHash: r.passwordHash, fullName: r.fullName || null, phone: r.phone || null, country: r.country || null, role: r.role || 'user', status: r.status || 'active', emailVerified: !!r.emailVerified, phoneVerified: !!r.phoneVerified, kycStatus: r.kycStatus || 'none', kycIdPhoto: r.kycIdPhoto || null, kycSelfie: r.kycSelfie || null, kycNotes: r.kycNotes || null, balance: r.balance || 0, frozenBalance: r.frozenBalance || 0, mustChangePassword: !!r.mustChangePassword, affiliateCode: r.affiliateCode || '', referredBy: r.referredBy || null, merchantId: r.merchantId || null, pinHash: r.pinHash || null, pendingConfirmation: r.pendingConfirmation || null, permissions: r.permissions || null, twoFactorEnabled: r.twoFactorEnabled || false, backupCodes: r.backupCodes || null, accountNumber: r.accountNumber || null, tempPinHash: r.tempPinHash || null, tempPinExpiresAt: r.tempPinExpiresAt || null, createdAt: r.created, updatedAt: r.updated }
  },

  async incrementBalance(userId: string, amount: number): Promise<void> {
    const pb = getPB()
    const r = await pb.collection('users').getOne(userId) as any
    await pb.collection('users').update(userId, { balance: (r.balance || 0) + amount })
  },

  async updateBalance(userId: string, newBalance: number): Promise<void> {
    const pb = getPB()
    await pb.collection('users').update(userId, { balance: newBalance })
  },

  async updateFrozenBalance(userId: string, newFrozenBalance: number): Promise<void> {
    const pb = getPB()
    await pb.collection('users').update(userId, { frozenBalance: newFrozenBalance })
  },
}

// ===================== OTP CODE OPERATIONS =====================

export const otpCodeOperations = {
  async create(data: any): Promise<OtpCode> {
    const pb = getPB()
    const r = await pb.collection('otpCodes').create({
      userId: data.userId || null, email: data.email, phone: data.phone || null,
      code: data.code, type: data.type, purpose: data.purpose || null,
      verified: false, expiresAt: data.expiresAt,
    }) as any
    return { id: r.id, userId: r.userId, email: r.email, phone: r.phone, code: r.code, type: r.type, purpose: r.purpose, verified: !!r.verified, expiresAt: r.expiresAt, createdAt: r.created }
  },

  async findFirst(options: { where: { email?: string; userId?: string; type: string; verified: boolean }; orderBy?: string }): Promise<OtpCode | null> {
    const pb = getPB()
    let filter = `type = '${options.where.type}' && verified = false`
    if (options.where.email) filter += ` && email = '${options.where.email.replace(/'/g, "\\'")}'`
    if (options.where.userId) filter += ` && userId = '${options.where.userId}'`
    const records = await pb.collection('otpCodes').getFullList({ filter, sort: '-created', limit: 10 })
    const now = new Date()
    const valid = records.filter((r: any) => new Date(r.expiresAt) >= now)
      .map((r: any) => ({ id: r.id, userId: r.userId, email: r.email, phone: r.phone, code: r.code, type: r.type, purpose: r.purpose, verified: !!r.verified, expiresAt: r.expiresAt, createdAt: r.created }))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return valid.length > 0 ? valid[0] : null
  },

  async update(id: string, data: Partial<OtpCode>): Promise<void> {
    const pb = getPB()
    await pb.collection('otpCodes').update(id, data)
  },
}

// ===================== KYC RECORD OPERATIONS =====================

export const kycRecordOperations = {
  async create(data: any): Promise<KYCRecord> {
    const pb = getPB()
    const r = await pb.collection('kycRecords') ? undefined : undefined
    // KYC stored in user record directly, but we keep interface
    const r2 = await pb.collection('users').getOne(data.userId).catch(() => null)
    // Actually create in a sub-collection approach or reuse users
    // For now store as notification-like record in custom way
    throw new Error('Use userOperations.update for KYC fields')
  },

  async findMany(): Promise<any[]> {
    // KYC is stored in user records
    const users = await userOperations.findMany()
    return users.filter(u => u.kycStatus !== 'none').map(u => ({
      id: u.id, userId: u.id, type: 'id_photo', fileUrl: u.kycIdPhoto,
      status: u.kycStatus, createdAt: u.createdAt,
    }))
  },

  async update(id: string, data: any): Promise<any> {
    const pb = getPB()
    if (data.status || data.notes) {
      const updateData: any = {}
      if (data.status) updateData.kycStatus = data.status
      if (data.notes) updateData.kycNotes = data.notes
      await pb.collection('users').update(id, updateData)
    }
    return { id }
  },

  async countPending(userId: string): Promise<number> {
    const user = await userOperations.findUnique({ id: userId })
    return user?.kycStatus === 'pending' ? 1 : 0
  },
}

// ===================== DEPOSIT OPERATIONS =====================

const mapDeposit = (r: any): Deposit => ({
  id: r.id, userId: r.userId, amount: r.amount || 0, fee: r.fee || 0,
  netAmount: r.netAmount || 0, currency: r.currency || 'USDT', network: r.network || 'TRC20',
  txId: r.txId || null, fromAddress: r.fromAddress || null, toAddress: r.toAddress || null,
  status: r.status || 'pending', method: r.method || 'blockchain', merchantId: r.merchantId || null,
  merchantNote: r.merchantNote || null, adminNote: r.adminNote || null, screenshot: r.screenshot || null,
  createdAt: r.created, updatedAt: r.updated,
})

export const depositOperations = {
  async create(data: any): Promise<Deposit> {
    const pb = getPB()
    const r = await pb.collection('deposits').create(data) as any
    return mapDeposit(r)
  },

  async findMany(options?: { status?: string }): Promise<Deposit[]> {
    const pb = getPB()
    const filter = options?.status && options.status !== 'all' ? `status = '${options.status}'` : ''
    const records = await pb.collection('deposits').getFullList({ filter: filter || undefined, sort: '-created', limit: 100 })
    return records.map(mapDeposit)
  },

  async findUnique(id: string): Promise<Deposit | null> {
    try {
      const pb = getPB()
      const r = await pb.collection('deposits').getOne(id) as any
      return mapDeposit(r)
    } catch { return null }
  },

  async update(id: string, data: any): Promise<Deposit> {
    const pb = getPB()
    const r = await pb.collection('deposits').update(id, { ...data, updatedAt: nowTimestamp() }) as any
    return mapDeposit(r)
  },
}

// ===================== WITHDRAWAL OPERATIONS =====================

const mapWithdrawal = (r: any): Withdrawal => ({
  id: r.id, userId: r.userId, amount: r.amount || 0, currency: r.currency || 'USDT',
  network: r.network || 'TRC20', toAddress: r.toAddress || '', status: r.status || 'pending',
  method: r.method || 'blockchain', merchantId: r.merchantId || null, txId: r.txId || null,
  fee: r.fee || 0, netAmount: r.netAmount || 0, adminNote: r.adminNote || null,
  screenshot: r.screenshot || null, paymentMethodName: r.paymentMethodName || null,
  paymentMethodId: r.paymentMethodId || null, createdAt: r.created, updatedAt: r.updated,
})

export const withdrawalOperations = {
  async create(data: any): Promise<Withdrawal> {
    const pb = getPB()
    const r = await pb.collection('withdrawals').create(data) as any
    return mapWithdrawal(r)
  },

  async findMany(options?: { status?: string }): Promise<Withdrawal[]> {
    const pb = getPB()
    const filter = options?.status && options.status !== 'all' ? `status = '${options.status}'` : ''
    const records = await pb.collection('withdrawals').getFullList({ filter: filter || undefined, sort: '-created', limit: 100 })
    return records.map(mapWithdrawal)
  },

  async findUnique(id: string): Promise<Withdrawal | null> {
    try {
      const pb = getPB()
      const r = await pb.collection('withdrawals').getOne(id) as any
      return mapWithdrawal(r)
    } catch { return null }
  },

  async update(id: string, data: any): Promise<Withdrawal> {
    const pb = getPB()
    const r = await pb.collection('withdrawals').update(id, { ...data, updatedAt: nowTimestamp() }) as any
    return mapWithdrawal(r)
  },
}

// ===================== TRANSACTION OPERATIONS =====================

export const transactionOperations = {
  async create(data: any): Promise<Transaction> {
    const pb = getPB()
    const r = await pb.collection('transactions').create(data) as any
    return { id: r.id, userId: r.userId, type: r.type, amount: r.amount, balanceBefore: r.balanceBefore || 0, balanceAfter: r.balanceAfter || 0, description: r.description || null, referenceId: r.referenceId || null, createdAt: r.created }
  },

  async findMany(userId: string): Promise<Transaction[]> {
    const pb = getPB()
    const records = await pb.collection('transactions').getFullList({ filter: `userId = '${userId}'`, sort: '-created', limit: 100 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, type: r.type, amount: r.amount, balanceBefore: r.balanceBefore || 0, balanceAfter: r.balanceAfter || 0, description: r.description || null, referenceId: r.referenceId || null, createdAt: r.created }))
  },
}

// ===================== NOTIFICATION OPERATIONS =====================

export const notificationOperations = {
  async create(data: any): Promise<Notification> {
    const pb = getPB()
    const r = await pb.collection('notifications').create(data) as any
    return { id: r.id, userId: r.userId, title: r.title, message: r.message, type: r.type || 'info', read: !!r.read, createdAt: r.created }
  },

  async findMany(userId: string, after?: string): Promise<Notification[]> {
    const pb = getPB()
    let filter = `userId = '${userId}'`
    if (after) filter += ` && created > '${after}'`
    const records = await pb.collection('notifications').getFullList({ filter, sort: '-created', limit: 50 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, title: r.title, message: r.message, type: r.type || 'info', read: !!r.read, createdAt: r.created }))
  },

  async countUnread(userId: string): Promise<number> {
    const pb = getPB()
    const records = await pb.collection('notifications').getFullList({ filter: `userId = '${userId}' && read = false`, limit: 100 })
    return records.length
  },

  async markAllRead(userId: string): Promise<void> {
    const pb = getPB()
    const records = await pb.collection('notifications').getFullList({ filter: `userId = '${userId}' && read = false`, limit: 100 })
    for (const r of records) {
      await pb.collection('notifications').update(r.id, { read: true }).catch(() => {})
    }
  },
}

// ===================== PAYMENT METHOD OPERATIONS =====================

const mapPaymentMethod = (r: any): PaymentMethod => ({
  id: r.id, name: r.name, type: r.type, category: r.category, purpose: r.purpose,
  isActive: !!r.isActive, network: r.network || null, walletAddress: r.walletAddress || null,
  accountName: r.accountName || null, accountNumber: r.accountNumber || null,
  beneficiaryName: r.beneficiaryName || null, phone: r.phone || null,
  recipientName: r.recipientName || null, recipientPhone: r.recipientPhone || null,
  minAmount: r.minAmount || null, maxAmount: r.maxAmount || null, instructions: r.instructions || null,
  createdAt: r.created, updatedAt: r.updated,
})

export const paymentMethodOperations = {
  async create(data: any): Promise<PaymentMethod> {
    const pb = getPB()
    const r = await pb.collection('paymentMethods').create(data) as any
    return mapPaymentMethod(r)
  },

  async findMany(): Promise<PaymentMethod[]> {
    const pb = getPB()
    const records = await pb.collection('paymentMethods').getFullList({ sort: '-created', limit: 50 })
    return records.map(mapPaymentMethod)
  },

  async findActive(purpose?: string): Promise<PaymentMethod[]> {
    const pb = getPB()
    const filter = purpose ? `isActive = true && (purpose = '${purpose}' || purpose = 'both')` : 'isActive = true'
    const records = await pb.collection('paymentMethods').getFullList({ filter, sort: '-created', limit: 50 })
    return records.map(mapPaymentMethod)
  },

  async update(id: string, data: any): Promise<void> {
    const pb = getPB()
    await pb.collection('paymentMethods').update(id, { ...data, updatedAt: nowTimestamp() })
  },

  async delete(id: string): Promise<void> {
    const pb = getPB()
    await pb.collection('paymentMethods').delete(id)
  },
}

// ===================== USER PAYMENT METHOD OPERATIONS =====================

export const userPaymentMethodOperations = {
  async create(data: any): Promise<UserPaymentMethod> {
    const pb = getPB()
    const r = await pb.collection('userPaymentMethods').create(data) as any
    return { id: r.id, userId: r.userId, name: r.name, type: r.type, category: r.category, isActive: !!r.isActive, network: r.network || null, walletAddress: r.walletAddress || null, accountName: r.accountName || null, accountNumber: r.accountNumber || null, beneficiaryName: r.beneficiaryName || null, phone: r.phone || null, recipientName: r.recipientName || null, recipientPhone: r.recipientPhone || null, createdAt: r.created, updatedAt: r.updated }
  },

  async findByUserId(userId: string): Promise<UserPaymentMethod[]> {
    const pb = getPB()
    const records = await pb.collection('userPaymentMethods').getFullList({ filter: `userId = '${userId}'`, sort: '-created', limit: 50 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, name: r.name, type: r.type, category: r.category, isActive: !!r.isActive, network: r.network || null, walletAddress: r.walletAddress || null, accountName: r.accountName || null, accountNumber: r.accountNumber || null, beneficiaryName: r.beneficiaryName || null, phone: r.phone || null, recipientName: r.recipientName || null, recipientPhone: r.recipientPhone || null, createdAt: r.created, updatedAt: r.updated }))
  },

  async update(id: string, data: any): Promise<void> {
    const pb = getPB()
    await pb.collection('userPaymentMethods').update(id, { ...data, updatedAt: nowTimestamp() })
  },

  async delete(id: string): Promise<void> {
    const pb = getPB()
    await pb.collection('userPaymentMethods').delete(id)
  },
}

// ===================== FAQ BOT OPERATIONS =====================

export const faqBotOperations = {
  async create(data: any): Promise<FaqItem> {
    const pb = getPB()
    const r = await pb.collection('faqBot').create(data) as any
    return { id: r.id, question: r.question, keywords: r.keywords || [], answer: r.answer, category: r.category || 'general', isActive: !!r.isActive, priority: r.priority || 0, createdAt: r.created, updatedAt: r.updated }
  },

  async findMany(options?: { activeOnly?: boolean }): Promise<FaqItem[]> {
    const pb = getPB()
    const filter = options?.activeOnly ? 'isActive = true' : ''
    const records = await pb.collection('faqBot').getFullList({ filter: filter || undefined, sort: '-priority', limit: 100 })
    return records.map((r: any) => ({ id: r.id, question: r.question, keywords: r.keywords || [], answer: r.answer, category: r.category || 'general', isActive: !!r.isActive, priority: r.priority || 0, createdAt: r.created, updatedAt: r.updated }))
  },

  async update(id: string, data: any): Promise<FaqItem> {
    const pb = getPB()
    const r = await pb.collection('faqBot').update(id, { ...data, updatedAt: nowTimestamp() }) as any
    return { id: r.id, question: r.question, keywords: r.keywords || [], answer: r.answer, category: r.category || 'general', isActive: !!r.isActive, priority: r.priority || 0, createdAt: r.created, updatedAt: r.updated }
  },

  async delete(id: string): Promise<void> {
    const pb = getPB()
    await pb.collection('faqBot').delete(id)
  },

  async getBotSettings(): Promise<{ isEnabled: boolean; greeting: string }> {
    const pb = getPB()
    try {
      const records = await pb.collection('systemSettings').getFullList({ filter: `key = 'botSettings'`, limit: 1 })
      if (records.length > 0) {
        const data = (records[0] as any).value || {}
        return { isEnabled: data.isEnabled ?? true, greeting: data.greeting || 'مرحباً! كيف يمكنني مساعدتك اليوم؟' }
      }
    } catch {}
    return { isEnabled: true, greeting: 'مرحباً! كيف يمكنني مساعدتك اليوم؟ اطرح سؤالك وسأحاول الإجابة.' }
  },

  async updateBotSettings(data: { isEnabled: boolean; greeting: string }): Promise<void> {
    const pb = getPB()
    try {
      const records = await pb.collection('systemSettings').getFullList({ filter: `key = 'botSettings'`, limit: 1 })
      if (records.length > 0) {
        await pb.collection('systemSettings').update(records[0].id, { value: data })
      } else {
        await pb.collection('systemSettings').create({ key: 'botSettings', value: data })
      }
    } catch {
      await pb.collection('systemSettings').create({ key: 'botSettings', value: data })
    }
  },
}

// ===================== REFERRAL OPERATIONS =====================

export const referralOperations = {
  async create(data: any): Promise<Referral> {
    const pb = getPB()
    const r = await pb.collection('referrals').create({ ...data, totalEarnings: 0 }) as any
    return { id: r.id, referrerId: r.referrerId, referredId: r.referredId, referredEmail: r.referredEmail, referralCode: r.referralCode, level: r.level || 1, status: r.status || 'active', totalEarnings: r.totalEarnings || 0, createdAt: r.created }
  },

  async findByReferrer(referrerId: string): Promise<Referral[]> {
    const pb = getPB()
    const records = await pb.collection('referrals').getFullList({ filter: `referrerId = '${referrerId}'`, sort: '-created', limit: 200 })
    return records.map((r: any) => ({ id: r.id, referrerId: r.referrerId, referredId: r.referredId, referredEmail: r.referredEmail, referralCode: r.referralCode, level: r.level || 1, status: r.status || 'active', totalEarnings: r.totalEarnings || 0, createdAt: r.created }))
  },

  async findByReferred(referredId: string): Promise<Referral[]> {
    const pb = getPB()
    const records = await pb.collection('referrals').getFullList({ filter: `referredId = '${referredId}'`, limit: 10 })
    return records.map((r: any) => ({ id: r.id, referrerId: r.referrerId, referredId: r.referredId, referredEmail: r.referredEmail, referralCode: r.referralCode, level: r.level || 1, status: r.status || 'active', totalEarnings: r.totalEarnings || 0, createdAt: r.created }))
  },

  async updateEarnings(id: string, additionalEarnings: number): Promise<void> {
    const pb = getPB()
    const r = await pb.collection('referrals').getOne(id) as any
    await pb.collection('referrals').update(id, { totalEarnings: (r.totalEarnings || 0) + additionalEarnings })
  },

  async createCommission(data: any): Promise<ReferralCommission> {
    const pb = getPB()
    const r = await pb.collection('referralCommissions').create(data) as any
    return { id: r.id, referrerId: r.referrerId, referredId: r.referredId, referralId: r.referralId, depositId: r.depositId || null, withdrawalId: r.withdrawalId || null, amount: r.amount || 0, level: r.level || 0, description: r.description || '', createdAt: r.created }
  },

  async findByReferrerCommissions(referrerId: string): Promise<ReferralCommission[]> {
    const pb = getPB()
    const records = await pb.collection('referralCommissions').getFullList({ filter: `referrerId = '${referrerId}'`, sort: '-created', limit: 200 })
    return records.map((r: any) => ({ id: r.id, referrerId: r.referrerId, referredId: r.referredId, referralId: r.referralId, depositId: r.depositId || null, withdrawalId: r.withdrawalId || null, amount: r.amount || 0, level: r.level || 0, description: r.description || '', createdAt: r.created }))
  },

  async findAllCommissions(): Promise<ReferralCommission[]> {
    const pb = getPB()
    const records = await pb.collection('referralCommissions').getFullList({ sort: '-created', limit: 500 })
    return records.map((r: any) => ({ id: r.id, referrerId: r.referrerId, referredId: r.referredId, referralId: r.referralId, depositId: r.depositId || null, withdrawalId: r.withdrawalId || null, amount: r.amount || 0, level: r.level || 0, description: r.description || '', createdAt: r.created }))
  },

  async countAllReferrals(): Promise<number> {
    const pb = getPB()
    const records = await pb.collection('referrals').getFullList({ limit: 500 })
    return records.length
  },
}

// ===================== SYSTEM SETTINGS OPERATIONS =====================

export const systemSettingsOperations = {
  async getReferralSettings(): Promise<ReferralSettings> {
    const pb = getPB()
    try {
      const records = await pb.collection('systemSettings').getFullList({ filter: `key = 'referralSettings'`, limit: 1 })
      if (records.length > 0) {
        const data = (records[0] as any).value
        if (data && typeof data === 'object') return data as ReferralSettings
      }
    } catch {}
    const defaults: ReferralSettings = { isEnabled: false, commissionType: 'percentage', commissionLevels: [3, 1, 0.5], minDepositForCommission: 10, maxLevels: 3 }
    return defaults
  },

  async updateReferralSettings(data: Partial<ReferralSettings>): Promise<ReferralSettings> {
    const current = await systemSettingsOperations.getReferralSettings()
    const updated = { ...current, ...data }
    const pb = getPB()
    try {
      const records = await pb.collection('systemSettings').getFullList({ filter: `key = 'referralSettings'`, limit: 1 })
      if (records.length > 0) {
        await pb.collection('systemSettings').update(records[0].id, { value: updated })
      } else {
        await pb.collection('systemSettings').create({ key: 'referralSettings', value: updated })
      }
    } catch {
      await pb.collection('systemSettings').create({ key: 'referralSettings', value: updated })
    }
    return updated
  },

  async findByAffiliateCode(code: string): Promise<User | null> {
    const pb = getPB()
    try {
      const records = await pb.collection('users').getFullList({ filter: `affiliateCode = '${code}'`, limit: 1 })
      if (records.length === 0) return null
      return await userOperations.findUnique({ id: records[0].id })
    } catch { return null }
  },
}

// ===================== CHAT OPERATIONS =====================

export const chatOperations = {
  async createChat(userId: string, adminId: string, firstMessage: string, senderType: string = 'user'): Promise<Chat> {
    const pb = getPB()
    const isFromAdmin = senderType === 'admin'
    const chat = await pb.collection('chats').create({
      userId, adminId, participants: [userId, adminId],
      lastMessage: firstMessage, lastMessageAt: nowTimestamp(),
      lastMessageBy: isFromAdmin ? 'admin' : 'user',
      userUnreadCount: isFromAdmin ? 1 : 0, adminUnreadCount: isFromAdmin ? 0 : 1,
      status: 'open',
    }) as any
    const messageId = generateId()
    await pb.collection('chatMessages').create({
      id: messageId, chatId: chat.id,
      senderId: isFromAdmin ? adminId : userId, senderType, message: firstMessage,
      type: 'text', read: false,
    })
    return { id: chat.id, userId: chat.userId, adminId: chat.adminId, participants: chat.participants || [], lastMessage: chat.lastMessage, lastMessageAt: chat.lastMessageAt, lastMessageBy: chat.lastMessageBy, userUnreadCount: chat.userUnreadCount || 0, adminUnreadCount: chat.adminUnreadCount || 0, status: chat.status || 'open', createdAt: chat.created, updatedAt: chat.updated }
  },

  async findChats(options: { userId: string; role: string }): Promise<Chat[]> {
    const pb = getPB()
    const filter = options.role === 'admin' ? `adminId = '${options.userId}'` : `userId = '${options.userId}'`
    const records = await pb.collection('chats').getFullList({ filter, sort: '-lastMessageAt', limit: 100 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, adminId: r.adminId, participants: r.participants || [], lastMessage: r.lastMessage, lastMessageAt: r.lastMessageAt, lastMessageBy: r.lastMessageBy, userUnreadCount: r.userUnreadCount || 0, adminUnreadCount: r.adminUnreadCount || 0, status: r.status || 'open', createdAt: r.created, updatedAt: r.updated }))
  },

  async findChat(chatId: string): Promise<Chat | null> {
    try {
      const pb = getPB()
      const r = await pb.collection('chats').getOne(chatId) as any
      return { id: r.id, userId: r.userId, adminId: r.adminId, participants: r.participants || [], lastMessage: r.lastMessage, lastMessageAt: r.lastMessageAt, lastMessageBy: r.lastMessageBy, userUnreadCount: r.userUnreadCount || 0, adminUnreadCount: r.adminUnreadCount || 0, status: r.status || 'open', createdAt: r.created, updatedAt: r.updated }
    } catch { return null }
  },

  async sendMessage(chatId: string, senderId: string, senderType: string, message: string, type: string = 'text', imageUrl?: string | null): Promise<ChatMessage> {
    const pb = getPB()
    const msgId = generateId()
    await pb.collection('chatMessages').create({
      id: msgId, chatId, senderId, senderType, message, type, imageUrl: imageUrl || null, read: false,
    })
    const chat = await pb.collection('chats').getOne(chatId) as any
    const updateFields: any = { lastMessage: message, lastMessageAt: nowTimestamp(), lastMessageBy: senderType }
    if (senderType === 'user') updateFields.adminUnreadCount = (chat.adminUnreadCount || 0) + 1
    else updateFields.userUnreadCount = (chat.userUnreadCount || 0) + 1
    await pb.collection('chats').update(chatId, updateFields)
    return { id: msgId, chatId, senderId, senderType, message, type, imageUrl: imageUrl || null, read: false, createdAt: nowTimestamp() }
  },

  async findMessages(chatId: string, limit: number = 50, before?: string): Promise<ChatMessage[]> {
    const pb = getPB()
    const records = await pb.collection('chatMessages').getFullList({ filter: `chatId = '${chatId}'`, sort: 'created', limit })
    return records.map((r: any) => ({ id: r.id, chatId: r.chatId, senderId: r.senderId, senderType: r.senderType, message: r.message, type: r.type || 'text', imageUrl: r.imageUrl || null, read: !!r.read, createdAt: r.created }))
  },

  async findMessagesAfter(chatId: string, after: string): Promise<ChatMessage[]> {
    const pb = getPB()
    const records = await pb.collection('chatMessages').getFullList({ filter: `chatId = '${chatId}' && created > '${after}'`, sort: 'created', limit: 50 })
    return records.map((r: any) => ({ id: r.id, chatId: r.chatId, senderId: r.senderId, senderType: r.senderType, message: r.message, type: r.type || 'text', imageUrl: r.imageUrl || null, read: !!r.read, createdAt: r.created }))
  },

  async markRead(chatId: string, readerType: string): Promise<void> {
    const pb = getPB()
    // Mark unread messages as read
    const chat = await pb.collection('chats').getOne(chatId) as any
    const otherType = readerType === 'user' ? 'admin' : 'user'
    const otherSenderId = readerType === 'user' ? chat.adminId : chat.userId
    const unreadMsgs = await pb.collection('chatMessages').getFullList({
      filter: `chatId = '${chatId}' && senderId = '${otherSenderId}' && read = false`, limit: 100
    })
    for (const msg of unreadMsgs) {
      await pb.collection('chatMessages').update(msg.id, { read: true }).catch(() => {})
    }
    // Reset unread count
    if (readerType === 'user') {
      await pb.collection('chats').update(chatId, { userUnreadCount: 0 })
    } else {
      await pb.collection('chats').update(chatId, { adminUnreadCount: 0 })
    }
  },

  async closeChat(chatId: string): Promise<void> {
    const pb = getPB()
    await pb.collection('chats').update(chatId, { status: 'closed' })
  },

  async deleteChat(chatId: string): Promise<void> {
    const pb = getPB()
    const msgs = await pb.collection('chatMessages').getFullList({ filter: `chatId = '${chatId}'`, limit: 500 })
    for (const msg of msgs) {
      await pb.collection('chatMessages').delete(msg.id).catch(() => {})
    }
    await pb.collection('chats').delete(chatId)
  },

  async countAdminUnread(adminId: string): Promise<number> {
    const pb = getPB()
    const chats = await pb.collection('chats').getFullList({ filter: `adminId = '${adminId}' && adminUnreadCount > 0`, limit: 100 })
    let total = 0
    for (const c of chats) total += ((c as any).adminUnreadCount || 0)
    return total
  },

  async countUserUnread(userId: string): Promise<number> {
    const pb = getPB()
    const chats = await pb.collection('chats').getFullList({ filter: `userId = '${userId}' && userUnreadCount > 0`, limit: 100 })
    let total = 0
    for (const c of chats) total += ((c as any).userUnreadCount || 0)
    return total
  },
}

// ===================== MERCHANT OPERATIONS =====================

export const merchantOperations = {
  async create(data: any): Promise<Merchant> {
    const pb = getPB()
    const r = await pb.collection('merchants').create({ ...data, status: 'pending', submittedAt: nowTimestamp() }) as any
    return { id: r.id, userId: r.userId, status: r.status, idPhoto: r.idPhoto, selfiePhoto: r.selfiePhoto, addressProof: r.addressProof, fullName: r.fullName, phone: r.phone, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, reviewedBy: r.reviewedBy }
  },

  async findPending(): Promise<Merchant[]> {
    const pb = getPB()
    const records = await pb.collection('merchants').getFullList({ filter: `status = 'pending'`, sort: '-submittedAt', limit: 100 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, status: r.status, idPhoto: r.idPhoto, selfiePhoto: r.selfiePhoto, addressProof: r.addressProof, fullName: r.fullName, phone: r.phone, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, reviewedBy: r.reviewedBy }))
  },

  async findAll(): Promise<Merchant[]> {
    const pb = getPB()
    const records = await pb.collection('merchants').getFullList({ sort: '-submittedAt', limit: 200 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, status: r.status, idPhoto: r.idPhoto, selfiePhoto: r.selfiePhoto, addressProof: r.addressProof, fullName: r.fullName, phone: r.phone, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, reviewedBy: r.reviewedBy }))
  },

  async findByUser(userId: string): Promise<Merchant[]> {
    const pb = getPB()
    const records = await pb.collection('merchants').getFullList({ filter: `userId = '${userId}'`, limit: 10 })
    return records.map((r: any) => ({ id: r.id, userId: r.userId, status: r.status, idPhoto: r.idPhoto, selfiePhoto: r.selfiePhoto, addressProof: r.addressProof, fullName: r.fullName, phone: r.phone, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, reviewedBy: r.reviewedBy }))
  },

  async findApprovedByUser(userId: string): Promise<Merchant | null> {
    const pb = getPB()
    try {
      const records = await pb.collection('merchants').getFullList({ filter: `userId = '${userId}' && status = 'approved'`, limit: 1 })
      if (records.length === 0) return null
      const r = records[0] as any
      return { id: r.id, userId: r.userId, status: r.status, idPhoto: r.idPhoto, selfiePhoto: r.selfiePhoto, addressProof: r.addressProof, fullName: r.fullName, phone: r.phone, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote, reviewedBy: r.reviewedBy }
    } catch { return null }
  },

  async updateStatus(id: string, status: 'approved' | 'rejected', reviewNote?: string, reviewedBy?: string): Promise<void> {
    const pb = getPB()
    await pb.collection('merchants').update(id, { status, reviewNote: reviewNote || null, reviewedBy: reviewedBy || null, reviewedAt: nowTimestamp() })
  },
}

// ===================== MERCHANT APPLICATION OPERATIONS =====================

export const merchantApplicationOperations = {
  async create(data: any): Promise<any> {
    const pb = getPB()
    const r = await pb.collection('merchantApplications').create({ ...data, status: 'pending', submittedAt: nowTimestamp() }) as any
    return r
  },

  async findByUser(userId: string): Promise<any[]> {
    const pb = getPB()
    return await pb.collection('merchantApplications').getFullList({ filter: `userId = '${userId}'`, sort: '-submittedAt', limit: 10 })
  },

  async findPending(): Promise<any[]> {
    const pb = getPB()
    return await pb.collection('merchantApplications').getFullList({ filter: `status = 'pending'`, sort: '-submittedAt', limit: 100 })
  },

  async updateStatus(id: string, status: string, reviewNote?: string, reviewedBy?: string): Promise<void> {
    const pb = getPB()
    await pb.collection('merchantApplications').update(id, { status, reviewNote: reviewNote || null, reviewedBy: reviewedBy || null, reviewedAt: nowTimestamp() })
  },
}
